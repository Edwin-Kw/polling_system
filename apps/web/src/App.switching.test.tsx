import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VoteResponse } from "@polling/shared";
import { App } from "./App.tsx";
import { ApiError } from "./api/polls.ts";
import {
  deferred, getUserId, mockApi, offlineUpdates, poll, results, secondPoll, secondResults,
} from "./test/poll.ts";

afterEach(() => vi.restoreAllMocks());
function multiplePollsApi() {
  const api = mockApi();
  api.getActivePolls.mockResolvedValue([poll, secondPoll]);
  api.getResults.mockImplementation(async (id) => id === secondPoll.id ? secondResults : results);
  return api;
}
async function choosePoll(question: string) {
  await userEvent.click(screen.getByRole("combobox", { name: "Switch active poll" }));
  await userEvent.click(await screen.findByRole("option", { name: question }));
}

describe("active poll dropdown user journeys", () => {
  it("switches both questions and results without carrying an unsubmitted answer", async () => {
    const api = multiplePollsApi();
    render(<App api={api} getUserId={getUserId} updates={offlineUpdates} />);
    await userEvent.click(await screen.findByRole("radio", { name: "Dark mode" }));
    const dropdown = screen.getByRole("combobox", { name: "Switch active poll" });
    expect(dropdown).toHaveTextContent(poll.question);
    await userEvent.click(dropdown);
    expect(screen.getAllByRole("option")).toHaveLength(2);
    await userEvent.click(screen.getByRole("option", { name: secondPoll.question }));
    expect(await screen.findByRole("heading", { name: secondPoll.question, level: 2 })).toBeVisible();
    expect(screen.getByRole("heading", { name: secondPoll.question, level: 3 })).toBeVisible();
    expect(screen.getByText("0 votes")).toBeVisible();
    expect(screen.queryByRole("radio", { name: "Dark mode" })).not.toBeInTheDocument();
    for (const radio of screen.getAllByRole("radio")) expect(radio).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Cast Your Vote" })).toBeDisabled();
    await choosePoll(poll.question);
    expect(await screen.findByRole("radio", { name: "Dark mode" })).not.toBeChecked();
    expect(screen.getByText("4 votes")).toBeVisible();
    expect(api.submitVote).not.toHaveBeenCalled();
  });

  it("votes for the selected poll, locks switching while pending, and isolates its confirmation", async () => {
    const api = multiplePollsApi();
    const submission = deferred<VoteResponse>();
    api.submitVote.mockReturnValue(submission.promise);
    render(<App api={api} getUserId={getUserId} updates={offlineUpdates} />);
    await screen.findByRole("radio", { name: "Dark mode" });
    const dropdown = screen.getByRole("combobox", { name: "Switch active poll" });
    await choosePoll(secondPoll.question);
    await userEvent.click(await screen.findByRole("radio", { name: "Redux Toolkit" }));
    await userEvent.click(screen.getByRole("button", { name: "Cast Your Vote" }));
    expect(dropdown).toBeDisabled();
    expect(screen.getByText(/1 vote.*Includes your pending vote/)).toBeVisible();
    const optionId = secondPoll.options[0]!.id;
    expect(api.submitVote).toHaveBeenCalledWith(secondPoll.id, optionId, getUserId(), expect.any(AbortSignal));
    const confirmed = {
      ...secondResults, myVote: optionId, totalVotes: 1,
      options: secondResults.options.map((option) => ({ ...option, count: option.id === optionId ? 1 : 0 })),
    };
    api.getResults.mockImplementation(async (id) => id === secondPoll.id ? confirmed : results);
    await act(async () => submission.resolve({ pollId: secondPoll.id, optionId }));
    expect(await screen.findByRole("button", { name: "Vote recorded" })).toBeDisabled();
    expect(dropdown).toBeEnabled();
    await choosePoll(poll.question);
    expect(await screen.findByRole("radio", { name: "Dark mode" })).toBeEnabled();
    expect(screen.queryByText("Your vote is recorded.")).not.toBeInTheDocument();
    await choosePoll(secondPoll.question);
    expect(await screen.findByText("Your vote is recorded.")).toBeVisible();
    expect(screen.getByRole("radio", { name: "Redux Toolkit" })).toBeChecked();
    expect(screen.getByText("1 vote")).toBeVisible();
  });

  it("shows a real rollback notice and clears it when changing polls", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const api = multiplePollsApi();
    api.submitVote.mockRejectedValue(new ApiError(500, "SIMULATED_FAILURE", "Your vote wasn't saved. Please try again."));
    render(<App api={api} getUserId={getUserId} updates={offlineUpdates} />);
    await userEvent.click(await screen.findByRole("radio", { name: "Dark mode" }));
    await userEvent.click(screen.getByRole("button", { name: "Cast Your Vote" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your vote wasn't saved");
    expect(screen.getByText("4 votes")).toBeVisible();
    await choosePoll(secondPoll.question);
    expect(await screen.findByRole("radio", { name: "Redux Toolkit" })).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("0 votes")).toBeVisible();
  });
});
