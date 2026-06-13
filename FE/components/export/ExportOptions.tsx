"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Analysis } from "@/lib/types";
import AppHeader from "@/components/layout/AppHeader";
import { EXPORT_FORMATS } from "@/lib/constants";

type Format = "summary" | "slides" | "infographic";
type FileType = "pdf" | "png";

export default function ExportOptions({ analysis }: { analysis: Analysis }) {
  const router = useRouter();
  const [format, setFormat] = useState<Format>("summary");
  const [fileType, setFileType] = useState<FileType>("pdf");
  const [downloading, setDownloading] = useState(false);
  const [done, setDone] = useState(false);

  function handleDownload() {
    setDownloading(true);
    window.setTimeout(() => {
      setDownloading(false);
      setDone(true);
    }, 1100);
  }

  return (
    <div className="app-screen">
      <AppHeader />
      <main className="narrow-page export-page">
        <Link className="back-link" href={`/proposal/${analysis.id}`}>
          ← Back to proposal
        </Link>

        <div className="section-copy">
          <h1>Export proposal</h1>
          <p>
            Choose a format and file type for <strong>{analysis.title}</strong>.
          </p>
        </div>

        <section className="export-group">
          <p className="field-label">Format</p>
          <div className="format-grid">
            {EXPORT_FORMATS.map((option) => (
              <button
                className={`format-card ${format === option.id ? "format-card-active" : ""}`}
                key={option.id}
                onClick={() => setFormat(option.id)}
                type="button"
              >
                <span className="format-card-icon">{option.title.slice(0, 1)}</span>
                <strong>{option.title}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="export-group">
          <p className="field-label">File type</p>
          <div className="tab-switch">
            <button
              className={fileType === "pdf" ? "tab-switch-active" : ""}
              onClick={() => setFileType("pdf")}
              type="button"
            >
              PDF
            </button>
            <button
              className={fileType === "png" ? "tab-switch-active" : ""}
              onClick={() => setFileType("png")}
              type="button"
            >
              PNG
            </button>
          </div>
        </section>

        <section className="download-card">
          <div className="download-card-header">
            <div>
              <h2>Ready to download</h2>
              <p>
                {format.charAt(0).toUpperCase() + format.slice(1)} · {fileType.toUpperCase()} ·
                Faithfulness {analysis.overallScore}%
              </p>
            </div>

            {done ? (
              <span className="download-pill">Downloaded</span>
            ) : (
              <button
                className="btn btn-primary"
                disabled={downloading}
                onClick={handleDownload}
                type="button"
              >
                {downloading ? "Preparing…" : `Download ${fileType.toUpperCase()}`}
              </button>
            )}
          </div>

          {done ? (
            <div className="download-card-footer">
              <span>
                {analysis.id}-{format}.{fileType}
              </span>
              <button className="link-button" onClick={() => router.push("/dashboard")} type="button">
                Back to dashboard →
              </button>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
