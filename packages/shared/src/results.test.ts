import { describe, expect, it } from "vitest";
import { deriveResults } from "./results.ts";
import type { PollResults } from "./index.ts";

const results: PollResults = {
  pollId: "poll", active: true, myVote: null, totalVotes: 4,
  options: [{ id: "a", label: "A", count: 1 }, { id: "b", label: "B", count: 3 }],
};

describe("result calculations", () => {
  it("adds only the pending overlay without mutating confirmed data", () => {
    const display = deriveResults(results, "a");
    expect(display.totalVotes).toBe(5);
    expect(display.options[0]).toMatchObject({ count: 2, percentage: 40 });
    expect(results.options[0]?.count).toBe(1);
    expect(deriveResults(results).options[1]?.percentage).toBe(75);
  });
  it("shows zero rather than NaN percentages for an empty poll", () => {
    const display = deriveResults({ ...results, totalVotes: 0, options: [{ id: "a", label: "A", count: 0 }] });
    expect(display.options[0]?.percentage).toBe(0);
  });
  it("does not overlay a vote already present in the snapshot", () => {
    expect(deriveResults({ ...results, myVote: "a" }, "a").totalVotes).toBe(4);
  });
});
