import { useEffect, useRef } from "react";
import React from "react";

export default function Oscilloscope({ analyser, active }: { analyser: AnalyserNode | null; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let frame = 0;
    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      context.fillStyle = "#090906";
      context.fillRect(0, 0, width, height);
      context.strokeStyle = "rgba(255,165,0,.14)";
      context.lineWidth = 1;
      for (let x = 0; x < width; x += 24) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
      for (let y = 0; y < height; y += 16) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
      const data = analyser ? new Uint8Array(analyser.fftSize) : null;
      if (analyser && active) analyser.getByteTimeDomainData(data!);
      context.strokeStyle = "#FFA500";
      context.lineWidth = 1.2;
      context.shadowBlur = 6;
      context.shadowColor = "rgba(255,165,0,.7)";
      context.beginPath();
      for (let index = 0; index < width; index += 1) {
        const dataIndex = Math.floor(index / width * (data?.length ?? width));
        const idle = Math.sin(index * 0.055) * (active ? 0.5 : 0.015);
        const sample = data && active ? (data[dataIndex] - 128) / 128 : idle;
        const y = height / 2 + sample * height * 0.31;
        if (index === 0) context.moveTo(index, y); else context.lineTo(index, y);
      }
      context.stroke();
      context.shadowBlur = 0;
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [analyser, active]);
  return <canvas ref={canvasRef} className="oscilloscope-canvas" width="300" height="72" aria-label="Live audio waveform oscilloscope" />;
}
