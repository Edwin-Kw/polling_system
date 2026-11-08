import { vi } from "vitest";
import type { Poll, PollResults } from "@polling/shared";
import type { PollApi } from "../api/polls.ts";
import type { PollUpdates } from "../api/pollUpdates.ts";

export const offlineUpdates: PollUpdates = {
  subscribe: (_pollId, callbacks) => {
    callbacks.onConnection("disconnected");
    return () => {};
  },
};

export const poll: Poll = {
  id: "00000000-0000-4000-8000-000000000001",
  question: "Which feature should we build next?",
  options: [
    { id: "00000000-0000-4000-8000-000000000011", label: "Dark mode" },
    { id: "00000000-0000-4000-8000-000000000012", label: "Mobile app" },
  ],
};
export const optionId = poll.options[0]!.id;
export const results: PollResults = {
  pollId: poll.id, active: true, totalVotes: 4, myVote: null,
  options: poll.options.map((option, index) => ({ ...option, count: index === 0 ? 1 : 3 })),
};
export const votedResults: PollResults = {
  ...results, totalVotes: 5, myVote: optionId,
  options: results.options.map((option) => ({ ...option, count: option.count + (option.id === optionId ? 1 : 0) })),
};
export const getUserId = () => "test-user";
export function mockApi() {
  return {
    getActivePoll: vi.fn<PollApi["getActivePoll"]>().mockResolvedValue(poll),
    getResults: vi.fn<PollApi["getResults"]>().mockResolvedValue(results),
    submitVote: vi.fn<PollApi["submitVote"]>().mockResolvedValue({ pollId: poll.id, optionId }),
  };
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
