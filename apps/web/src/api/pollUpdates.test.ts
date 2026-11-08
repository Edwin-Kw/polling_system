import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { poll } from "../test/poll.ts";
import { pollUpdates } from "./pollUpdates.ts";
import { POLL_CHANGED_EVENT, SOCKET_PATH } from "@polling/shared";

const mock = vi.hoisted(() => {
  const listeners = new Map<string, (...args: unknown[]) => void>();
  const socket = {
    on: vi.fn((event: string, listener: (...args: unknown[]) => void) => { listeners.set(event, listener); }),
    connect: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn(() => listeners.clear()),
  };
  return { socket, listeners, io: vi.fn(() => socket) };
});
vi.mock("socket.io-client", () => ({ io: mock.io }));
beforeEach(() => {
  vi.clearAllMocks();
  mock.listeners.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("Socket.IO subscription", () => {
  it("reports connected only after an actual connection event", () => {
    const callbacks = { onConnection: vi.fn(), onChange: vi.fn() };
    const stop = pollUpdates.subscribe(poll.id, callbacks);
    expect(mock.io).toHaveBeenCalledWith({ autoConnect: false, reconnection: true, path: SOCKET_PATH });
    expect(mock.socket.connect).toHaveBeenCalledOnce();
    expect(callbacks.onConnection).not.toHaveBeenCalled();
    mock.listeners.get("connect")?.();
    expect(callbacks.onConnection).toHaveBeenCalledWith("connected");
    stop();
  });

  it("validates messages, ignores other polls, and only invalidates the matching poll", () => {
    const callbacks = { onConnection: vi.fn(), onChange: vi.fn() };
    const stop = pollUpdates.subscribe(poll.id, callbacks);
    const receive = mock.listeners.get(POLL_CHANGED_EVENT);
    receive?.({ pollId: "00000000-0000-4000-8000-000000000099" });
    expect(callbacks.onChange).not.toHaveBeenCalled();
    receive?.({ pollId: poll.id });
    expect(callbacks.onChange).toHaveBeenCalledOnce();
    receive?.({ pollId: poll.id, myVote: poll.options[0]?.id });
    receive?.({ pollId: "invalid" });
    expect(callbacks.onChange).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledTimes(2);
    stop();
  });

  it("logs connection failures and reports honest disconnected state", () => {
    const callbacks = { onConnection: vi.fn(), onChange: vi.fn() };
    const stop = pollUpdates.subscribe(poll.id, callbacks);
    const error = new Error("Connection refused");
    mock.listeners.get("connect_error")?.(error);
    expect(console.error).toHaveBeenCalledWith("Unable to connect to live poll updates", error);
    expect(callbacks.onConnection).toHaveBeenCalledWith("disconnected");
    stop();
  });

  it("reconnects after server disconnect and releases listeners on cleanup", () => {
    const callbacks = { onConnection: vi.fn(), onChange: vi.fn() };
    const stop = pollUpdates.subscribe(poll.id, callbacks);
    mock.listeners.get("disconnect")?.("io server disconnect");
    expect(callbacks.onConnection).toHaveBeenCalledWith("disconnected");
    expect(mock.socket.connect).toHaveBeenCalledTimes(2);
    stop();
    expect(mock.socket.removeAllListeners).toHaveBeenCalledOnce();
    expect(mock.socket.disconnect).toHaveBeenCalledOnce();
    expect(mock.listeners.size).toBe(0);
  });
});
