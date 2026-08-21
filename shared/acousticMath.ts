import {
  MATERIALS,
  OCTAVE_BANDS,
  type AcousticProjectSnapshot,
  type BandMetric,
  type OctaveBand,
  type RaySegment,
  type RoomDimensions,
  type SurfaceRole,
  type Vec3,
} from "./acoustics";

const SPEED_OF_SOUND = 343;

export function surfaceAreas(room: RoomDimensions): Record<SurfaceRole, number> {
  const { width, depth, height } = room;
  return {
    floor: width * depth,
    ceiling: width * depth,
    north: width * height,
    south: width * height,
    east: depth * height,
    west: depth * height,
  };
}

export function roomVolume(room: RoomDimensions) {
  return room.width * room.depth * room.height;
}

export function calculateBandMetrics(project: AcousticProjectSnapshot): BandMetric[] {
  const areas = surfaceAreas(project.room);
  const totalArea = Object.values(areas).reduce((sum, area) => sum + area, 0);
  const volume = roomVolume(project.room);

  return OCTAVE_BANDS.map((band) => {
    const absorptionArea = project.surfaces.reduce((sum, surface) => {
      return sum + areas[surface.id] * MATERIALS[surface.materialId].absorption[band];
    }, 0);
    const averageAbsorption = Math.min(0.9999, Math.max(0.0001, absorptionArea / totalArea));
    return {
      band,
      absorptionArea,
      averageAbsorption,
      sabine: 0.161 * volume / Math.max(absorptionArea, 0.0001),
      eyring: 0.161 * volume / Math.max(-totalArea * Math.log(1 - averageAbsorption), 0.0001),
    };
  });
}

export function snapToGrid(value: number, gridSize: number) {
  return Math.round(value / gridSize) * gridSize;
}

export function vecLength(vector: Vec3) {
  return Math.hypot(vector.x, vector.y, vector.z);
}

export function normalize(vector: Vec3): Vec3 {
  const length = vecLength(vector) || 1;
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

export function dot(a: Vec3, b: Vec3) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function estimateDopplerFrequency(
  emittedFrequency: number,
  sourcePosition: Vec3,
  sourceVelocity: Vec3,
  listenerPosition: Vec3,
  listenerVelocity: Vec3,
) {
  const direction = normalize({
    x: listenerPosition.x - sourcePosition.x,
    y: listenerPosition.y - sourcePosition.y,
    z: listenerPosition.z - sourcePosition.z,
  });
  const sourceRadial = dot(sourceVelocity, direction);
  const listenerRadial = dot(listenerVelocity, direction);
  return emittedFrequency * ((SPEED_OF_SOUND - listenerRadial) / Math.max(1, SPEED_OF_SOUND - sourceRadial));
}

function pointAlong(origin: Vec3, direction: Vec3, distance: number): Vec3 {
  return {
    x: origin.x + direction.x * distance,
    y: origin.y + direction.y * distance,
    z: origin.z + direction.z * distance,
  };
}

type SurfaceHit = { distance: number; surfaceId: SurfaceRole; normal: Vec3 };

function nextAxisAlignedHit(origin: Vec3, direction: Vec3, room: RoomDimensions): SurfaceHit | null {
  const halfW = room.width / 2;
  const halfD = room.depth / 2;
  const candidates: SurfaceHit[] = [];
  if (direction.x > 0) candidates.push({ distance: (halfW - origin.x) / direction.x, surfaceId: "east", normal: { x: -1, y: 0, z: 0 } });
  if (direction.x < 0) candidates.push({ distance: (-halfW - origin.x) / direction.x, surfaceId: "west", normal: { x: 1, y: 0, z: 0 } });
  if (direction.y > 0) candidates.push({ distance: (room.height - origin.y) / direction.y, surfaceId: "ceiling", normal: { x: 0, y: -1, z: 0 } });
  if (direction.y < 0) candidates.push({ distance: -origin.y / direction.y, surfaceId: "floor", normal: { x: 0, y: 1, z: 0 } });
  if (direction.z > 0) candidates.push({ distance: (halfD - origin.z) / direction.z, surfaceId: "north", normal: { x: 0, y: 0, z: -1 } });
  if (direction.z < 0) candidates.push({ distance: (-halfD - origin.z) / direction.z, surfaceId: "south", normal: { x: 0, y: 0, z: 1 } });
  return candidates.filter((candidate) => candidate.distance > 0.0001).sort((a, b) => a.distance - b.distance)[0] ?? null;
}

export function traceRay(
  origin: Vec3,
  initialDirection: Vec3,
  project: AcousticProjectSnapshot,
  band: OctaveBand = project.targetBand,
): RaySegment[] {
  const materialBySurface = new Map(project.surfaces.map((surface) => [surface.id, surface.materialId]));
  const segments: RaySegment[] = [];
  let point = origin;
  let direction = normalize(initialDirection);
  let energy = 1;

  for (let bounce = 0; bounce < project.maxBounces && energy > 0.025; bounce += 1) {
    const hit = nextAxisAlignedHit(point, direction, project.room);
    if (!hit) break;
    const end = pointAlong(point, direction, hit.distance);
    const material = MATERIALS[materialBySurface.get(hit.surfaceId) ?? "concrete"];
    energy *= 1 - material.absorption[band];
    segments.push({ from: point, to: end, energy, bounce, surfaceId: hit.surfaceId });
    const normalDot = dot(direction, hit.normal);
    direction = normalize({
      x: direction.x - 2 * normalDot * hit.normal.x,
      y: direction.y - 2 * normalDot * hit.normal.y,
      z: direction.z - 2 * normalDot * hit.normal.z,
    });
    point = pointAlong(end, direction, 0.002);
  }
  return segments;
}
