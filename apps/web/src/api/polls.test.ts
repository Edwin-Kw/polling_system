import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, pollApi } from "./polls.ts";
import { optionId, poll, results } from "../test/poll.ts";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const signal = () => new AbortController().signal;
const respond = (body: unknown, status = 200) => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
};

describe("poll API client", () => {
  it("sends the mock identity and validates a poll response", async () => {
    const fetch = respond(poll);
    await expect(pollApi.getActivePoll("user", signal())).resolves.toEqual(poll);
    expect(fetch).toHaveBeenCalledWith("/api/polls/active", expect.objectContaining({
      headers: { "X-Mock-User-Id": "user" }, cache: "no-store", method: "GET",
    }));
  });
  it("sends a JSON vote and requires a 201 acknowledgement", async () => {
    const fetch = respond({ pollId: poll.id, optionId }, 201);
    await expect(pollApi.submitVote(poll.id, optionId, "user", signal()))
      .resolves.toEqual({ pollId: poll.id, optionId });
    expect(fetch).toHaveBeenCalledWith(`/api/polls/${poll.id}/votes`, expect.objectContaining({
      method: "POST", body: JSON.stringify({ optionId }),
    }));
    respond({ pollId: poll.id, optionId }, 200);
    await expect(pollApi.submitVote(poll.id, optionId, "user", signal())).rejects.toThrow("Unexpected HTTP status");
  });
  it("preserves explicit server rejection codes", async () => {
    respond({ error: { code: "SIMULATED_FAILURE", message: "Not saved" } }, 500);
    await expect(pollApi.submitVote(poll.id, optionId, "user", signal())).rejects.toEqual(
      new ApiError(500, "SIMULATED_FAILURE", "Not saved"),
    );
  });
  it("rejects inconsistent or malformed results instead of fabricating counts", async () => {
    respond({ ...results, totalVotes: 999 });
    await expect(pollApi.getResults(poll.id, "user", signal())).rejects.toThrow();
    respond({ status: "ok" });
    await expect(pollApi.getResults(poll.id, "user", signal())).rejects.toThrow();
  });
  it("aborts a stalled request after eight seconds and releases the timer", async () => {
    vi.useFakeTimers();
    let receivedSignal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_path: string, init: RequestInit) => {
      receivedSignal = init.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("Request aborted")), { once: true });
      });
    }));
    const pending = pollApi.getActivePoll("user", signal());
    const assertion = expect(pending).rejects.toThrow("Request aborted");
    await vi.advanceTimersByTimeAsync(8000);
    await assertion;
    expect(receivedSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
