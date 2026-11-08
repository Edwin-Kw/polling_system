import { useState } from "react";
import { pollApi } from "./api/polls.ts";
import type { PollApi } from "./api/polls.ts";
import { pollUpdates } from "./api/pollUpdates.ts";
import type { PollUpdates } from "./api/pollUpdates.ts";
import { getMockUserId } from "./identity/mockUser.ts";
import { usePoll } from "./hooks/usePoll.ts";
import { PollVotingForm } from "./components/PollVotingForm.tsx";
import { PollResults } from "./components/PollResults.tsx";
import { StatusMessage } from "./components/StatusMessage.tsx";
import { Button } from "./components/ui/button.tsx";
import { Card, CardContent, CardHeader } from "./components/ui/card.tsx";
import { ActivePollSelect } from "./components/ActivePollSelect.tsx";

interface AppProps {
  api?: PollApi;
  getUserId?: () => string;
  updates?: PollUpdates;
}

export function App({ api = pollApi, getUserId = getMockUserId, updates = pollUpdates }: AppProps) {
  const {
    state, display, connection, canVote, submit, retry, polls, selectedPollId, canSwitchPoll, selectPoll,
  } = usePoll(api, getUserId, updates);
  const [selected, setSelected] = useState<string | null>(null);
  const chosen = state.confirmedVote ?? state.pendingOption ?? selected;
  return (
    <main className="mx-auto grid min-h-svh w-full max-w-7xl items-start gap-8 px-4 py-8 sm:px-8 sm:py-12 lg:grid-cols-2 lg:gap-10 lg:py-20 xl:gap-14">
      <section aria-labelledby="active-poll-title" className="min-w-0 rounded-2xl border bg-panel p-5 shadow-xl shadow-foreground/5 sm:p-7">
        <h1 id="active-poll-title" className="mb-6 text-2xl font-bold tracking-tight">Active Poll</h1>
        {state.phase === "loading" && <StatusMessage message="Loading the active poll..." />}
        {(state.phase === "error" || state.phase === "empty") && (
          <div className="space-y-4">
            <StatusMessage message={state.error ?? "No active poll is available."} error={state.phase === "error"} />
            <Button type="button" onClick={retry}>Try again</Button>
          </div>
        )}
        {state.poll && display && (
          <Card className="gap-7 py-7 shadow-lg shadow-foreground/5">
            <CardHeader className="gap-5 px-5 sm:px-7">
              <p className="text-lg font-semibold text-muted-foreground">High-Concurrency Polling System</p>
              <h2 className="text-2xl font-bold leading-snug tracking-tight sm:text-3xl">{state.poll.question}</h2>
            </CardHeader>
            <CardContent className="space-y-5 px-5 sm:px-7">
              <PollVotingForm options={state.poll.options} selected={chosen} disabled={!canVote}
                submitting={state.phase === "submitting"} recorded={state.confirmedVote !== null}
                onSelect={setSelected} onSubmit={() => { if (chosen) submit(chosen); }} />
              <p className="text-center text-sm leading-relaxed text-muted-foreground">
                A mock user identifier is used to prevent multiple submissions to the same poll.
              </p>
              {state.phase === "submitting" && <StatusMessage message="Saving your vote. Results include your pending choice." />}
              {state.confirmedVote && <StatusMessage message="Your vote is recorded." />}
              {!display.active && <StatusMessage message="This poll is closed. You can still view its results." />}
            </CardContent>
          </Card>
        )}
      </section>
      <div className="min-w-0 space-y-7 lg:border-l lg:pl-10 xl:pl-14">
        <ActivePollSelect polls={polls} value={selectedPollId} disabled={!canSwitchPoll}
          loading={state.phase === "loading"} voteInProgress={state.phase === "submitting" || state.phase === "reconciling"}
          onChange={(pollId) => { selectPoll(pollId); setSelected(null); }} />
        {state.poll && display && (
          <PollResults question={state.poll.question} results={display} selected={chosen} pending={state.phase === "submitting"}
            warning={state.warning} connection={connection} error={state.error} reconciling={state.phase === "reconciling"} />
        )}
      </div>
    </main>
  );
}
