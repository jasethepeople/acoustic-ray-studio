import { DEFAULT_PROJECT, type AcousticProjectSnapshot } from "./acoustics";

export function serializeProjectSnapshot(snapshot: AcousticProjectSnapshot) {
  return JSON.parse(JSON.stringify(snapshot)) as AcousticProjectSnapshot;
}

export function hydrateProjectSnapshot(snapshot: unknown): AcousticProjectSnapshot {
  const candidate = snapshot as Partial<AcousticProjectSnapshot> | null;
  return {
    ...DEFAULT_PROJECT,
    ...candidate,
    room: candidate?.room ?? DEFAULT_PROJECT.room,
    surfaces: candidate?.surfaces ?? DEFAULT_PROJECT.surfaces,
    nodes: candidate?.nodes ?? DEFAULT_PROJECT.nodes,
    rayQuality: candidate?.rayQuality ?? "adaptive",
    benchmarkHistory: candidate?.benchmarkHistory ?? [],
  };
}
