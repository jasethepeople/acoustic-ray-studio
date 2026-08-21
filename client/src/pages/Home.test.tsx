// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { vi, describe, expect, it } from "vitest";

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

describe("acoustic workstation node controls", () => {
  it("adds a new source node to the scene graph", async () => {
    const user = userEvent.setup();
    render(<Home />);
    await user.click(screen.getByRole("button", { name: /^Source$/ }));
    expect(screen.getAllByText("S-02 / Tone").length).toBeGreaterThan(0);
  });
});
