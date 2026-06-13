"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PROCESSING_STEPS } from "@/lib/constants";

export default function ProcessingSteps() {
  const router = useRouter();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (active >= PROCESSING_STEPS.length) {
      const timeout = setTimeout(() => router.push("/proposal/faithful-summ"), 600);
      return () => clearTimeout(timeout);
    }

    const timeout = setTimeout(() => setActive((current) => current + 1), 1100);
    return () => clearTimeout(timeout);
  }, [active, router]);

  const progress = Math.min(100, Math.round((active / PROCESSING_STEPS.length) * 100));

  return (
    <main className="processing-page">
      <div className="processing-intro">
        <div className="spinner-badge" aria-hidden="true">
          ⟳
        </div>
        <h1>Analyzing your paper</h1>
        <p>This usually takes under a minute. Hang tight.</p>
      </div>

      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <ul className="processing-list">
        {PROCESSING_STEPS.map((step, index) => {
          const done = index < active;
          const current = index === active;

          return (
            <li
              className={`processing-item ${current ? "processing-item-current" : ""}`}
              key={step.label}
            >
              <span className={`processing-bullet ${done ? "processing-bullet-done" : ""}`}>
                {done ? "✓" : index + 1}
              </span>
              <div className="processing-copy">
                <strong>{step.label}</strong>
                <span>{step.detail}</span>
              </div>
              {current ? <em>Working…</em> : null}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
