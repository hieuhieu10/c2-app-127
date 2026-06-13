import { mockAnalyses } from "@/lib/mock/analyses.mock";

export async function getRecentAnalyses() {
  return mockAnalyses;
}

export async function getAnalysisById(id: string) {
  return mockAnalyses.find((analysis) => analysis.id === id) ?? mockAnalyses[0];
}
