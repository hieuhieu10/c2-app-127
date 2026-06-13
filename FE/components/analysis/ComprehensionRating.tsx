import type { Analysis } from "@/lib/types";
import { ScoreRing } from "./FaithfulnessPanel";

type ComprehensionRatingProps = {
  analysis: Analysis;
};

export default function ComprehensionRating({ analysis }: ComprehensionRatingProps) {
  return (
    <section className="side-tab-panel">
      <div className="clarity-summary">
        <ScoreRing label={`${analysis.comprehension}`} score={analysis.comprehension} size={56} />
        <div>
          <h3>Comprehension rating</h3>
          <p>Is this understandable to a non-expert?</p>
        </div>
      </div>

      <ul className="clarity-metrics">
        <li>Reading level: undergraduate</li>
        <li>Jargon density: low</li>
        <li>Average sentence length: 18 words</li>
      </ul>

      <div className="feedback-row">
        <span>Was this clear?</span>
        <div className="feedback-actions">
          <button className="icon-button" type="button">
            👍
          </button>
          <button className="icon-button" type="button">
            👎
          </button>
        </div>
      </div>
    </section>
  );
}
