// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, vi, describe, expect, it } from "vitest";
import RendererHealthChart from "@/components/RendererHealthChart";
import type { RendererHealth } from "@shared/rendererPerformance";

vi.mock("@/components/AcousticViewport", () => ({ default: () => <div data-testid="acoustic-viewport" /> }));
vi.mock("@/components/Oscilloscope", () => ({ default: () => null }));
vi.mock("@/hooks/useAcousticAudio", () => ({
  useAcousticAudio: () => ({ analyser: null, audioError: null, isPlaying: false, isRecording: false, start: vi.fn(), stop: vi.fn(), toggleRecording: vi.fn() }),
}));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock("@/const", () => ({ startLogin: vi.fn() }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    acousticProjects: {
      list: { useQuery: () => ({ data: [] }) },
      save: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

import Home from "./Home";

let scheduledFrames: FrameRequestCallback[] = [];

beforeEach(() => {
  scheduledFrames = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    scheduledFrames.push(callback);
    return scheduledFrames.length;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("acoustic workstation node controls", () => {
  it("adds a new source node to the scene graph", async () => {
    const user = userEvent.setup();
    render(<Home />);
    await user.click(screen.getByRole("button", { name: /^Source$/ }));
    expect(screen.getAllByText("S-02 / Tone").length).toBeGreaterThan(0);
  });

  it("benchmarks the live renderer sample and applies its recommended quality profile", async () => {
    const user = userEvent.setup();
    render(<Home />);
    await user.click(screen.getByRole("button", { name: /benchmark/i }));
    expect(screen.getByText("SAMPLING LIVE FIELD")).toBeTruthy();
    let timestamp = performance.now();
    while (scheduledFrames.length > 0) {
      const frame = scheduledFrames.shift();
      timestamp += 300;
      await act(async () => frame?.(timestamp));
    }
    expect(screen.getByText(/[A-Z]+ · \d+ FPS/)).toBeTruthy();
  });

  it("renders accumulated renderer-health samples in the session history chart", () => {
    const samples: RendererHealth[] = [
      { fps: 42, width: 800, height: 500, pixelRatio: 1, resizeEvents: 0, status: "STABLE" },
      { fps: 48, width: 800, height: 500, pixelRatio: 1, resizeEvents: 1, status: "STABLE" },
    ];
    render(<RendererHealthChart samples={samples} />);
    expect(screen.getByLabelText(/Average 45 FPS/)).toBeTruthy();
    expect(screen.getByText("2 SAMPLES")).toBeTruthy();
  });
});
