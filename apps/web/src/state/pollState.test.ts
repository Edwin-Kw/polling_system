import { describe, expect, it } from "vitest";
import { initialPollState, reducePollState } from "./pollState.ts";
import { optionId, poll, results, votedResults } from "../test/poll.ts";
import { deriveResults } from "@polling/shared";

describe("pending overlay state", () => {
  it("rollback preserves other users' latest confirmed votes", () => {
    let state = reducePollState(initialPollState, { type: "loaded", poll, results });
    state = reducePollState(state, { type: "submit", optionId });
    const newer = { ...results, totalVotes: 8,
      options: results.options.map((option) => ({ ...option, count: option.count + 2 })) };
    state = reducePollState(state, { type: "snapshot", results: newer });
    state = reducePollState(state, { type: "rejected", message: "Try again" });
    expect(state.results).toEqual(newer);
    expect(deriveResults(state.results!, state.pendingOption).totalVotes).toBe(8);
  });
  it("an authoritative snapshot replaces the acknowledged overlay", () => {
    let state = reducePollState(initialPollState, { type: "loaded", poll, results });
    state = reducePollState(state, { type: "submit", optionId });
    state = reducePollState(state, { type: "acknowledged", optionId });
    state = reducePollState(state, { type: "snapshot", results: votedResults });
    expect(state.confirmedVote).toBe(optionId);
    expect(deriveResults(state.results!, state.confirmedVote).totalVotes).toBe(5);
  });
  it("clears an earlier rejection when another tab's vote is confirmed", () => {
    let state = reducePollState(initialPollState, { type: "loaded", poll, results });
    state = reducePollState(state, { type: "rejected", message: "Your vote wasn't saved." });
    state = reducePollState(state, { type: "snapshot", results: votedResults });
    expect(state.phase).toBe("confirmed");
    expect(state.error).toBeNull();
  });
});
