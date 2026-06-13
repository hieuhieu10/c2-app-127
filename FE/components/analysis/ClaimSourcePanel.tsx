import type { Claim } from "@/lib/types";
import { FaithfulnessBadge } from "./FaithfulnessPanel";

type ClaimSourcePanelProps = {
  claim?: Claim;
  onClose?: () => void;
};

export default function ClaimSourcePanel({ claim, onClose }: ClaimSourcePanelProps) {
  if (!claim) {
    return null;
  }

  return (
    <div className="drawer-root">
      <button className="drawer-backdrop" onClick={onClose} type="button" />
      <aside className="drawer-panel">
        <div className="drawer-header">
          <h3>Claim to source</h3>
          <button className="icon-button" onClick={onClose} type="button">
            ×
          </button>
        </div>

        <div className="drawer-body">
          <div className="drawer-block">
            <span className="eyebrow-label">Claim</span>
            <p>{claim.text}</p>
            <FaithfulnessBadge level={claim.faithfulness} score={claim.score} />
          </div>

          <div className="drawer-block">
            <span className="eyebrow-label">Supporting passage</span>
            <div className="source-card">
              <div className="source-meta">
                <span>{claim.source.section}</span>
                <span>Page {claim.source.page}</span>
              </div>
              <p>{claim.source.passage}</p>
            </div>
          </div>

          {claim.faithfulness === "low" ? (
            <div className="warning-box">
              <p>Risky claim. The source only weakly supports this statement.</p>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
