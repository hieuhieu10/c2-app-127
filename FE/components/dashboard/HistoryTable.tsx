import Link from "next/link";
import type { Analysis } from "@/lib/types";
import { ScoreRing } from "@/components/analysis/FaithfulnessPanel";

type HistoryTableProps = {
  analyses: Analysis[];
};

export default function HistoryTable({ analyses }: HistoryTableProps) {
  return (
    <section className="table-panel">
      <input aria-label="Search papers" placeholder="Search papers..." />
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Date</th>
            <th>Format</th>
            <th>Faithfulness</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {analyses.map((analysis) => (
            <tr key={analysis.id}>
              <td className="history-title-cell">
                <ScoreRing score={analysis.overallScore} size={38} />
                <div>
                  <strong>{analysis.title}</strong>
                  <span>{analysis.authors}</span>
                </div>
              </td>
              <td>{analysis.date}</td>
              <td>{analysis.format}</td>
              <td>{analysis.overallScore}%</td>
              <td>
                <Link href={`/proposal/${analysis.id}`}>Open</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
