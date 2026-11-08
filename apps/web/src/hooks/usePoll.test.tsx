import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PollResults, VoteResponse } from "@polling/shared";
import { ApiError } from "../api/polls.ts";
import { deferred, getUserId, mockApi, offlineUpdates, optionId, results, votedResults } from "../test/poll.ts";
import { usePoll } from "./usePoll.ts";

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const flush = () => act(async () => {});

describe("optimistic voting and reconciliation", () => {
  it("updates immediately then confirms without double counting", async () => {
    const api = mockApi();
    const submission = deferred<VoteResponse>();
    api.submitVote.mockReturnValue(submission.promise);
    const { result } = renderHook(() => usePoll(api, getUserId, offlineUpdates));
    await flush();
    act(() => result.current.submit(optionId));
    expect(result.current.display?.totalVotes).toBe(5);
    expect(result.current.display?.options[0]?.percentage).toBe(40);
    expect(result.current.state.phase).toBe("submitting");
    api.getResults.mockResolvedValue(votedResults);
    await act(async () => submission.resolve({ pollId: results.pollId, optionId }));
    expect(result.current.display?.totalVotes).toBe(5);
    expect(result.current.state.phase).toBe("confirmed");
    expect(result.current.canVote).toBe(false);
  });

  it("rolls back only the pending overlay on a known 500 and enables retry", async () => {
    const api = mockApi();
    const submission = deferred<VoteResponse>();
    api.submitVote.mockReturnValue(submission.promise);
    const { result } = renderHook(() => usePoll(api, getUserId, offlineUpdates));
    await flush();
    act(() => result.current.submit(optionId));
    expect(result.current.display?.totalVotes).toBe(5);
    await act(async () => submission.reject(new ApiError(500, "SIMULATED_FAILURE", "Your vote wasn't saved.")));
    expect(result.current.display?.totalVotes).toBe(4);
    expect(result.current.state.results).toEqual(results);
    expect(result.current.state.error).toContain("wasn't saved");
    expect(result.current.canVote).toBe(true);
  });

  it("ignores and aborts a stale GET that completes after submission starts", async () => {
    const api = mockApi();
    const stale = deferred<PollResults>();
    const submission = deferred<VoteResponse>();
    api.getResults.mockResolvedValueOnce(results).mockReturnValueOnce(stale.promise).mockResolvedValue(votedResults);
    api.submitVote.mockReturnValue(submission.promise);
    const { result } = renderHook(() => usePoll(api, getUserId, offlineUpdates));
    await flush();
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    const staleSignal = api.getResults.mock.calls[1]?.[2];
    act(() => result.current.submit(optionId));
    expect(staleSignal?.aborted).toBe(true);
    await act(async () => stale.resolve({ ...results, totalVotes: 0,
      options: results.options.map((option) => ({ ...option, count: 0 })) }));
    expect(result.current.display?.totalVotes).toBe(5);
    await act(async () => submission.resolve({ pollId: results.pollId, optionId }));
    expect(result.current.state.results?.myVote).toBe(optionId);
    expect(result.current.display?.totalVotes).toBe(5);
  });

  it("reconciles a lost response before retry and never automatically repeats the POST", async () => {
    const api = mockApi();
    const reconcile = deferred<PollResults>();
    api.getResults.mockResolvedValueOnce(results).mockReturnValueOnce(reconcile.promise);
    api.submitVote.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => usePoll(api, getUserId, offlineUpdates));
    await flush();
    await act(async () => result.current.submit(optionId));
    expect(result.current.state.phase).toBe("reconciling");
    expect(result.current.display?.totalVotes).toBe(4);
    expect(result.current.canVote).toBe(false);
    act(() => result.current.submit(optionId));
    expect(api.submitVote).toHaveBeenCalledOnce();
    await act(async () => reconcile.resolve(votedResults));
    expect(result.current.state.phase).toBe("confirmed");
    expect(result.current.display?.totalVotes).toBe(5);
    expect(result.current.canVote).toBe(false);
  });

  it("keeps retries locked if reconciliation fails, then enables retry only after a successful read", async () => {
    const api = mockApi();
    api.getResults.mockResolvedValueOnce(results).mockRejectedValueOnce(new Error("Offline")).mockResolvedValue(results);
    api.submitVote.mockRejectedValue(new TypeError("Network lost"));
    const { result } = renderHook(() => usePoll(api, getUserId, offlineUpdates));
    await flush();
    await act(async () => result.current.submit(optionId));
    expect(result.current.canVote).toBe(false);
    expect(result.current.state.warning).toBeTruthy();
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(result.current.canVote).toBe(true);
    expect(result.current.state.error).toContain("No vote was recorded");
    expect(api.submitVote).toHaveBeenCalledOnce();
  });

  it("does not undo an acknowledged vote if follow-up results fail", async () => {
    const api = mockApi();
    api.getResults.mockResolvedValueOnce(results).mockRejectedValueOnce(new Error("Offline")).mockResolvedValue(votedResults);
    const { result } = renderHook(() => usePoll(api, getUserId, offlineUpdates));
    await flush();
    await act(async () => result.current.submit(optionId));
    expect(result.current.state.phase).toBe("confirmed");
    expect(result.current.canVote).toBe(false);
    expect(result.current.display?.totalVotes).toBe(5);
    expect(result.current.state.warning).toBeTruthy();
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(result.current.display?.totalVotes).toBe(5);
    expect(result.current.state.warning).toBeNull();
  });

  it("retains data during a refresh error and recovers without overlapping GETs", async () => {
    const api = mockApi();
    const refresh = deferred<PollResults>();
    api.getResults.mockResolvedValueOnce(results).mockReturnValueOnce(refresh.promise).mockResolvedValue(votedResults);
    const { result } = renderHook(() => usePoll(api, getUserId, offlineUpdates));
    await flush();
    await act(async () => vi.advanceTimersByTimeAsync(6000));
    expect(api.getResults).toHaveBeenCalledTimes(2);
    await act(async () => refresh.reject(new Error("Offline")));
    expect(result.current.display?.totalVotes).toBe(4);
    expect(result.current.state.warning).toBeTruthy();
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(result.current.display?.totalVotes).toBe(5);
    expect(result.current.state.warning).toBeNull();
  });

  it("reconciles duplicate responses and disables voting for the recorded option", async () => {
    const api = mockApi();
    api.submitVote.mockRejectedValue(new ApiError(409, "ALREADY_VOTED", "Already voted"));
    api.getResults.mockResolvedValueOnce(results).mockResolvedValue(votedResults);
    const { result } = renderHook(() => usePoll(api, getUserId, offlineUpdates));
    await flush();
    await act(async () => result.current.submit(optionId));
    expect(result.current.state.results?.myVote).toBe(optionId);
    expect(result.current.canVote).toBe(false);
  });

  it("aborts outstanding work and clears timers on unmount", async () => {
    const api = mockApi();
    const initial = deferred<PollResults>();
    api.getResults.mockReturnValue(initial.promise);
    const { unmount } = renderHook(() => usePoll(api, getUserId, offlineUpdates));
    await flush();
    const signal = api.getResults.mock.calls[0]?.[2];
    unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => initial.resolve(results));
    await act(async () => vi.advanceTimersByTimeAsync(10000));
    expect(api.getResults).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
