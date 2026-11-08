import type { Poll, PollResults } from "@polling/shared";

export interface PollState {
  phase: "loading" | "error" | "empty" | "idle" | "submitting" | "reconciling" | "confirmed";
  poll: Poll | null;
  results: PollResults | null;
  pendingOption: string | null;
  confirmedVote: string | null;
  error: string | null;
  warning: string | null;
}
export const initialPollState: PollState = {
  phase: "loading", poll: null, results: null, pendingOption: null,
  confirmedVote: null, error: null, warning: null,
};
export type PollAction =
  | { type: "reset" }
  | { type: "loaded"; poll: Poll; results: PollResults }
  | { type: "loadFailed"; message: string; empty: boolean }
  | { type: "submit"; optionId: string }
  | { type: "acknowledged"; optionId: string }
  | { type: "snapshot"; results: PollResults }
  | { type: "rejected"; message: string }
  | { type: "uncertain" }
  | { type: "refreshFailed"; message: string };

export function reducePollState(state: PollState, action: PollAction): PollState {
  switch (action.type) {
    case "reset": return initialPollState;
    case "loaded":
      return { ...initialPollState, poll: action.poll, results: action.results,
        phase: action.results.myVote ? "confirmed" : "idle", confirmedVote: action.results.myVote };
    case "loadFailed":
      return { ...initialPollState, phase: action.empty ? "empty" : "error", error: action.message };
    case "submit":
      return { ...state, phase: "submitting", pendingOption: action.optionId, error: null, warning: null };
    case "acknowledged":
      return { ...state, phase: "confirmed", pendingOption: null, confirmedVote: action.optionId, error: null };
    case "snapshot": {
      const confirmedVote = action.results.myVote ?? state.confirmedVote;
      return { ...state, results: action.results, confirmedVote, warning: null,
        phase: state.phase === "submitting" ? "submitting" : confirmedVote ? "confirmed" : "idle",
        error: confirmedVote ? null : state.phase === "reconciling" && action.results.active
          ? "No vote was recorded. You can try again." : state.phase === "reconciling" ? null : state.error };
    }
    case "rejected":
      return { ...state, phase: "idle", pendingOption: null, error: action.message };
    case "uncertain":
      return { ...state, phase: "reconciling", pendingOption: null,
        error: "Vote status unknown; checking before you can try again." };
    case "refreshFailed":
      return { ...state, warning: action.message };
  }
}
