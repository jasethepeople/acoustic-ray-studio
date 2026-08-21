import { describe, expect, it } from "vitest";
import { appendRendererHealthSample, averageSessionFps, calculateMeasuredFps, isSustainedLowFps, recommendQualityFromBenchmark, recommendRayCount, summarizeRendererHealth, type RendererHealth } from "../shared/rendererPerformance";
import { createFrameScheduledResize } from "../shared/rendererResize";
import { hydrateProjectSnapshot, serializeProjectSnapshot } from "../shared/projectPersistence";
import { DEFAULT_PROJECT } from "../shared/acoustics";

describe("renderer performance controls", () => {
  it("selects a smaller adaptive ray budget for compact and constrained devices", () => {
    expect(recommendRayCount("adaptive", { viewportWidth: 375, cores: 8, memoryGb: 8 })).toBe(28);
    expect(recommendRayCount("adaptive", { viewportWidth: 1440, cores: 2, memoryGb: 4 })).toBe(48);
    expect(recommendRayCount("adaptive", { viewportWidth: 1440, cores: 8, memoryGb: 8 })).toBe(84);
    expect(recommendRayCount("precision", { viewportWidth: 375 })).toBe(128);
  });

  it("recommends a profile from measured renderer frame rate and device capacity", () => {
    expect(recommendQualityFromBenchmark(60, { viewportWidth: 1440, cores: 8, memoryGb: 16 })).toBe("precision");
    expect(recommendQualityFromBenchmark(45, { viewportWidth: 768, cores: 4, memoryGb: 4 })).toBe("balanced");
    expect(recommendQualityFromBenchmark(28, { viewportWidth: 1440, cores: 12, memoryGb: 16 })).toBe("eco");
  });

  it("round-trips a non-default quality profile through the stored project snapshot", () => {
    const stored = serializeProjectSnapshot({ ...DEFAULT_PROJECT, rayQuality: "precision" });
    const restored = hydrateProjectSnapshot(JSON.parse(JSON.stringify(stored)));
    expect(restored.rayQuality).toBe("precision");
  });

  it("calculates a completed benchmark rate and retains a bounded telemetry session", () => {
    const health = (fps: number): RendererHealth => ({ fps, width: 800, height: 500, pixelRatio: 1, resizeEvents: 0, status: "STABLE" });
    expect(calculateMeasuredFps(90, 1500)).toBe(60);
    expect(appendRendererHealthSample([health(30), health(35)], health(40), 2).map((sample) => sample.fps)).toEqual([35, 40]);
    expect(averageSessionFps([health(30), health(42), health(48)])).toBe(40);
    expect(isSustainedLowFps([health(25), health(27), health(24), health(26)])).toBe(true);
    expect(isSustainedLowFps([health(25), health(27), health(24), health(31)])).toBe(false);
    expect(summarizeRendererHealth(health(48), [health(30), health(42), health(48)])).toMatchObject({ fps: 48, sessionAverageFps: 40, sessionLowFps: 30, sampleCount: 3, width: 800, height: 500, pixelRatio: 1, resizeEvents: 0, status: "STABLE" });
  });

  it("coalesces repeated resize notifications into one frame and ignores unchanged dimensions", () => {
    const frames: FrameRequestCallback[] = [];
    const applied: Array<{ width: number; height: number; resizeEvents: number }> = [];
    let size = { width: 800, height: 500 };
    const scheduler = createFrameScheduledResize({
      initialSize: size,
      readSize: () => size,
      applySize: (next, resizeEvents) => applied.push({ ...next, resizeEvents }),
      requestFrame: (callback) => {
        frames.push(callback);
        return frames.length;
      },
      cancelFrame: () => undefined,
    });

    for (let index = 0; index < 100; index += 1) scheduler.schedule();
    expect(frames).toHaveLength(1);
    frames.shift()?.(0);
    expect(applied).toHaveLength(0);

    size = { width: 820, height: 500 };
    for (let index = 0; index < 100; index += 1) scheduler.schedule();
    expect(frames).toHaveLength(1);
    frames.shift()?.(16);
    expect(applied).toEqual([{ width: 820, height: 500, resizeEvents: 1 }]);
  });
});
