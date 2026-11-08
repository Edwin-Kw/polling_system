import type { deriveResults } from "@polling/shared";
import { OptionResult } from "./OptionResult.tsx";
import { StatusMessage } from "./StatusMessage.tsx";
import { Card, CardContent, CardHeader } from "./ui/card.tsx";
import type { LiveConnection } from "../api/pollUpdates.ts";

export function PollResults({ results, selected, pending, warning, connection }: {
  results: ReturnType<typeof deriveResults>;
  selected: string | null;
  pending: boolean;
  warning: string | null;
  connection: LiveConnection;
}) {
  return (
    <section aria-labelledby="results-title">
      <Card>
        <CardHeader>
          <h2 id="results-title" className="text-lg font-semibold">Live results</h2>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {results.totalVotes} {results.totalVotes === 1 ? "vote" : "votes"}{pending ? " · Includes your pending vote" : ""}
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <ul className="space-y-5">
            {results.options.map((option) => (
              <OptionResult key={option.id} option={option} selected={selected === option.id} />
            ))}
          </ul>
          <p className="text-xs text-muted-foreground" role="status">
            {connection === "connected" ? "Live updates connected."
              : connection === "connecting" ? "Connecting live updates. Results refresh every 2 seconds for now."
              : "Live updates disconnected. Results refresh every 2 seconds while reconnecting."}
          </p>
          {warning && <StatusMessage message={warning} error />}
        </CardContent>
      </Card>
    </section>
  );
}
