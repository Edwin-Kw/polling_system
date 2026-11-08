import { useEffect, useState } from "react";
import type { HealthResponse } from "@polling/shared";
import { fetchHealth } from "./api/health.ts";
import { StatusMessage } from "./components/StatusMessage.tsx";
import { Button } from "./components/ui/button.tsx";
import { Card, CardContent, CardHeader } from "./components/ui/card.tsx";

type ConnectionState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

interface AppProps {
  checkHealth?: (signal: AbortSignal) => Promise<HealthResponse>;
}

export function App({ checkHealth = fetchHealth }: AppProps) {
  const [connection, setConnection] = useState<ConnectionState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setConnection({ status: "loading" });

    void checkHealth(controller.signal).then(() => {
      if (!controller.signal.aborted) setConnection({ status: "ready" });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      console.error("Unable to connect to the polling service", error);
      setConnection({
        status: "error",
        message: "We couldn't connect. Please try again.",
      });
    });

    return () => controller.abort();
  }, [checkHealth, attempt]);

  return (
    <main className="mx-auto min-h-svh w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Polls</h1>
      </header>
      <section aria-labelledby="active-poll-title">
        <Card>
          <CardHeader>
            <h2 id="active-poll-title" className="text-lg font-semibold">Active poll</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {connection.status === "loading" && <StatusMessage message="Connecting..." />}
            {connection.status === "ready" && (
              <StatusMessage message="Voting is currently unavailable. Please check back soon." />
            )}
            {connection.status === "error" && (
              <>
                <StatusMessage message={connection.message} error />
                <Button type="button" onClick={() => setAttempt((value) => value + 1)}>
                  Try again
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
