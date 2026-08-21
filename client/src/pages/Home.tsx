import AcousticViewport from "@/components/AcousticViewport";
import BenchmarkVariantComparison from "@/components/BenchmarkVariantComparison";
import Oscilloscope from "@/components/Oscilloscope";
import PerformanceStatusBanner, { type PerformanceState } from "@/components/PerformanceStatusBanner";
import RendererHealthChart from "@/components/RendererHealthChart";
import { Button } from "@/components/ui/button";
import { useAcousticAudio } from "@/hooks/useAcousticAudio";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Activity, ChevronDown, CircleDot, Crosshair, Ear, FileJson, Grid3X3, Layers3, Move3D, Pause, Play, Plus, Radio, RotateCcw, Save, Settings2, SlidersHorizontal, Volume2 } from "lucide-react";
import React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MATERIALS, OCTAVE_BANDS, DEFAULT_PROJECT, type AcousticNode, type AcousticProjectSnapshot, type BenchmarkSummary, type MaterialId, type SurfaceRole, type Vec3 } from "@shared/acoustics";
import { calculateBandMetrics, estimateDopplerFrequency, roomVolume } from "@shared/acousticMath";
import { createAcousticReport } from "@shared/acousticReport";
import { appendRendererHealthSample, averageSessionFps, calculateMeasuredFps, isSustainedLowFps, RAY_QUALITY_OPTIONS, recommendQualityFromBenchmark, recommendRayCount, summarizeRendererHealth, type RendererDeviceProfile, type RendererHealth } from "@shared/rendererPerformance";

const surfaceIcons: Record<SurfaceRole, string> = { floor: "F", ceiling: "C", north: "N", south: "S", east: "E", west: "W" };

function formatPosition(position: Vec3) {
  return `${position.x.toFixed(2)} / ${position.y.toFixed(2)} / ${position.z.toFixed(2)}`;
}

function getRendererDeviceProfile(): RendererDeviceProfile {
  const browserNavigator = navigator as Navigator & { deviceMemory?: number };
  return { viewportWidth: window.innerWidth, cores: browserNavigator.hardwareConcurrency, memoryGb: browserNavigator.deviceMemory };
}

const requestBenchmarkFrame = (callback: FrameRequestCallback) => window.requestAnimationFrame ? window.requestAnimationFrame(callback) : window.setTimeout(() => callback(performance.now()), 16);
const cancelBenchmarkFrame = (frameId: number) => window.cancelAnimationFrame ? window.cancelAnimationFrame(frameId) : window.clearTimeout(frameId);

export default function Home() {
  const [project, setProject] = useState<AcousticProjectSnapshot>(() => structuredClone(DEFAULT_PROJECT));
  const [selectedSurface, setSelectedSurface] = useState<SurfaceRole>("floor");
  const [selectedNodeId, setSelectedNodeId] = useState<string>("src-1");
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [sceneOpen, setSceneOpen] = useState(true);
  const [savedProjectId, setSavedProjectId] = useState<number | undefined>();
  const [rendererHealth, setRendererHealth] = useState<RendererHealth>({ fps: 60, width: 0, height: 0, pixelRatio: 1, resizeEvents: 0, status: "STABLE" });
  const [healthHistory, setHealthHistory] = useState<RendererHealth[]>([]);
  const [benchmarkResult, setBenchmarkResult] = useState<string | null>(null);
  const [benchmarkRunning, setBenchmarkRunning] = useState(false);
  const [performanceState, setPerformanceState] = useState<PerformanceState>("nominal");
  const benchmarkFrameRef = useRef<number | null>(null);
  const { isAuthenticated } = useAuth();
  const storedProjects = trpc.acousticProjects.list.useQuery(undefined, { enabled: isAuthenticated });
  const saveProjectMutation = trpc.acousticProjects.save.useMutation({
    onSuccess: (savedProject) => {
      if (savedProject) setSavedProjectId(savedProject.id);
    },
  });
  const { analyser, audioError, isPlaying, isRecording, start, stop, toggleRecording } = useAcousticAudio(project);

  useEffect(() => {
    setProject((current) => current.rayQuality === "adaptive" ? { ...current, rayCount: recommendRayCount("adaptive", getRendererDeviceProfile()) } : current);
  }, []);
  useEffect(() => () => {
    if (benchmarkFrameRef.current !== null) cancelBenchmarkFrame(benchmarkFrameRef.current);
  }, []);

  const metrics = useMemo(() => calculateBandMetrics(project), [project]);
  const selectedNode = project.nodes.find((node) => node.id === selectedNodeId) ?? project.nodes[0];
  const listener = project.nodes.find((node) => node.kind === "listener");
  const source = project.nodes.find((node) => node.kind === "source");
  const dopplerFrequency = source && listener ? estimateDopplerFrequency(source.frequency, source.position, source.velocity, listener.position, listener.velocity) : 0;
  const volume = roomVolume(project.room);
  const lowFpsAlert = useMemo(() => isSustainedLowFps(healthHistory), [healthHistory]);
  const comparisonRows = useMemo(() => (storedProjects.data ?? []).map((saved) => ({ id: saved.id, name: saved.name, history: saved.snapshot.benchmarkHistory ?? [] })).filter((row) => row.history.length > 0), [storedProjects.data]);

  useEffect(() => {
    setPerformanceState((current) => {
      if (lowFpsAlert) return "low";
      return current === "low" ? "recovered" : current;
    });
  }, [lowFpsAlert]);

  const updateDimension = (field: keyof AcousticProjectSnapshot["room"], value: number) => {
    setProject((current) => ({ ...current, room: { ...current.room, [field]: Number.isFinite(value) ? Math.max(2, value) : current.room[field] } }));
  };
  const updateSurfaceMaterial = (surfaceId: SurfaceRole, materialId: MaterialId) => {
    setProject((current) => ({ ...current, surfaces: current.surfaces.map((surface) => surface.id === surfaceId ? { ...surface, materialId } : surface) }));
  };
  const updateNode = (nodeId: string, patch: Partial<AcousticNode>) => {
    setProject((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === nodeId ? { ...node, ...patch } : node) }));
  };
  const updateNodePosition = (nodeId: string, position: Vec3) => updateNode(nodeId, { position });
  const addNode = (kind: AcousticNode["kind"]) => {
    const next = project.nodes.filter((node) => node.kind === kind).length + 1;
    const id = `${kind === "source" ? "src" : "lst"}-${Date.now()}`;
    const node: AcousticNode = {
      id,
      kind,
      label: kind === "source" ? `S-${String(next).padStart(2, "0")} / Tone` : `L-${String(next).padStart(2, "0")} / Probe`,
      position: { x: kind === "source" ? -1 : 1, y: kind === "source" ? 1.35 : 1.6, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      gain: kind === "source" ? 0.55 : 1,
      frequency: kind === "source" ? 440 : 0,
    };
    setProject((current) => ({ ...current, nodes: [...current.nodes, node] }));
    setSelectedNodeId(id);
  };
  const resetProject = () => {
    setProject(structuredClone(DEFAULT_PROJECT));
    setSelectedNodeId("src-1");
    setSelectedSurface("floor");
  };
  const exportReport = () => {
    const report = createAcousticReport(project, summarizeRendererHealth(rendererHealth, healthHistory));
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `acoustic-report-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const saveProject = () => {
    if (!isAuthenticated) {
      startLogin();
      return;
    }
    saveProjectMutation.mutate({ id: savedProjectId, name: "Untitled chamber", snapshot: project });
  };
  const selectRayQuality = (quality: "adaptive" | "eco" | "balanced" | "precision") => {
    setProject((current) => ({ ...current, rayQuality: quality, rayCount: recommendRayCount(quality, getRendererDeviceProfile()) }));
  };
  const updateRendererHealth = useCallback((health: RendererHealth) => {
    setRendererHealth(health);
    setHealthHistory((current) => appendRendererHealthSample(current, health));
  }, []);
  const runBenchmark = () => {
    if (benchmarkRunning) return;
    setBenchmarkRunning(true);
    setBenchmarkResult(null);
    const startedAt = performance.now();
    let renderedFrames = 0;
    const sample = (now: number) => {
      renderedFrames += 1;
      const elapsed = now - startedAt;
      if (elapsed >= 1500) {
        const measuredFps = calculateMeasuredFps(renderedFrames, elapsed);
        const recommendation = recommendQualityFromBenchmark(measuredFps, getRendererDeviceProfile());
        const benchmark: BenchmarkSummary = { measuredFps, recommendation, sampledAt: new Date().toISOString(), sessionAverageFps: averageSessionFps(healthHistory), sampleCount: healthHistory.length };
        setProject((current) => ({ ...current, rayQuality: recommendation, rayCount: recommendRayCount(recommendation, getRendererDeviceProfile()), benchmarkHistory: [...current.benchmarkHistory, benchmark].slice(-12) }));
        setBenchmarkResult(`${recommendation.toUpperCase()} · ${measuredFps} FPS`);
        setBenchmarkRunning(false);
        benchmarkFrameRef.current = null;
        return;
      }
      benchmarkFrameRef.current = requestBenchmarkFrame(sample);
    };
    benchmarkFrameRef.current = requestBenchmarkFrame(sample);
  };

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <div className="brand-lockup">
          <div className="brand-mark"><span /><span /><span /></div>
          <div>
            <p className="eyebrow">ARC-01 / ACOUSTIC RAY COMPUTE</p>
            <h1>Acoustic Ray Studio</h1>
          </div>
        </div>
        <div className="header-readout">
          <span className="live-pill"><i /> LIVE FIELD</span>
          <span>SIM RATE <b>60 Hz</b></span>
          <span>UNIT <b>METRIC</b></span>
          <Button variant="outline" onClick={isPlaying ? stop : start} className="hud-button">{isPlaying ? <Pause size={14} /> : <Play size={14} />}{isPlaying ? " Mute engine" : " Monitor"}</Button>
          <Button variant="outline" onClick={toggleRecording} className={`hud-button ${isRecording ? "is-recording" : ""}`}><Radio size={14} /> {isRecording ? "Stop capture" : "Record mix"}</Button>
          <Button variant="outline" onClick={resetProject} className="hud-button"><RotateCcw size={14} /> Reset field</Button>
        </div>
      </header>
      {audioError && <div className="audio-error" role="alert">AUDIO DIAGNOSTIC / {audioError}</div>}
      <PerformanceStatusBanner state={performanceState} />

      <section className="studio-workspace">
        <aside className="tool-rail" aria-label="Scene tools">
          <div className="rail-section">
            <p className="panel-label">TOOLS</p>
            <button className="tool-button is-active" title="Select and move"><Move3D size={18} /></button>
            <button className="tool-button" title="Grid snapping"><Grid3X3 size={18} /></button>
            <button className="tool-button" title="Ray probe"><Crosshair size={18} /></button>
            <button className="tool-button" title="Layer view"><Layers3 size={18} /></button>
          </div>
          <div className="rail-section rail-bottom">
            <button className="tool-button" title="Field settings"><Settings2 size={18} /></button>
          </div>
        </aside>

        <section className="left-stack">
          <div className="hud-panel project-panel">
            <div className="panel-heading"><span>PROJECT</span><CircleDot size={14} /></div>
            <div className="project-name">Untitled chamber <em>{saveProjectMutation.isPending ? "Saving" : savedProjectId ? "Saved" : "Draft"}</em></div>
            <div className="mini-stats"><span>VOL <b>{volume.toFixed(1)} m³</b></span><span>GRID <b>{project.gridSize.toFixed(2)} m</b></span></div>
            <div className="project-actions"><button onClick={saveProject}><Save size={13} /> {isAuthenticated ? "Save" : "Sign in"}</button><button onClick={exportReport}><FileJson size={13} /> Report</button></div>
            {isAuthenticated && <div className="sync-readout">CLOUD ARCHIVE / {storedProjects.data?.length ?? 0} PROJECT{storedProjects.data?.length === 1 ? "" : "S"}</div>}
          </div>

          {isAuthenticated && <BenchmarkVariantComparison activeHistory={project.benchmarkHistory} variants={comparisonRows} />}

          <div className="hud-panel scene-panel">
            <button className="panel-heading collapsible" onClick={() => setSceneOpen((current) => !current)}><span>SCENE GRAPH</span><ChevronDown size={14} className={sceneOpen ? "" : "rotate-180"} /></button>
            {sceneOpen && <div className="scene-list">
              <div className="scene-group"><span><Layers3 size={14} /> ROOM SHELL</span><small>6 SURFACES</small></div>
              {project.surfaces.map((surface) => <button key={surface.id} onClick={() => setSelectedSurface(surface.id)} className={`scene-row ${selectedSurface === surface.id ? "is-selected" : ""}`}><i>{surfaceIcons[surface.id]}</i><span>{surface.label}</span><b>{surface.materialId}</b></button>)}
              <div className="scene-group"><span><Volume2 size={14} /> SOUND NODES</span><small>{project.nodes.length}</small></div>
              {project.nodes.map((node) => <button key={node.id} onClick={() => setSelectedNodeId(node.id)} className={`scene-row node-row ${selectedNodeId === node.id ? "is-selected" : ""}`}><i>{node.kind === "source" ? "S" : "L"}</i><span>{node.label}</span><b>{node.kind}</b></button>)}
            </div>}
            <div className="add-node-controls"><button onClick={() => addNode("source")}><Plus size={14} /> Source</button><button onClick={() => addNode("listener")}><Plus size={14} /> Listener</button></div>
          </div>

          <div className="hud-panel ray-panel">
            <div className="panel-heading"><span>RAY FIELD</span><span className="warning-readout">{project.rayCount} rays</span></div>
            <label className="control-label">RAY QUALITY <output>{project.rayQuality === "custom" ? "MANUAL" : RAY_QUALITY_OPTIONS.find((option) => option.id === project.rayQuality)?.label}</output></label>
            <div className="quality-selector">{RAY_QUALITY_OPTIONS.map((option) => <button key={option.id} onClick={() => selectRayQuality(option.id)} className={project.rayQuality === option.id ? "is-selected" : ""}>{option.label}</button>)}</div>
            <button className="benchmark-button" onClick={runBenchmark} disabled={benchmarkRunning}><Activity size={13} /> BENCHMARK <span>{benchmarkRunning ? "SAMPLING LIVE FIELD" : benchmarkResult ?? "MEASURE / RECOMMEND"}</span></button>
            <label className="control-label">EMISSION DENSITY <output>{project.rayCount}</output></label>
            <input type="range" min="12" max="160" step="2" value={project.rayCount} onChange={(event) => setProject((current) => ({ ...current, rayQuality: "custom", rayCount: Number(event.target.value) }))} />
            <label className="control-label">MAX BOUNCES <output>{project.maxBounces}</output></label>
            <input type="range" min="1" max="9" value={project.maxBounces} onChange={(event) => setProject((current) => ({ ...current, maxBounces: Number(event.target.value) }))} />
            <label className="control-label">ANALYSIS BAND <output>{project.targetBand >= 1000 ? `${project.targetBand / 1000}k` : project.targetBand} Hz</output></label>
            <div className="band-selector">{OCTAVE_BANDS.map((band) => <button key={band} onClick={() => setProject((current) => ({ ...current, targetBand: band }))} className={project.targetBand === band ? "is-selected" : ""}>{band === 1000 ? "1k" : band === 2000 ? "2k" : band === 4000 ? "4k" : band === 8000 ? "8k" : band}</button>)}</div>
          </div>
          <div className="hud-panel rt60-panel">
            <div className="panel-heading"><span>RT60 / OCTAVE ANALYSIS</span><span className="warning-readout">SABINE · EYRING</span></div>
            <div className="rt-table"><div className="rt-head"><span>Hz</span><span>ᾱ</span><span>Sab</span><span>Eyr</span></div>{metrics.map((metric) => <button key={metric.band} onClick={() => setProject((current) => ({ ...current, targetBand: metric.band }))} className={project.targetBand === metric.band ? "is-selected" : ""}><span>{metric.band === 1000 ? "1k" : metric.band === 2000 ? "2k" : metric.band === 4000 ? "4k" : metric.band === 8000 ? "8k" : metric.band}</span><span>{metric.averageAbsorption.toFixed(3)}</span><span>{metric.sabine.toFixed(2)}s</span><span>{metric.eyring.toFixed(2)}s</span></button>)}</div>
          </div>
        </section>

        <section className="viewport-wrap">
          <div className="viewport-header"><span><span className="crosshair-mark">⌖</span> PERSPECTIVE / REAL-TIME RAY TRACE</span><span>ORBIT · PAN · ZOOM</span></div>
          <AcousticViewport project={project} selectedSurface={selectedSurface} selectedNodeId={selectedNodeId} onSelectSurface={setSelectedSurface} onSelectNode={setSelectedNodeId} onMoveNode={updateNodePosition} onHealthChange={updateRendererHealth} />
          <div className="viewport-card coord-card"><span>CURSOR / WORLD</span><b>{selectedNode ? formatPosition(selectedNode.position) : "0.00 / 0.00 / 0.00"}</b></div>
          <div className="viewport-card legend-card"><span><i className="dot source-dot" /> SPEAKER</span><span><i className="dot listener-dot" /> EAR / LISTENER</span><span><i className="ray-swatch" /> REFLECTION PATH</span></div>
          <div className="viewport-card scale-card"><span>0</span><i /><span>2 m</span></div>
          <div className="viewport-card health-card" aria-live="polite"><span>RENDER / {rendererHealth.status}</span><b>{rendererHealth.fps} FPS · {rendererHealth.width}×{rendererHealth.height}</b><small>DPR {rendererHealth.pixelRatio.toFixed(1)} · RZ {rendererHealth.resizeEvents}</small></div>
        </section>

        <aside className="right-stack">
          <div className="hud-panel inspector-panel">
            <button className="panel-heading collapsible" onClick={() => setInspectorOpen((current) => !current)}><span>PROPERTY INSPECTOR</span><ChevronDown size={14} className={inspectorOpen ? "" : "rotate-180"} /></button>
            {inspectorOpen && <>
              <div className="inspector-tabs"><span className={selectedNode ? "is-active" : ""}>NODE</span><span className={selectedSurface ? "is-active" : ""}>SURFACE</span></div>
              {selectedNode && <div className="property-block">
                <div className="selected-object"><div className="object-icon">{selectedNode.kind === "source" ? <Volume2 size={17} /> : <Ear size={17} />}</div><div><b>{selectedNode.label}</b><span>{selectedNode.kind === "source" ? "OMNI SPEAKER" : "BINAURAL REFERENCE"}</span></div></div>
                <label className="control-label">GAIN <output>{selectedNode.gain.toFixed(2)}</output></label>
                <input type="range" min="0" max="1" step="0.01" value={selectedNode.gain} onChange={(event) => updateNode(selectedNode.id, { gain: Number(event.target.value) })} />
                {selectedNode.kind === "source" && <><label className="control-label">FREQUENCY <output>{selectedNode.frequency.toFixed(0)} Hz</output></label><input type="range" min="80" max="1200" step="1" value={selectedNode.frequency} onChange={(event) => updateNode(selectedNode.id, { frequency: Number(event.target.value) })} /></>}
                <div className="position-grid">{(["x", "y", "z"] as const).map((axis) => <label key={axis}><span>{axis.toUpperCase()} <small>m</small></span><input type="number" step={project.gridSize} value={selectedNode.position[axis]} onChange={(event) => updateNode(selectedNode.id, { position: { ...selectedNode.position, [axis]: Number(event.target.value) } })} /></label>)}</div>
                <div className="velocity-grid"><span>VELOCITY / m·s⁻¹</span>{(["x", "y", "z"] as const).map((axis) => <label key={axis}>{axis.toUpperCase()}<input type="number" step="0.5" value={selectedNode.velocity[axis]} onChange={(event) => updateNode(selectedNode.id, { velocity: { ...selectedNode.velocity, [axis]: Number(event.target.value) } })} /></label>)}</div>
              </div>}
              <div className="surface-assignment"><div className="subheading">SURFACE MATERIAL / {selectedSurface.toUpperCase()}</div><div className="material-grid">{(Object.keys(MATERIALS) as MaterialId[]).map((materialId) => <button key={materialId} onClick={() => updateSurfaceMaterial(selectedSurface, materialId)} className={project.surfaces.find((surface) => surface.id === selectedSurface)?.materialId === materialId ? "is-selected" : ""}><i style={{ background: MATERIALS[materialId].color }} /><span>{materialId}</span></button>)}</div></div>
            </>}
          </div>

          <div className="hud-panel dimensions-panel">
            <div className="panel-heading"><span>ROOM DIMENSIONS</span><SlidersHorizontal size={14} /></div>
            {(["width", "depth", "height"] as const).map((field) => <label className="dimension-row" key={field}><span>{field === "width" ? "X / WIDTH" : field === "depth" ? "Z / DEPTH" : "Y / HEIGHT"}</span><input type="number" min="2" max="50" step="0.25" value={project.room[field]} onChange={(event) => updateDimension(field, Number(event.target.value))} /><b>m</b></label>)}
          </div>

          <div className="hud-panel doppler-panel">
            <div className="panel-heading"><span>DOPPLER MONITOR</span><span className="warning-readout">ACTIVE</span></div>
            <div className="doppler-frequency"><span>EMITTED</span><b>{source?.frequency.toFixed(0) ?? "—"}<small>Hz</small></b><i>→</i><span>PERCEIVED</span><b>{dopplerFrequency.toFixed(1)}<small>Hz</small></b></div>
            <div className="velocity-strip"><span>SRC VEL <b>{source?.velocity.x.toFixed(1) ?? "0.0"} m/s</b></span><span>LST VEL <b>{listener?.velocity.x.toFixed(1) ?? "0.0"} m/s</b></span></div>
            <div className="scope-header"><span>OSC / MASTER BUS</span><span>{isPlaying ? "RUN" : "IDLE"}</span></div>
            <Oscilloscope analyser={analyser} active={isPlaying} />
            <RendererHealthChart samples={healthHistory} />
          </div>
        </aside>
      </section>

      <footer className="studio-footer"><span>ENGINE: SPECULAR RAY TRACE / MATERIAL α TRANSMISSION</span><span>GRID SNAP {project.gridSize.toFixed(2)} m</span><span><i className="status-light" /> SOLVER STABLE</span></footer>
    </main>
  );
}
