import { calculateBandMetrics, roomVolume } from "./acousticMath";
import { MATERIALS, type AcousticProjectSnapshot } from "./acoustics";
import type { RendererHealthSummary } from "./rendererPerformance";

export function createAcousticReport(project: AcousticProjectSnapshot, rendererHealth: RendererHealthSummary | null = null) {
  return {
    title: "Acoustic Ray Studio Report",
    generatedAt: new Date().toISOString(),
    units: { dimensions: "metres", volume: "cubic metres", rt60: "seconds", absorption: "sabins" },
    room: project.room,
    volume: roomVolume(project.room),
    materialMap: project.surfaces.map((surface) => ({
      ...surface,
      material: MATERIALS[surface.materialId].label,
      absorptionCoefficients: MATERIALS[surface.materialId].absorption,
    })),
    nodes: project.nodes,
    rayTrace: { rayCount: project.rayCount, qualityProfile: project.rayQuality, maxBounces: project.maxBounces, analysisBand: project.targetBand },
    performance: {
      latestBenchmark: project.benchmarkHistory.at(-1) ?? null,
      benchmarkHistory: project.benchmarkHistory,
      rendererHealth,
    },
    rt60: calculateBandMetrics(project),
  };
}
