import type { Claim, ProposalSection as ProposalSectionType } from "@/lib/types";
import { FaithfulnessBadge } from "./FaithfulnessPanel";
import { scoreToLevel } from "@/lib/utils";

type ProposalSectionProps = {
  section: ProposalSectionType;
  onClaimSelect: (claim: Claim) => void;
};

export default function ProposalSection({ section, onClaimSelect }: ProposalSectionProps) {
  return (
    <article className="section-card">
      <div className="section-heading">
        <h2>{section.title}</h2>
        <FaithfulnessBadge level={scoreToLevel(section.score)} score={section.score} />
      </div>
      <p>{section.body}</p>

      {section.claims.length > 0 ? (
        <div className="claim-group">
          <span className="eyebrow-label">Claims in this section</span>
          {section.claims.map((claim) => (
            <button className="claim-card" key={claim.id} onClick={() => onClaimSelect(claim)} type="button">
              <span className={`claim-dot claim-dot-${claim.faithfulness}`} />
              <span className="claim-text">{claim.text}</span>
              <strong>View source</strong>
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}
