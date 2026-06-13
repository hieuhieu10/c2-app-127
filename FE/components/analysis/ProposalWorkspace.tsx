"use client";

import Link from "next/link";
import { useState } from "react";
import type { Analysis, Claim } from "@/lib/types";
import { DEPTH_OPTIONS } from "@/lib/constants";
import AppHeader from "@/components/layout/AppHeader";
import DepthControl from "./DepthControl";
import ProposalSection from "./ProposalSection";
import FaithfulnessPanel from "./FaithfulnessPanel";
import VisualizationPanel from "./VisualizationPanel";
import ComprehensionRating from "./ComprehensionRating";
import ClaimSourcePanel from "./ClaimSourcePanel";
import { ScoreRing } from "./FaithfulnessPanel";

type PanelTab = "faithfulness" | "visual" | "clarity";

export default function ProposalWorkspace({ analysis }: { analysis: Analysis }) {
  const [depth, setDepth] = useState<(typeof DEPTH_OPTIONS)[number]>("Standard");
  const [activeClaim, setActiveClaim] = useState<Claim | undefined>();
  const [tab, setTab] = useState<PanelTab>("faithfulness");
  const [regenerating, setRegenerating] = useState(false);

  function handleDepthChange(next: string) {
    setDepth(next as (typeof DEPTH_OPTIONS)[number]);
    setRegenerating(true);
    window.setTimeout(() => setRegenerating(false), 900);
  }

  return (
    <div className="app-screen">
      <AppHeader />

      <div className="proposal-toolbar">
        <div className="proposal-toolbar-inner">
          <div className="proposal-toolbar-copy">
            <Link className="icon-button icon-link" href="/dashboard">
              ←
            </Link>
            <div>
              <h1>{analysis.title}</h1>
              <p>
                {analysis.authors} · {analysis.source}
              </p>
            </div>
          </div>

          <div className="proposal-toolbar-actions">
            <DepthControl active={depth} onChange={handleDepthChange} options={DEPTH_OPTIONS} />
            <Link className="btn btn-primary btn-sm" href={`/export/${analysis.id}`}>
              Export
            </Link>
          </div>
        </div>
      </div>

      <main className="proposal-layout">
        <article className={`proposal-main ${regenerating ? "proposal-main-loading" : ""}`}>
          <div className="summary-card">
            <div className="summary-copy">
              <ScoreRing score={analysis.overallScore} size={52} />
              <div>
                <h2>Overall faithfulness</h2>
                <p>Plain-language proposal · {depth.toLowerCase()} depth</p>
              </div>
            </div>
            {regenerating ? <span>Regenerating…</span> : null}
          </div>

          {analysis.sections.map((section) => (
            <ProposalSection key={section.key} onClaimSelect={setActiveClaim} section={section} />
          ))}
        </article>

        <aside className="proposal-side">
          <div className="side-shell">
            <div className="side-tabs">
              <button
                className={tab === "faithfulness" ? "side-tab-active" : ""}
                onClick={() => setTab("faithfulness")}
                type="button"
              >
                Faithfulness
              </button>
              <button
                className={tab === "visual" ? "side-tab-active" : ""}
                onClick={() => setTab("visual")}
                type="button"
              >
                Visual
              </button>
              <button
                className={tab === "clarity" ? "side-tab-active" : ""}
                onClick={() => setTab("clarity")}
                type="button"
              >
                Clarity
              </button>
            </div>

            <div className="side-shell-body">
              {tab === "faithfulness" ? (
                <FaithfulnessPanel score={analysis.overallScore} sections={analysis.sections} />
              ) : null}
              {tab === "visual" ? <VisualizationPanel analysis={analysis} /> : null}
              {tab === "clarity" ? <ComprehensionRating analysis={analysis} /> : null}
            </div>
          </div>
        </aside>
      </main>

      <ClaimSourcePanel claim={activeClaim} onClose={() => setActiveClaim(undefined)} />
    </div>
  );
}
