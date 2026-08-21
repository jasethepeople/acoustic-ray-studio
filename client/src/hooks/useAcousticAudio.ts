import { useCallback, useEffect, useRef, useState } from "react";
import { calculateBandMetrics, estimateDopplerFrequency } from "@shared/acousticMath";
import type { AcousticNode, AcousticProjectSnapshot } from "@shared/acoustics";

type SourceChain = {
  oscillator: OscillatorNode;
  inputGain: GainNode;
  panner: PannerNode;
  dryGain: GainNode;
  wetGain: GainNode;
};

type Engine = {
  context: AudioContext;
  master: GainNode;
  convolver: ConvolverNode;
  analyser: AnalyserNode;
  mediaDestination: MediaStreamAudioDestinationNode;
  sources: Map<string, SourceChain>;
};

function buildImpulse(context: AudioContext, decaySeconds: number) {
  const length = Math.max(1, Math.floor(context.sampleRate * Math.min(5, Math.max(0.35, decaySeconds))));
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < data.length; index += 1) {
      const fade = Math.pow(1 - index / data.length, 2.3);
      data[index] = (Math.random() * 2 - 1) * fade;
    }
  }
  return buffer;
}

function setPosition(param: AudioParam, value: number, now: number) {
  param.cancelScheduledValues(now);
  param.linearRampToValueAtTime(value, now + 0.03);
}

export function useAcousticAudio(project: AcousticProjectSnapshot) {
  const engineRef = useRef<Engine | null>(null);
  const projectRef = useRef(project);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const reverbRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  projectRef.current = project;

  const syncEngine = useCallback((snapshot: AcousticProjectSnapshot) => {
    const engine = engineRef.current;
    if (!engine) return;
    const now = engine.context.currentTime;
    const listener = snapshot.nodes.find((node) => node.kind === "listener");
    if (listener) {
      setPosition(engine.context.listener.positionX, listener.position.x, now);
      setPosition(engine.context.listener.positionY, listener.position.y, now);
      setPosition(engine.context.listener.positionZ, listener.position.z, now);
    }
    const metrics = calculateBandMetrics(snapshot);
    const midBand = metrics.find((metric) => metric.band === 1000)?.sabine ?? 1.2;
    if (Math.abs(midBand - reverbRef.current) > 0.03) {
      engine.convolver.buffer = buildImpulse(engine.context, midBand);
      reverbRef.current = midBand;
    }
    const activeIds = new Set(snapshot.nodes.filter((node) => node.kind === "source").map((node) => node.id));
    engine.sources.forEach((chain, id) => {
      if (!activeIds.has(id)) {
        chain.oscillator.stop();
        chain.oscillator.disconnect();
        chain.inputGain.disconnect();
        chain.panner.disconnect();
        engine.sources.delete(id);
      }
    });
    snapshot.nodes.filter((node) => node.kind === "source").forEach((node) => {
      let chain = engine.sources.get(node.id);
      if (!chain) {
        const oscillator = engine.context.createOscillator();
        oscillator.type = "sine";
        const inputGain = engine.context.createGain();
        const panner = engine.context.createPanner();
        const dryGain = engine.context.createGain();
        const wetGain = engine.context.createGain();
        panner.panningModel = "HRTF";
        panner.distanceModel = "inverse";
        panner.refDistance = 1;
        panner.maxDistance = 30;
        panner.rolloffFactor = 1.2;
        dryGain.gain.value = 0.82;
        wetGain.gain.value = 0.28;
        oscillator.connect(inputGain).connect(panner);
        panner.connect(dryGain).connect(engine.master);
        panner.connect(wetGain).connect(engine.convolver);
        oscillator.start();
        chain = { oscillator, inputGain, panner, dryGain, wetGain };
        engine.sources.set(node.id, chain);
      }
      const perceivedFrequency = listener
        ? estimateDopplerFrequency(node.frequency, node.position, node.velocity, listener.position, listener.velocity)
        : node.frequency;
      chain.oscillator.frequency.setTargetAtTime(perceivedFrequency, now, 0.02);
      chain.inputGain.gain.setTargetAtTime(node.muted ? 0 : node.gain * 0.22, now, 0.02);
      setPosition(chain.panner.positionX, node.position.x, now);
      setPosition(chain.panner.positionY, node.position.y, now);
      setPosition(chain.panner.positionZ, node.position.z, now);
    });
  }, []);

  const initialise = useCallback(() => {
    if (engineRef.current) return engineRef.current;
    if (typeof window === "undefined" || !window.AudioContext) {
      setAudioError("Web Audio is unavailable in this browser. Use a current desktop browser to monitor the field.");
      return null;
    }
    let context: AudioContext;
    try {
      context = new AudioContext();
    } catch {
      setAudioError("The audio engine could not start. Check browser audio permissions and try again.");
      return null;
    }
    const master = context.createGain();
    const convolver = context.createConvolver();
    const analyserNode = context.createAnalyser();
    const mediaDestination = context.createMediaStreamDestination();
    master.gain.value = 0.72;
    analyserNode.fftSize = 1024;
    convolver.connect(master);
    master.connect(analyserNode);
    analyserNode.connect(context.destination);
    analyserNode.connect(mediaDestination);
    const engine = { context, master, convolver, analyser: analyserNode, mediaDestination, sources: new Map<string, SourceChain>() };
    engineRef.current = engine;
    setAnalyser(analyserNode);
    syncEngine(projectRef.current);
    return engine;
  }, [syncEngine]);

  const start = useCallback(async () => {
    const engine = initialise();
    if (!engine) return;
    try {
      await engine.context.resume();
      syncEngine(projectRef.current);
      setAudioError(null);
      setIsPlaying(true);
    } catch {
      setAudioError("Audio monitoring could not resume. Interact with the page, then try Monitor again.");
    }
  }, [initialise, syncEngine]);

  const stop = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    await engine.context.suspend();
    setIsPlaying(false);
  }, []);

  const toggleRecording = useCallback(async () => {
    const engine = initialise();
    if (!engine) return;
    if (typeof window === "undefined" || !window.MediaRecorder) {
      setAudioError("Mix capture is not supported in this browser. Use a current Chromium, Firefox, or Safari release.");
      return;
    }
    try {
      await engine.context.resume();
      setIsPlaying(true);
    } catch {
      setAudioError("Recording could not start because the audio engine is blocked. Interact with the page and retry.");
      return;
    }
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
      return;
    }
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(engine.mediaDestination.stream, { mimeType });
    } catch {
      setAudioError("The browser could not configure a WebM capture stream.");
      return;
    }
    recordChunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordChunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      if (recordChunksRef.current.length === 0) {
        setAudioError("No audio frames were captured. Start Monitor before recording the spatial mix.");
      } else {
        try {
          const blob = new Blob(recordChunksRef.current, { type: mimeType });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = `acoustic-ray-mix-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
          anchor.click();
          URL.revokeObjectURL(url);
          setAudioError(null);
        } catch {
          setAudioError("The captured mix could not be exported. Check browser download permissions and retry.");
        }
      }
      setIsRecording(false);
    };
    try {
      recorder.start(250);
      recorderRef.current = recorder;
      setAudioError(null);
      setIsRecording(true);
    } catch {
      setAudioError("The browser rejected the recording request. Check device and download permissions, then retry.");
    }
  }, [initialise]);

  useEffect(() => {
    syncEngine(project);
  }, [project, syncEngine]);

  useEffect(() => () => {
    recorderRef.current?.stop();
    const engine = engineRef.current;
    engine?.sources.forEach((chain) => chain.oscillator.stop());
    engine?.context.close();
  }, []);

  return { analyser, audioError, isPlaying, isRecording, start, stop, toggleRecording };
}
