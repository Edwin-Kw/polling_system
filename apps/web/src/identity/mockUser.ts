import { z } from "zod";

const storageKey = "polling.mock-user-id";
const userIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/);

export function getMockUserId(
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
  randomId: () => string = () => crypto.randomUUID(),
) {
  const stored = storage.getItem(storageKey);
  if (stored !== null) return userIdSchema.parse(stored);
  const userId = userIdSchema.parse(`user_${randomId()}`);
  storage.setItem(storageKey, userId);
  return userId;
}
