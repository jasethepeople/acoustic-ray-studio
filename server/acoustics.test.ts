import { describe, expect, it } from "vitest";
import { calculateBandMetrics, estimateDopplerFrequency, snapToGrid, traceRay } from "../shared/acousticMath";
import { DEFAULT_PROJECT } from "../shared/acoustics";

describe("acoustic simulation utilities", () => {
  it("derives band-specific RT60 values directly from assigned surface materials", () => {
    const metrics = calculateBandMetrics(DEFAULT_PROJECT);
    const atOneKilohertz = metrics.find((metric) => metric.band === 1000);
    const at125Hz = metrics.find((metric) => metric.band === 125);
    expect(metrics).toHaveLength(7);
    expect(atOneKilohertz?.absorptionArea).toBeGreaterThan(0);
    expect(atOneKilohertz?.sabine).toBeGreaterThan(0);
    expect(at125Hz?.sabine).not.toBe(atOneKilohertz?.sabine);
  });

  it("quantizes positions and produces physically directional Doppler shifts", () => {
    expect(snapToGrid(1.13, 0.25)).toBe(1.25);
    const shifted = estimateDopplerFrequency(440, { x: 0, y: 1, z: 0 }, { x: 20, y: 0, z: 0 }, { x: 10, y: 1, z: 0 }, { x: 0, y: 0, z: 0 });
    expect(shifted).toBeGreaterThan(440);
  });

  it("applies material absorption on each reflected ray segment", () => {
    const segments = traceRay({ x: 0, y: 1.5, z: 0 }, { x: 1, y: 0.1, z: 0.2 }, DEFAULT_PROJECT, 1000);
    expect(segments.length).toBeGreaterThan(1);
    expect(segments[1]?.energy).toBeLessThan(segments[0]?.energy ?? 1);
  });
});
