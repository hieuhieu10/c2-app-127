import type { Analysis } from "@/lib/types";
import AnalysisCard from "./AnalysisCard";
import Link from "next/link";

type RecentAnalysisListProps = {
  analyses: Analysis[];
};

export default function RecentAnalysisList({ analyses }: RecentAnalysisListProps) {
  return (
    <section className="page-content">
      <div className="section-copy">
        <h1>Your analyses</h1>
        <p>Start a new analysis or reopen a processed paper.</p>
      </div>

      <Link className="new-analysis-card" href="/upload">
        <div className="new-analysis-icon" aria-hidden="true">
          +
        </div>
        <div className="new-analysis-copy">
          <p>New analysis</p>
          <span>Upload a PDF, or paste a DOI / arXiv link</span>
        </div>
        <strong>Start</strong>
      </Link>

      <div className="history-block">
        <div className="history-header">
          <h2>History</h2>
          <span>{analyses.length} processed papers</span>
        </div>
        <ul className="analysis-list">
          {analyses.map((analysis) => (
            <AnalysisCard key={analysis.id} analysis={analysis} />
          ))}
        </ul>
      </div>
    </section>
  );
}
