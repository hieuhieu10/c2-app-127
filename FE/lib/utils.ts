import type { FaithfulnessLevel } from "@/lib/types";

export function scoreToLevel(score: number): FaithfulnessLevel {
  if (score >= 85) {
    return "high";
  }

  if (score >= 65) {
    return "medium";
  }

  return "low";
}
