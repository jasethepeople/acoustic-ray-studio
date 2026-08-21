import type { RayQuality } from "./rendererPerformance";

export const OCTAVE_BANDS = [125, 250, 500, 1000, 2000, 4000, 8000] as const;

export type OctaveBand = (typeof OCTAVE_BANDS)[number];
export type Vec3 = { x: number; y: number; z: number };
export type MaterialId = "concrete" | "glass" | "wood";
export type SurfaceRole = "floor" | "ceiling" | "north" | "south" | "east" | "west";

export type MaterialDefinition = {
  id: MaterialId;
  label: string;
  color: string;
  absorption: Record<OctaveBand, number>;
};

export const MATERIALS: Record<MaterialId, MaterialDefinition> = {
  concrete: {
    id: "concrete",
    label: "Concrete — poured rough",
    color: "#8a857d",
    absorption: { 125: 0.01, 250: 0.02, 500: 0.04, 1000: 0.06, 2000: 0.08, 4000: 0.1, 8000: 0.1 },
  },
  glass: {
    id: "glass",
    label: "Glass — 6 mm plate",
    color: "#7fa9b6",
    absorption: { 125: 0.18, 250: 0.06, 500: 0.04, 1000: 0.03, 2000: 0.02, 4000: 0.02, 8000: 0.02 },
  },
  wood: {
    id: "wood",
    label: "Wood — flooring on joists",
    color: "#a36a32",
    absorption: { 125: 0.15, 250: 0.11, 500: 0.1, 1000: 0.07, 2000: 0.06, 4000: 0.07, 8000: 0.08 },
  },
};

export type RoomDimensions = { width: number; depth: number; height: number };

export type RoomSurface = {
  id: SurfaceRole;
  label: string;
  materialId: MaterialId;
};

export type AcousticNode = {
  id: string;
  kind: "source" | "listener";
  label: string;
  position: Vec3;
  velocity: Vec3;
  gain: number;
  frequency: number;
  muted?: boolean;
};

export type BenchmarkSummary = {
  measuredFps: number;
  recommendation: Exclude<RayQuality, "custom">;
  sampledAt: string;
  sessionAverageFps: number;
  sampleCount: number;
};

export type AcousticProjectSnapshot = {
  room: RoomDimensions;
  surfaces: RoomSurface[];
  nodes: AcousticNode[];
  rayCount: number;
  rayQuality: RayQuality;
  benchmarkHistory: BenchmarkSummary[];
  maxBounces: number;
  targetBand: OctaveBand;
  gridSize: number;
};

export const DEFAULT_PROJECT: AcousticProjectSnapshot = {
  room: { width: 12, depth: 8, height: 3.6 },
  surfaces: [
    { id: "floor", label: "Floor", materialId: "wood" },
    { id: "ceiling", label: "Ceiling", materialId: "concrete" },
    { id: "north", label: "North wall", materialId: "concrete" },
    { id: "south", label: "South wall", materialId: "glass" },
    { id: "east", label: "East wall", materialId: "concrete" },
    { id: "west", label: "West wall", materialId: "wood" },
  ],
  nodes: [
    { id: "src-1", kind: "source", label: "S-01 / Program", position: { x: -3, y: 1.35, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, gain: 0.65, frequency: 440 },
    { id: "lst-1", kind: "listener", label: "L-01 / Reference", position: { x: 2.4, y: 1.6, z: 0.8 }, velocity: { x: 0, y: 0, z: 0 }, gain: 1, frequency: 0 },
  ],
  rayCount: 42,
  rayQuality: "adaptive",
  benchmarkHistory: [],
  maxBounces: 5,
  targetBand: 1000,
  gridSize: 0.25,
};

export type RaySegment = {
  from: Vec3;
  to: Vec3;
  energy: number;
  bounce: number;
  surfaceId: SurfaceRole;
};

export type BandMetric = {
  band: OctaveBand;
  absorptionArea: number;
  averageAbsorption: number;
  sabine: number;
  eyring: number;
};
