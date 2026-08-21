export type RayQuality = "adaptive" | "eco" | "balanced" | "precision" | "custom";

export type RendererDeviceProfile = {
  viewportWidth: number;
  cores?: number;
  memoryGb?: number;
};

export type RendererHealth = {
  fps: number;
  width: number;
  height: number;
  pixelRatio: number;
  resizeEvents: number;
  status: "SYNC" | "STABLE";
};

export type BenchmarkRecommendation = Exclude<RayQuality, "custom">;

export const RAY_QUALITY_OPTIONS: Array<{ id: Exclude<RayQuality, "custom">; label: string }> = [
  { id: "adaptive", label: "AUTO" },
  { id: "eco", label: "ECO" },
  { id: "balanced", label: "STD" },
  { id: "precision", label: "MAX" },
];

export function recommendRayCount(quality: Exclude<RayQuality, "custom">, profile: RendererDeviceProfile) {
  if (quality === "eco") return 24;
  if (quality === "balanced") return 64;
  if (quality === "precision") return 128;
  const isCompact = profile.viewportWidth < 760;
  const constrained = (profile.cores ?? 8) <= 4 || (profile.memoryGb ?? 8) <= 4;
  if (isCompact) return 28;
  if (constrained) return 48;
  return 84;
}

export function recommendQualityFromBenchmark(fps: number, profile: RendererDeviceProfile): BenchmarkRecommendation {
  const capableDesktop = profile.viewportWidth >= 1024 && (profile.cores ?? 0) >= 8 && (profile.memoryGb ?? 0) >= 8;
  if (fps >= 54 && capableDesktop) return "precision";
  if (fps >= 38) return "balanced";
  return "eco";
}

export function calculateMeasuredFps(renderedFrames: number, elapsedMilliseconds: number) {
  return Math.max(0, Math.round((renderedFrames * 1000) / Math.max(1, elapsedMilliseconds)));
}

export function appendRendererHealthSample(history: RendererHealth[], sample: RendererHealth, limit = 72) {
  return [...history, sample].slice(-limit);
}
