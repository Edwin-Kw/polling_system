import { useCallback, useEffect, useRef, useState } from "react";
import { deriveResults } from "@polling/shared";
import type { Poll, PollResults } from "@polling/shared";
import { ApiError, pollApi } from "../api/polls.ts";
import type { PollApi } from "../api/polls.ts";
import { getMockUserId } from "../identity/mockUser.ts";
import { initialPollState, reducePollState } from "../state/pollState.ts";
import type { PollAction } from "../state/pollState.ts";
import { pollUpdates } from "../api/pollUpdates.ts";
import type { LiveConnection, PollUpdates } from "../api/pollUpdates.ts";

function checkSnapshot(poll: Poll, results: PollResults) {
  if (results.pollId !== poll.id || results.options.length !== poll.options.length
    || !poll.options.every((option) => results.options.some((result) => result.id === option.id))) {
    throw new Error("Results do not match the active poll");
  }
}

export function usePoll(
  api: PollApi = pollApi,
  getUserId: () => string = getMockUserId,
  updates: PollUpdates = pollUpdates,
) {
  const [state, setState] = useState(initialPollState);
  const current = useRef(state);
  const [attempt, setAttempt] = useState(0);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [selectedPollId, setSelectedPollId] = useState<string | null>(null);
  const [connection, setConnection] = useState<LiveConnection>("connecting");
  const submitOperation = useRef<(optionId: string) => void>(() => {});
  const transition = useCallback((action: PollAction) => {
    current.current = reducePollState(current.current, action);
    setState(current.current);
  }, []);

  useEffect(() => {
    let alive = true;
    let generation = 0;
    let controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let liveConnection: LiveConnection = "connecting";
    let stopUpdates: (() => void) | undefined;
    let refreshing: number | null = null;
    let dirty = false;
    let userId: string;
    setConnection("connecting");
    transition({ type: "reset" });

    function startRequest() {
      clearTimeout(timer);
      controller.abort();
      controller = new AbortController();
      refreshing = null;
      return ++generation;
    }
    function isCurrent(token: number) { return alive && token === generation; }
    function scheduleRefresh() {
      clearTimeout(timer);
      const recovery = liveConnection !== "connected"
        || current.current.warning !== null || current.current.phase === "reconciling";
      if (alive) timer = setTimeout(() => { void refresh(); }, recovery ? 2000 : 30000);
    }
    function queueRefresh() {
      if (!alive) return;
      dirty = true;
      if (current.current.phase !== "submitting" && refreshing === null) void refresh();
    }
    async function refresh() {
      const poll = current.current.poll;
      if (!alive || !poll || current.current.phase === "submitting") return;
      if (refreshing !== null) {
        dirty = true;
        return;
      }
      const token = startRequest();
      refreshing = token;
      dirty = false;
      try {
        const results = await api.getResults(poll.id, userId, controller.signal);
        if (!isCurrent(token)) return;
        checkSnapshot(poll, results);
        if (current.current.confirmedVote && results.myVote !== current.current.confirmedVote) {
          throw new Error("Results have not confirmed the acknowledged vote");
        }
        transition({ type: "snapshot", results });
      } catch (error) {
        if (!isCurrent(token)) return;
        console.error("Unable to refresh poll results", error);
        transition({ type: "refreshFailed", message: current.current.phase === "reconciling"
          ? "We couldn't check your vote yet. Reconnecting automatically; please don't resubmit."
          : "Results couldn't refresh. Showing the last known results; reconnecting automatically." });
      } finally {
        if (isCurrent(token)) {
          refreshing = null;
          if (dirty) void refresh();
          else scheduleRefresh();
        }
      }
    }

    async function submit(optionId: string) {
      const { poll, phase, results, confirmedVote } = current.current;
      if (!alive || !poll || phase !== "idle" || !results?.active || confirmedVote) return;
      if (!poll.options.some((option) => option.id === optionId)) {
        transition({ type: "rejected", message: "Choose an option from this poll." });
        return;
      }
      const token = startRequest();
      transition({ type: "submit", optionId });
      try {
        const response = await api.submitVote(poll.id, optionId, userId, controller.signal);
        if (!isCurrent(token)) return;
        if (response.pollId !== poll.id || response.optionId !== optionId) {
          throw new Error("Vote acknowledgement did not match the submitted vote");
        }
        transition({ type: "acknowledged", optionId });
        void refresh();
      } catch (error) {
        if (!isCurrent(token)) return;
        console.error("Unable to submit vote", error);
        if (error instanceof ApiError && (
          (error.status === 500 && error.code === "SIMULATED_FAILURE")
          || (error.status === 400 && error.code === "INVALID_REQUEST")
          || (error.status === 404 && error.code === "NOT_FOUND")
        )) {
          transition({ type: "rejected", message: error.message });
          if (dirty) void refresh();
          else scheduleRefresh();
        } else {
          // A transport failure may occur after commit; reconcile instead of repeating the POST.
          transition({ type: "uncertain" });
          void refresh();
        }
      }
    }
    submitOperation.current = (optionId) => { void submit(optionId); };

    async function load() {
      const token = startRequest();
      try {
        userId = getUserId();
        const activePolls = await api.getActivePolls(userId, controller.signal);
        if (!isCurrent(token)) return;
        setPolls(activePolls);
        const poll = selectedPollId === null ? activePolls[0] : activePolls.find((entry) => entry.id === selectedPollId);
        if (!poll) {
          throw new ApiError(404, "NOT_FOUND", activePolls.length === 0
            ? "No active poll is available." : "The selected poll is no longer active. Choose another poll.");
        }
        const results = await api.getResults(poll.id, userId, controller.signal);
        if (!isCurrent(token)) return;
        checkSnapshot(poll, results);
        transition({ type: "loaded", poll, results });
        stopUpdates = updates.subscribe(poll.id, {
          onChange: queueRefresh,
          onConnection: (nextConnection) => {
            if (!alive) return;
            liveConnection = nextConnection;
            setConnection(nextConnection);
            if (nextConnection === "connected") queueRefresh();
            else if (refreshing === null && current.current.phase !== "submitting") scheduleRefresh();
          },
        });
        scheduleRefresh();
      } catch (error) {
        if (!isCurrent(token)) return;
        console.error("Unable to load active poll", error);
        const empty = error instanceof ApiError && error.status === 404;
        transition({ type: "loadFailed", empty,
          message: empty ? error.message : "We couldn't load the poll. Check your connection and browser storage, then try again." });
      }
    }
    void load();
    return () => {
      alive = false;
      generation++;
      clearTimeout(timer);
      stopUpdates?.();
      controller.abort();
      submitOperation.current = () => {};
    };
  }, [api, getUserId, updates, attempt, selectedPollId, transition]);

  return {
    state,
    polls,
    selectedPollId: state.poll?.id ?? selectedPollId ?? polls[0]?.id ?? "",
    canSwitchPoll: state.phase !== "loading" && state.phase !== "submitting" && state.phase !== "reconciling",
    selectPoll: useCallback((pollId: string) => {
      const { phase, poll } = current.current;
      if (phase === "loading" || phase === "submitting" || phase === "reconciling" || poll?.id === pollId) return;
      if (!polls.some((entry) => entry.id === pollId)) {
        transition({ type: "rejected", message: "Choose an available active poll." });
        return;
      }
      transition({ type: "reset" });
      setSelectedPollId(pollId);
    }, [polls, transition]),
    connection,
    display: state.results ? deriveResults(state.results, state.pendingOption ?? state.confirmedVote) : null,
    canVote: state.phase === "idle" && state.results?.active === true && !state.confirmedVote,
    submit: useCallback((optionId: string) => submitOperation.current(optionId), []),
    retry: useCallback(() => setAttempt((value) => value + 1), []),
  };
}
