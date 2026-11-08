import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PollResults, VoteResponse } from "@polling/shared";
import type { PollUpdateCallbacks, PollUpdates } from "../api/pollUpdates.ts";
import {
  deferred, getUserId, mockApi, offlineUpdates, optionId, poll, results,
  secondPoll, secondResults, votedResults,
} from "../test/poll.ts";
import { usePoll } from "./usePoll.ts";

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const flush = () => act(async () => {});
function multiplePollsApi() {
  const api = mockApi();
  api.getActivePolls.mockResolvedValue([poll, secondPoll]);
  api.getResults.mockImplementation(async (id) => id === secondPoll.id ? secondResults : results);
  return api;
}

describe("poll-scoped voting and live updates", () => {
  it("clears the previous poll's confirmation and restores it from the server when returning", async () => {
    const api = multiplePollsApi();
    api.getResults.mockImplementation(async (id) => id === secondPoll.id ? secondResults : votedResults);
    const { result } = renderHook(() => usePoll(api, getUserId, offlineUpdates));
    await flush();
    expect(result.current.state.confirmedVote).toBe(optionId);
    await act(async () => result.current.selectPoll(secondPoll.id));
    expect(result.current.state.poll).toEqual(secondPoll);
    expect(result.current.display?.totalVotes).toBe(0);
    expect(result.current.state.confirmedVote).toBeNull();
    expect(result.current.canVote).toBe(true);
    await act(async () => result.current.selectPoll(poll.id));
    expect(result.current.state.confirmedVote).toBe(optionId);
    expect(result.current.display?.totalVotes).toBe(5);
    expect(result.current.canVote).toBe(false);
  });

  it("aborts stale reads and ignores old socket callbacks after switching", async () => {
    const api = multiplePollsApi();
    const stale = deferred<PollResults>();
    const listeners = new Map<string, PollUpdateCallbacks>();
    const stops: ReturnType<typeof vi.fn>[] = [];
    const updates: PollUpdates = {
      subscribe: vi.fn((id, callbacks) => {
        listeners.set(id, callbacks);
        const stop = vi.fn();
        stops.push(stop);
        return stop;
      }),
    };
    const { result, unmount } = renderHook(() => usePoll(api, getUserId, updates));
    await flush();
    const old = listeners.get(poll.id);
    api.getResults.mockReturnValueOnce(stale.promise);
    act(() => old?.onChange());
    const oldSignal = api.getResults.mock.calls[1]?.[2];
    await act(async () => result.current.selectPoll(secondPoll.id));
    expect(oldSignal?.aborted).toBe(true);
    expect(stops[0]).toHaveBeenCalledOnce();
    expect(updates.subscribe).toHaveBeenLastCalledWith(secondPoll.id, expect.any(Object));
    const calls = api.getResults.mock.calls.length;
    await act(async () => {
      stale.resolve(votedResults);
      old?.onChange();
      old?.onConnection("connected");
    });
    expect(api.getResults).toHaveBeenCalledTimes(calls);
    expect(result.current.state.poll?.id).toBe(secondPoll.id);
    expect(result.current.display?.totalVotes).toBe(0);
    expect(result.current.connection).toBe("connecting");
    unmount();
    expect(stops[1]).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("locks switching until a pending or uncertain vote is authoritatively resolved", async () => {
    const api = multiplePollsApi();
    const submission = deferred<VoteResponse>();
    const reconcile = deferred<PollResults>();
    api.submitVote.mockReturnValue(submission.promise);
    const { result } = renderHook(() => usePoll(api, getUserId, offlineUpdates));
    await flush();
    act(() => result.current.submit(optionId));
    expect(result.current.canSwitchPoll).toBe(false);
    act(() => result.current.selectPoll(secondPoll.id));
    expect(result.current.state.poll?.id).toBe(poll.id);
    api.getResults.mockReturnValueOnce(reconcile.promise);
    await act(async () => submission.reject(new TypeError("Response lost")));
    expect(result.current.state.phase).toBe("reconciling");
    act(() => result.current.selectPoll(secondPoll.id));
    expect(result.current.state.poll?.id).toBe(poll.id);
    expect(api.submitVote).toHaveBeenCalledOnce();
    await act(async () => reconcile.resolve(votedResults));
    expect(result.current.canSwitchPoll).toBe(true);
    await act(async () => result.current.selectPoll(secondPoll.id));
    expect(result.current.state.poll?.id).toBe(secondPoll.id);
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.pendingOption).toBeNull();
  });
});
