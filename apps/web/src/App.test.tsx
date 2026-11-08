import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HealthResponse } from "@polling/shared";
import { App } from "./App.tsx";

const health: HealthResponse = {
  status: "ok",
  service: "polling-api",
  database: "connected",
};

afterEach(() => vi.restoreAllMocks());

describe("polling screen", () => {
  it("shows a product unavailable state without setup commentary or invented poll data", async () => {
    render(<App checkHealth={vi.fn().mockResolvedValue(health)} />);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Voting is currently unavailable.");
    });
    expect(screen.getByRole("heading", { name: "Polls", level: 1 })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Active poll", level: 2 })).toBeVisible();
    expect(screen.queryByText(/interview|setup|repository|React|Node\.js|PostgreSQL|workspace|not implemented/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /vote/i })).not.toBeInTheDocument();
  });

  it("renders an actionable error and allows retry", async () => {
    const checkHealth = vi.fn()
      .mockRejectedValueOnce(new Error("PostgreSQL is unavailable"))
      .mockResolvedValueOnce(health);
    const logError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<App checkHealth={checkHealth} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't connect. Please try again.");
    expect(screen.queryByText(/PostgreSQL/)).not.toBeInTheDocument();
    expect(logError).toHaveBeenCalledWith("Unable to connect to the polling service", expect.any(Error));
    const retry = screen.getByRole("button", { name: "Try again" });
    retry.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Voting is currently unavailable.");
    });
    expect(checkHealth).toHaveBeenCalledTimes(2);
  });

  it("aborts an in-flight check when the screen unmounts", () => {
    let signal: AbortSignal | undefined;
    const checkHealth = vi.fn((receivedSignal: AbortSignal) => {
      signal = receivedSignal;
      return new Promise<HealthResponse>(() => {});
    });
    const { unmount } = render(<App checkHealth={checkHealth} />);

    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
