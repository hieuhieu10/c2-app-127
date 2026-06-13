"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadPanel() {
  const router = useRouter();
  const [tab, setTab] = useState<"file" | "link">("file");
  const [fileName, setFileName] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [dragging, setDragging] = useState(false);
  const canSubmit = tab === "file" ? Boolean(fileName) : link.trim().length > 5;

  return (
    <main className="narrow-page">
      <button className="back-link" onClick={() => router.push("/dashboard")} type="button">
        ← Back to dashboard
      </button>

      <div className="section-copy">
        <h1>New analysis</h1>
        <p>Upload a paper as a PDF, or paste a DOI / arXiv link to fetch it.</p>
      </div>

      <div className="tab-switch">
        <button
          className={tab === "file" ? "tab-switch-active" : ""}
          onClick={() => setTab("file")}
          type="button"
        >
          PDF file
        </button>
        <button
          className={tab === "link" ? "tab-switch-active" : ""}
          onClick={() => setTab("link")}
          type="button"
        >
          DOI / arXiv link
        </button>
      </div>

      {tab === "file" ? (
        <label
          className={`dropzone ${dragging ? "dropzone-dragging" : ""}`}
          onDragLeave={() => setDragging(false)}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) {
              setFileName(file.name);
            }
          }}
        >
          <input
            accept="application/pdf"
            className="drop-input"
            onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
            type="file"
          />
          <div className="dropzone-icon" aria-hidden="true">
            ↑
          </div>
          {fileName ? (
            <strong>{fileName}</strong>
          ) : (
            <>
              <strong>Drop your PDF here, or click to browse</strong>
              <span>Up to 50 pages · PDF only</span>
            </>
          )}
        </label>
      ) : (
        <div className="link-panel">
          <label>
            DOI or arXiv URL
            <input
              onChange={(event) => setLink(event.target.value)}
              placeholder="https://arxiv.org/abs/2407.01123"
              value={link}
            />
          </label>
          <p>Example: `10.1038/s41586-026` or `arXiv:2407.01123`</p>
        </div>
      )}

      <button
        className="btn btn-primary btn-full btn-lg"
        disabled={!canSubmit}
        onClick={() => canSubmit && router.push("/processing")}
        type="button"
      >
        Analyze paper
      </button>
    </main>
  );
}
