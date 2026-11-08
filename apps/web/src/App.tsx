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

interface AppProps {
  api?: PollApi;
  getUserId?: () => string;
  updates?: PollUpdates;
}

export function App({ api = pollApi, getUserId = getMockUserId, updates = pollUpdates }: AppProps) {
  const { state, display, connection, canVote, submit, retry } = usePoll(api, getUserId, updates);
  const [selected, setSelected] = useState<string | null>(null);
  const chosen = state.confirmedVote ?? state.pendingOption ?? selected;
  return (
    <main className="mx-auto min-h-svh w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Polls</h1>
        <p className="mt-2 text-muted-foreground">Have your say. See what everyone thinks.</p>
      </header>
      {state.phase === "loading" && <StatusMessage message="Loading the active poll..." />}
      {(state.phase === "error" || state.phase === "empty") && (
        <div className="space-y-4">
          <StatusMessage message={state.error ?? "No active poll is available."} error={state.phase === "error"} />
          <Button type="button" onClick={retry}>Try again</Button>
        </div>
      )}
      {state.poll && display && (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <section aria-labelledby="active-poll-title">
            <Card>
              <CardHeader>
                <p className="text-sm text-muted-foreground">Active poll</p>
                <h2 id="active-poll-title" className="text-xl font-semibold">{state.poll.question}</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <PollVotingForm options={state.poll.options} selected={chosen} disabled={!canVote}
                  submitting={state.phase === "submitting"} recorded={state.confirmedVote !== null}
                  onSelect={setSelected} onSubmit={() => { if (chosen) submit(chosen); }} />
                {state.phase === "submitting" && <StatusMessage message="Saving your vote. Results include your pending choice." />}
                {state.confirmedVote && <StatusMessage message="Your vote is recorded." />}
                {!display.active && <StatusMessage message="This poll is closed. You can still view its results." />}
                {state.error && <StatusMessage message={state.error} error={state.phase !== "reconciling"} />}
              </CardContent>
            </Card>
          </section>
          <PollResults results={display} selected={chosen} pending={state.phase === "submitting"}
            warning={state.warning} connection={connection} />
        </div>
      )}
    </main>
  );
}
