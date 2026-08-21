import { describe, expect, it } from "vitest";
import { recommendRayCount } from "../shared/rendererPerformance";
import { createFrameScheduledResize } from "../shared/rendererResize";

describe("renderer performance controls", () => {
  it("selects a smaller adaptive ray budget for compact and constrained devices", () => {
    expect(recommendRayCount("adaptive", { viewportWidth: 375, cores: 8, memoryGb: 8 })).toBe(28);
    expect(recommendRayCount("adaptive", { viewportWidth: 1440, cores: 2, memoryGb: 4 })).toBe(48);
    expect(recommendRayCount("adaptive", { viewportWidth: 1440, cores: 8, memoryGb: 8 })).toBe(84);
    expect(recommendRayCount("precision", { viewportWidth: 375 })).toBe(128);
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
