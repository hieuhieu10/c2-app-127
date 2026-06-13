import type { Analysis } from "@/lib/types";

type VisualizationPanelProps = {
  analysis: Analysis;
};

export default function VisualizationPanel({ analysis }: VisualizationPanelProps) {
  const claims = analysis.sections.flatMap((section) => section.claims).slice(0, 5);

  return (
    <section className="side-tab-panel">
      <div className="viz-block">
        <span className="eyebrow-label">Problem → solution</span>
        <div className="flow-row">
          <span className="flow-node flow-node-problem">Problem</span>
          <span className="flow-arrow">→</span>
          <span className="flow-node flow-node-solution">Solution</span>
          <span className="flow-arrow">→</span>
          <span className="flow-node flow-node-evidence">Evidence</span>
          <span className="flow-arrow">→</span>
          <span className="flow-node flow-node-impact">Impact</span>
        </div>
      </div>

      <div className="viz-block">
        <span className="eyebrow-label">Claim → evidence map</span>
        <ul className="evidence-list">
          {claims.map((claim) => (
            <li className="evidence-row" key={claim.id}>
              <span className="evidence-text">{claim.text}</span>
              <span className="evidence-bridge" />
              <span className={`evidence-tag evidence-tag-${claim.faithfulness}`}>
                {claim.source.section}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
