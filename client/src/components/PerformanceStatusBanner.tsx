import { AlertTriangle } from "lucide-react";
import React from "react";

export type PerformanceState = "nominal" | "low" | "recovered";

export default function PerformanceStatusBanner({ state }: { state: PerformanceState }) {
  if (state === "low") return <div className="performance-alert" role="alert"><AlertTriangle size={15} /> RENDER RATE LOW / FOUR SAMPLES BELOW 28 FPS · SELECT ECO OR RUN BENCHMARK</div>;
  if (state === "recovered") return <div className="performance-recovered" role="status">RENDER RATE NOMINAL / TELEMETRY BACK WITHIN OPERATING RANGE</div>;
  return null;
}
