import { describe, expect, it, vi } from "vitest";
import { createVoteService } from "./voteService.ts";

const poll = { id: "poll", question: "Question", active: true, options: [{ id: "option", label: "Option" }] };
function repository() {
  return {
    getActivePoll: vi.fn(),
    getActivePolls: vi.fn(),
    getResults: vi.fn(),
    getPoll: vi.fn().mockResolvedValue(poll),
    insertVote: vi.fn().mockResolvedValue(true),
  };
}

describe("vote service", () => {
  it("acknowledges only a completed database insert", async () => {
    const repo = repository();
    await expect(createVoteService(repo, () => false)("poll", "option", "user"))
      .resolves.toEqual({ pollId: "poll", optionId: "option" });
    expect(repo.insertVote).toHaveBeenCalledWith("poll", "option", "user");
  });
  it("validates options before simulating failures or writing", async () => {
    const repo = repository();
    const fail = vi.fn(() => true);
    await expect(createVoteService(repo, fail)("poll", "foreign-option", "user"))
      .rejects.toMatchObject({ status: 400, code: "INVALID_REQUEST" });
    expect(repo.insertVote).not.toHaveBeenCalled();
    expect(fail).not.toHaveBeenCalled();
  });
  it("simulated failures never write", async () => {
    const repo = repository();
    await expect(createVoteService(repo, () => true)("poll", "option", "user"))
      .rejects.toMatchObject({ status: 500, code: "SIMULATED_FAILURE" });
    expect(repo.insertVote).not.toHaveBeenCalled();
  });
  it("maps an insert conflict to duplicate voting", async () => {
    const repo = repository();
    repo.insertVote.mockResolvedValue(false);
    await expect(createVoteService(repo, () => false)("poll", "option", "user"))
      .rejects.toMatchObject({ status: 409, code: "ALREADY_VOTED" });
  });
  it("propagates unexpected database failures rather than mislabeling them as duplicates", async () => {
    const repo = repository();
    const failure = new Error("Database disconnected");
    repo.insertVote.mockRejectedValue(failure);
    await expect(createVoteService(repo, () => false)("poll", "option", "user")).rejects.toBe(failure);
  });
  it("rejects a poll that closes between validation and insertion", async () => {
    const repo = repository();
    repo.insertVote.mockResolvedValue(false);
    repo.getPoll.mockResolvedValueOnce(poll).mockResolvedValueOnce({ ...poll, active: false });
    await expect(createVoteService(repo, () => false)("poll", "option", "user"))
      .rejects.toMatchObject({ status: 409, code: "POLL_CLOSED" });
  });
});
