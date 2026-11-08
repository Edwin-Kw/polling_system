import { io, type Socket } from "socket.io-client";
import { POLL_CHANGED_EVENT, SOCKET_PATH, pollChangedSchema } from "@polling/shared";
import type { ClientToServerEvents, ServerToClientEvents } from "@polling/shared";

export type LiveConnection = "connecting" | "connected" | "disconnected";
export interface PollUpdateCallbacks {
  onChange: () => void;
  onConnection: (connection: LiveConnection) => void;
}
export interface PollUpdates {
  subscribe(pollId: string, callbacks: PollUpdateCallbacks): () => void;
}

export const pollUpdates: PollUpdates = {
  subscribe(pollId, callbacks) {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
      autoConnect: false,
      reconnection: true,
      path: SOCKET_PATH,
    });
    socket.on("connect", () => callbacks.onConnection("connected"));
    socket.on("disconnect", (reason) => {
      callbacks.onConnection("disconnected");
      if (reason === "io server disconnect") socket.connect();
    });
    socket.on("connect_error", (error) => {
      console.error("Unable to connect to live poll updates", error);
      callbacks.onConnection("disconnected");
    });
    socket.on(POLL_CHANGED_EVENT, (event: unknown) => {
      const parsed = pollChangedSchema.safeParse(event);
      if (!parsed.success) {
        console.error("Invalid live poll update", parsed.error);
        return;
      }
      if (parsed.data.pollId === pollId) callbacks.onChange();
    });
    socket.connect();
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  },
};
