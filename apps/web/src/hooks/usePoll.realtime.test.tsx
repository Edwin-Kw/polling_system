import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PollResults, VoteResponse } from "@polling/shared";
import type { PollUpdates, PollUpdateCallbacks } from "../api/pollUpdates.ts";
import { deferred, getUserId, mockApi, optionId, results, votedResults } from "../test/poll.ts";
import { ApiError } from "../api/polls.ts";
import { usePoll } from "./usePoll.ts";

function mockUpdates() {
  let listener: PollUpdateCallbacks | undefined;
  const stop = vi.fn();
  const updates: PollUpdates = {
    subscribe: vi.fn((_pollId, callbacks) => { listener = callbacks; return stop; }),
  };
  return {
    updates, stop,
    connect: () => listener?.onConnection("connected"),
    disconnect: () => listener?.onConnection("disconnected"),
    changed: () => listener?.onChange(),
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const flush = () => act(async () => {});

describe("Socket.IO result refresh orchestration", () => {
  it("refreshes immediately on push rather than waiting for the fallback timer", async () => {
    const api = mockApi();
    const socket = mockUpdates();
    const { result } = renderHook(() => usePoll(api, getUserId, socket.updates));
    await flush();
    await act(async () => socket.connect());
    expect(result.current.connection).toBe("connected");
    api.getResults.mockResolvedValue(votedResults);
    await act(async () => socket.changed());
    expect(result.current.display?.totalVotes).toBe(5);
    expect(api.getResults).toHaveBeenCalledTimes(3);
  });

  it("coalesces a burst of notifications without overlapping or cancelling the current GET", async () => {
    const api = mockApi();
    const socket = mockUpdates();
    const inFlight = deferred<PollResults>();
    const { result } = renderHook(() => usePoll(api, getUserId, socket.updates));
    await flush();
    await act(async () => socket.connect());
    api.getResults.mockReturnValueOnce(inFlight.promise).mockResolvedValue(votedResults);
    act(() => { socket.changed(); for (let i = 0; i < 100; i++) socket.changed(); });
    expect(api.getResults).toHaveBeenCalledTimes(3);
    expect(api.getResults.mock.calls[2]?.[2].aborted).toBe(false);
    await act(async () => inFlight.resolve(results));
    expect(api.getResults).toHaveBeenCalledTimes(4);
    expect(result.current.display?.totalVotes).toBe(5);
  });

  it("pauses push refresh while submitting and reconciles after commit without a second increment", async () => {
    const api = mockApi();
    const socket = mockUpdates();
    const submission = deferred<VoteResponse>();
    api.submitVote.mockReturnValue(submission.promise);
    const { result } = renderHook(() => usePoll(api, getUserId, socket.updates));
    await flush();
    await act(async () => socket.connect());
    act(() => result.current.submit(optionId));
    act(() => { socket.changed(); socket.changed(); });
    expect(api.getResults).toHaveBeenCalledTimes(2);
    expect(result.current.display?.totalVotes).toBe(5);
    api.getResults.mockResolvedValue(votedResults);
    await act(async () => submission.resolve({ pollId: results.pollId, optionId }));
    expect(result.current.display?.totalVotes).toBe(5);
    expect(result.current.canVote).toBe(false);
  });

  it("continues fallback polling on disconnect and refreshes immediately on reconnect", async () => {
    const api = mockApi();
    const socket = mockUpdates();
    const { result } = renderHook(() => usePoll(api, getUserId, socket.updates));
    await flush();
    await act(async () => socket.connect());
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(api.getResults).toHaveBeenCalledTimes(2);
    act(() => socket.disconnect());
    expect(result.current.connection).toBe("disconnected");
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(api.getResults).toHaveBeenCalledTimes(3);
    api.getResults.mockResolvedValue(votedResults);
    await act(async () => socket.connect());
    expect(api.getResults).toHaveBeenCalledTimes(4);
    expect(result.current.display?.totalVotes).toBe(5);
  });

  it("retries a failed authoritative refresh even while the socket stays connected", async () => {
    const api = mockApi();
    const socket = mockUpdates();
    const { result } = renderHook(() => usePoll(api, getUserId, socket.updates));
    await flush();
    await act(async () => socket.connect());
    api.getResults.mockRejectedValueOnce(new Error("Offline")).mockResolvedValue(votedResults);
    await act(async () => socket.changed());
    expect(result.current.state.warning).toBeTruthy();
    expect(result.current.display?.totalVotes).toBe(4);
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(result.current.state.warning).toBeNull();
    expect(result.current.display?.totalVotes).toBe(5);
  });

  it("does not let socket reconnect bypass uncertain-vote reconciliation", async () => {
    const api = mockApi();
    const socket = mockUpdates();
    const reconcile = deferred<PollResults>();
    api.submitVote.mockRejectedValue(new TypeError("Lost response"));
    const { result } = renderHook(() => usePoll(api, getUserId, socket.updates));
    await flush();
    await act(async () => socket.connect());
    api.getResults.mockReturnValueOnce(reconcile.promise).mockResolvedValue(votedResults);
    await act(async () => result.current.submit(optionId));
    act(() => { socket.disconnect(); socket.connect(); socket.changed(); });
    expect(result.current.canVote).toBe(false);
    expect(api.submitVote).toHaveBeenCalledOnce();
    await act(async () => reconcile.resolve(votedResults));
    expect(result.current.state.phase).toBe("confirmed");
    expect(result.current.display?.totalVotes).toBe(5);
  });

  it("cleans up the socket and ignores late events after unmount", async () => {
    const api = mockApi();
    const socket = mockUpdates();
    const { unmount } = renderHook(() => usePoll(api, getUserId, socket.updates));
    await flush();
    unmount();
    expect(socket.stop).toHaveBeenCalledOnce();
    act(() => { socket.changed(); socket.connect(); });
    await act(async () => vi.advanceTimersByTimeAsync(30000));
    expect(api.getResults).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("processes other users' queued changes after a simulated vote rejection", async () => {
    const api = mockApi();
    const socket = mockUpdates();
    const submission = deferred<VoteResponse>();
    api.submitVote.mockReturnValue(submission.promise);
    const { result } = renderHook(() => usePoll(api, getUserId, socket.updates));
    await flush();
    await act(async () => socket.connect());
    act(() => { result.current.submit(optionId); socket.changed(); });
    const otherUsers = { ...results, totalVotes: 5, options: results.options.map((option) =>
      ({ ...option, count: option.count + (option.id === optionId ? 1 : 0) })) };
    api.getResults.mockResolvedValue(otherUsers);
    await act(async () => submission.reject(new ApiError(500, "SIMULATED_FAILURE", "Not saved")));
    expect(result.current.display?.totalVotes).toBe(5);
    expect(result.current.state.error).toBe("Not saved");
    expect(result.current.canVote).toBe(true);
  });
});
