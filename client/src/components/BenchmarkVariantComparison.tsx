import type { BenchmarkSummary } from "@shared/acoustics";
import React from "react";

type Variant = { id: number; name: string; history: BenchmarkSummary[] };

export default function BenchmarkVariantComparison({ activeHistory, variants }: { activeHistory: BenchmarkSummary[]; variants: Variant[] }) {
  const active = activeHistory.at(-1);
  return <div className="hud-panel comparison-panel"><div className="panel-heading"><span>VARIANT BENCHMARKS</span><span className="warning-readout">ARCHIVE</span></div><div className="comparison-current"><span>ACTIVE FIELD</span><b>{active?.measuredFps ?? "—"} FPS</b></div>{variants.length ? variants.slice(0, 4).map((variant) => <div className="comparison-row" key={variant.id}><div><span>{variant.name}</span><div className="comparison-samples" aria-label={`${variant.name} benchmark history`}>{variant.history.slice(-6).map((sample, index) => <i key={`${sample.sampledAt}-${index}`} title={`${sample.measuredFps} FPS / ${sample.recommendation}`}>{sample.measuredFps}</i>)}</div></div><b>{variant.history.at(-1)?.measuredFps} FPS</b><small>{variant.history.at(-1)?.recommendation.toUpperCase()}</small></div>) : <div className="comparison-empty">SAVE BENCHMARKED VARIANTS TO COMPARE</div>}</div>;
}
