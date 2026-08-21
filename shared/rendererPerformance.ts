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
