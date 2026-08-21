export type RendererSize = { width: number; height: number };

type ResizeSchedulerOptions = {
  initialSize: RendererSize;
  readSize: () => RendererSize;
  applySize: (size: RendererSize, resizeEvents: number) => void;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (frameId: number) => void;
};

export function createFrameScheduledResize({ initialSize, readSize, applySize, requestFrame = requestAnimationFrame, cancelFrame = cancelAnimationFrame }: ResizeSchedulerOptions) {
  let frameId: number | null = null;
  let applied = initialSize;
  let resizeEvents = 0;

  const schedule = () => {
    if (frameId !== null) return;
    frameId = requestFrame(() => {
      frameId = null;
      const next = readSize();
      if (next.width === applied.width && next.height === applied.height) return;
      applied = next;
      resizeEvents += 1;
      applySize(next, resizeEvents);
    });
  };

  return {
    schedule,
    cancel: () => {
      if (frameId === null) return;
      cancelFrame(frameId);
      frameId = null;
    },
    getResizeEvents: () => resizeEvents,
  };
}
