import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.tsx";
import { ApiError } from "./api/polls.ts";
import { getUserId, mockApi, offlineUpdates, poll, votedResults } from "./test/poll.ts";

afterEach(() => vi.restoreAllMocks());

describe("polling screen", () => {
  it("shows real poll choices and supports keyboard voting", async () => {
    const api = mockApi();
    render(<App api={api} getUserId={getUserId} updates={offlineUpdates} />);
    expect(await screen.findByRole("heading", { name: poll.question, level: 2 })).toBeVisible();
    expect(screen.getByText("4 votes")).toBeVisible();
    const option = screen.getByRole("radio", { name: "Dark mode" });
    option.focus();
    await userEvent.keyboard(" ");
    api.getResults.mockResolvedValue(votedResults);
    await userEvent.click(screen.getByRole("button", { name: "Cast Your Vote" }));
    expect(await screen.findByText("Your vote is recorded.")).toBeVisible();
    expect(screen.getByText("5 votes")).toBeVisible();
    expect(screen.getByRole("button", { name: "Vote recorded" })).toBeDisabled();
    expect(screen.queryByText(/interview|setup|repository|PostgreSQL|workspace/i)).not.toBeInTheDocument();
  });

  it("renders contextual rollback errors and permits a retry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const api = mockApi();
    api.submitVote.mockRejectedValueOnce(new ApiError(500, "SIMULATED_FAILURE", "Your vote wasn't saved. Please try again."));
    render(<App api={api} getUserId={getUserId} updates={offlineUpdates} />);
    await userEvent.click(await screen.findByRole("radio", { name: "Dark mode" }));
    await userEvent.click(screen.getByRole("button", { name: "Cast Your Vote" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your vote wasn't saved");
    expect(screen.getByText("4 votes")).toBeVisible();
    expect(screen.getByRole("button", { name: "Cast Your Vote" })).toBeEnabled();
  });

  it("renders an actionable loading error and retries", async () => {
    const api = mockApi();
    api.getActivePolls.mockRejectedValueOnce(new Error("Offline")).mockResolvedValue([poll]);
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<App api={api} getUserId={getUserId} updates={offlineUpdates} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't load");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: poll.question, level: 2 })).toBeVisible();
    await waitFor(() => expect(api.getActivePolls).toHaveBeenCalledTimes(2));
  });

  it("shows no active poll honestly instead of inventing poll data", async () => {
    const api = mockApi();
    api.getActivePolls.mockResolvedValue([]);
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<App api={api} getUserId={getUserId} updates={offlineUpdates} />);
    expect(await screen.findByText("No active poll is available.")).toBeVisible();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});
