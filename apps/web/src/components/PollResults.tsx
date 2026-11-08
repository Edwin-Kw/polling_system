import type { deriveResults } from "@polling/shared";
import { OptionResult } from "./OptionResult.tsx";
import { StatusMessage } from "./StatusMessage.tsx";
import { Card, CardContent, CardHeader } from "./ui/card.tsx";
import type { LiveConnection } from "../api/pollUpdates.ts";

export function PollResults({ question, results, selected, pending, warning, connection, error, reconciling = false }: {
  question: string;
  results: ReturnType<typeof deriveResults>;
  selected: string | null;
  pending: boolean;
  warning: string | null;
  connection: LiveConnection;
  error?: string | null;
  reconciling?: boolean;
}) {
  return (
    <section aria-labelledby="results-title">
      <Card className="gap-6 py-7 shadow-lg shadow-foreground/5">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3 border-b px-5 sm:px-7">
          <h2 id="results-title" className="text-2xl font-bold tracking-tight">Live Poll Results</h2>
          <span className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium ${
            connection === "connected" && !warning ? "bg-success-soft text-success" : "bg-secondary text-muted-foreground"
          }`}>
            <span aria-hidden="true" className="size-2 rounded-full bg-current" />
            {connection === "connected" ? warning ? "Updates delayed" : "Live updating"
              : connection === "connecting" ? "Connecting" : "Reconnecting"}
          </span>
        </CardHeader>
        <CardContent className="space-y-6 px-5 sm:px-7">
          <h3 className="text-xl font-bold leading-snug tracking-tight sm:text-2xl">{question}</h3>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {results.totalVotes} {results.totalVotes === 1 ? "vote" : "votes"}{pending ? " · Includes your pending vote" : ""}
          </p>
          <ul className="space-y-6">
            {results.options.map((option, index) => (
              <OptionResult key={option.id} option={option} selected={selected === option.id} tone={index % 4} />
            ))}
          </ul>
          <p className="text-sm text-muted-foreground" role="status">
            {connection === "connected" ? "Live updates connected."
              : connection === "connecting" ? "Connecting live updates. Results refresh every 2 seconds for now."
              : "Live updates disconnected. Results refresh every 2 seconds while reconnecting."}
          </p>
          {warning && <StatusMessage message={warning} error />}
          {error && <StatusMessage message={error} error={!reconciling} />}
        </CardContent>
      </Card>
    </section>
  );
}
