import { calculateBandMetrics, roomVolume } from "./acousticMath";
import { MATERIALS, type AcousticProjectSnapshot } from "./acoustics";

export function createAcousticReport(project: AcousticProjectSnapshot) {
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
    rayTrace: { rayCount: project.rayCount, maxBounces: project.maxBounces, analysisBand: project.targetBand },
    rt60: calculateBandMetrics(project),
  };
}
