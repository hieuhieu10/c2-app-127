import Link from "next/link";
import type { Analysis } from "@/lib/types";
import { ScoreRing } from "@/components/analysis/FaithfulnessPanel";

type AnalysisCardProps = {
  analysis: Analysis;
};

export default function AnalysisCard({ analysis }: AnalysisCardProps) {
  return (
    <li>
      <Link className="analysis-row" href={`/proposal/${analysis.id}`}>
        <ScoreRing score={analysis.overallScore} />
        <div className="analysis-copy">
          <p className="analysis-title">{analysis.title}</p>
          <p className="analysis-meta">
            {analysis.authors} · {analysis.source}
          </p>
        </div>
        <div className="analysis-summary">
          <p>Faithfulness {analysis.overallScore}%</p>
          <p>Processed {analysis.date}</p>
        </div>
        <span className="analysis-arrow" aria-hidden="true">
          →
        </span>
      </Link>
    </li>
  );
}
