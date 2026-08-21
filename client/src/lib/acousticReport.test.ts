import { describe, expect, it } from "vitest";
import { createAcousticReport } from "@shared/acousticReport";
import { DEFAULT_PROJECT, OCTAVE_BANDS } from "@shared/acoustics";
import type { RendererHealthSummary } from "@shared/rendererPerformance";

describe("acoustic report export", () => {
  it("includes the full material map and multi-band RT60 values", () => {
    const rendererHealth: RendererHealthSummary = { fps: 47, width: 1280, height: 720, pixelRatio: 2, resizeEvents: 4, status: "STABLE", sessionAverageFps: 44, sessionLowFps: 32, sampleCount: 12 };
    const report = createAcousticReport({
      ...DEFAULT_PROJECT,
      benchmarkHistory: [{ measuredFps: 47, recommendation: "balanced", sampledAt: "2026-08-21T00:00:00.000Z", sessionAverageFps: 44, sampleCount: 12 }],
    }, rendererHealth);
    expect(report.materialMap).toHaveLength(6);
    expect(report.materialMap.find((surface) => surface.id === "floor")?.absorptionCoefficients[1000]).toBeGreaterThan(0);
    expect(report.rt60.map((metric) => metric.band)).toEqual(OCTAVE_BANDS);
    expect(report.rt60.every((metric) => metric.sabine > 0 && metric.eyring > 0)).toBe(true);
    expect(report.rayTrace.qualityProfile).toBe(DEFAULT_PROJECT.rayQuality);
    expect(report.performance.latestBenchmark).toMatchObject({ measuredFps: 47, recommendation: "balanced", sessionAverageFps: 44, sampleCount: 12 });
    expect(report.performance.benchmarkHistory).toHaveLength(1);
    expect(report.performance.rendererHealth).toEqual(rendererHealth);
  });
});
