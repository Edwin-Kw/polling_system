import { z } from "zod";

export function createFailurePolicy(rate = 0.15, random: () => number = Math.random) {
  z.number().min(0).max(1).parse(rate);
  return () => random() < rate;
}
