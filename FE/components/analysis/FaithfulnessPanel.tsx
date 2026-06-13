import type { FaithfulnessLevel, ProposalSection } from "@/lib/types";
import { scoreToLevel } from "@/lib/utils";

type FaithfulnessPanelProps = {
  score: number;
  sections: ProposalSection[];
};

export default function FaithfulnessPanel({ score, sections }: FaithfulnessPanelProps) {
  return (
    <section className="side-tab-panel">
      <div className="side-copy">
        <h3>Faithfulness</h3>
        <p>
          Score per section. Lower scores flag claims that may not be fully supported
          by the paper.
        </p>
      </div>
      {sections.map((section) => (
        <div className="score-group" key={section.key}>
          <div className="score-row">
            <span>{section.title}</span>
            <strong>{section.score}%</strong>
          </div>
          <div className="score-bar">
            <div
              className={`score-fill score-fill-${scoreToLevel(section.score)}`}
              style={{ width: `${section.score}%` }}
            />
          </div>
        </div>
      ))}
      <div className="warning-box">
        <p>
          <strong>1 risky claim</strong> in Feasibility. Scaling to 50 pages is not well
          supported by the paper.
        </p>
      </div>
    </section>
  );
}

export function FaithfulnessBadge({
  level,
  score,
}: {
  level: FaithfulnessLevel;
  score?: number;
}) {
  return (
    <span className={`faithfulness-badge faithfulness-badge-${level}`}>
      <span className="faithfulness-badge-dot" />
      <span>{level}</span>
      {typeof score === "number" ? <span>{score}%</span> : null}
    </span>
  );
}

export function ScoreRing({
  score,
  label,
  size = 44,
}: {
  score: number;
  label?: string;
  size?: number;
}) {
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const level = scoreToLevel(score);

  return (
    <div className="score-ring" style={{ height: size, width: size }}>
      <svg height={size} viewBox={`0 0 ${size} ${size}`} width={size}>
        <circle
          className="score-ring-track"
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          strokeWidth={stroke}
        />
        <circle
          className={`score-ring-fill score-ring-fill-${level}`}
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth={stroke}
        />
      </svg>
      <span>{label ?? score}</span>
    </div>
  );
}
