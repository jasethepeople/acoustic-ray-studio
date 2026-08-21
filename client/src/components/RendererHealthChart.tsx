import type { RendererHealth } from "@shared/rendererPerformance";
import React, { useMemo } from "react";

export default function RendererHealthChart({ samples }: { samples: RendererHealth[] }) {
  const { points, average } = useMemo(() => {
    const fps = samples.map((sample) => sample.fps);
    const max = Math.max(60, ...fps);
    const min = Math.min(20, ...fps);
    const span = Math.max(1, max - min);
    const points = fps.map((value, index) => `${(index / Math.max(1, fps.length - 1)) * 260 + 4},${52 - ((value - min) / span) * 44}`).join(" ");
    const average = fps.length ? Math.round(fps.reduce((sum, value) => sum + value, 0) / fps.length) : 0;
    return { points, average };
  }, [samples]);

  return <div className="health-chart" aria-label={`Renderer frame rate history. Average ${average} FPS.`}>
    <div className="health-chart-head"><span>SESSION FPS</span><b>{average || "—"} AVG</b></div>
    <svg viewBox="0 0 268 56" role="img" aria-label="Renderer frames per second history"><path d="M4 52H264M4 28H264M4 4H264" /><polyline points={points || "4,52"} /></svg>
    <div className="health-chart-foot"><span>EARLIEST</span><span>{samples.length} SAMPLES</span><span>NOW</span></div>
  </div>;
}
