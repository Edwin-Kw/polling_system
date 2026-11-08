import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@polling/shared";

export function createPollSocketServer(
  httpServer: HttpServer,
  logError: (message: string, error: unknown) => void,
) {
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    serveClient: false,
  });
  io.engine.on("connection_error", (error) => logError("Live update connection failed", error));
  return {
    notifyPollChanged(pollId: string) {
      // Only invalidate results; each client fetches its own personalized snapshot.
      io.emit("poll:changed", { pollId });
    },
    close(callback: (error?: Error) => void) {
      io.close(callback);
    },
  };
}
