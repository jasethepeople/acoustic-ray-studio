import { describe, expect, it } from "vitest";
import { createAcousticReport } from "@shared/acousticReport";
import { DEFAULT_PROJECT, OCTAVE_BANDS } from "@shared/acoustics";

describe("acoustic report export", () => {
  it("contains the complete room material map and all configured RT60 octave bands", () => {
    const report = createAcousticReport(DEFAULT_PROJECT);
    expect(report.materialMap).toHaveLength(6);
    expect(report.materialMap.find((surface) => surface.id === "floor")?.absorptionCoefficients[1000]).toBeGreaterThan(0);
    expect(report.rt60.map((metric) => metric.band)).toEqual(OCTAVE_BANDS);
    expect(report.rt60.every((metric) => metric.sabine > 0 && metric.eyring > 0)).toBe(true);
  });
});
