import type { Analysis, ProposalSection } from "@/lib/types";

const sampleSections: ProposalSection[] = [
  {
    key: "problem",
    title: "Problem",
    score: 96,
    body:
      "Reading dense academic papers is slow and error-prone. Researchers, students, and decision-makers struggle to extract the core argument, separate verified findings from speculation, and judge whether a method actually holds up. The paper argues that existing summarization tools hallucinate claims that are not supported by the source text.",
    claims: [
      {
        id: "p1",
        text: "Existing summarization tools hallucinate claims not supported by the source text.",
        faithfulness: "high",
        score: 94,
        source: {
          section: "Introduction",
          page: 1,
          passage:
            "We observe that 31% of model-generated summaries contain at least one statement that cannot be traced back to the original document.",
        },
      },
    ],
  },
  {
    key: "solution",
    title: "Solution",
    score: 91,
    body:
      "The authors propose a retrieval-grounded generation pipeline that ties every generated sentence to a specific passage in the source paper. A verification model scores each claim for faithfulness before it is shown to the reader, and unsupported claims are flagged rather than silently dropped.",
    claims: [
      {
        id: "s1",
        text: "Each generated sentence is grounded to a specific source passage.",
        faithfulness: "high",
        score: 92,
        source: {
          section: "Method · 3.2",
          page: 4,
          passage:
            "For every output sentence s, we retrieve the top-k passages and require an alignment score above threshold before emission.",
        },
      },
      {
        id: "s2",
        text: "A verification model scores faithfulness before display.",
        faithfulness: "medium",
        score: 78,
        source: {
          section: "Method · 3.4",
          page: 5,
          passage:
            "A lightweight NLI-based verifier assigns a calibrated faithfulness probability to each candidate claim.",
        },
      },
    ],
  },
  {
    key: "evidence",
    title: "Evidence",
    score: 88,
    body:
      "On three benchmark datasets, the pipeline reduces unsupported claims by 64% while keeping summary coverage comparable to strong baselines. Human raters preferred the grounded summaries in 72% of pairwise comparisons.",
    claims: [
      {
        id: "e1",
        text: "Unsupported claims drop by 64% across three benchmarks.",
        faithfulness: "high",
        score: 90,
        source: {
          section: "Results · Table 2",
          page: 7,
          passage:
            "Hallucination rate falls from 31.2% to 11.3% averaged across XSum, arXiv, and PubMed test splits.",
        },
      },
      {
        id: "e2",
        text: "Human raters preferred grounded summaries 72% of the time.",
        faithfulness: "medium",
        score: 74,
        source: {
          section: "Results · 4.3",
          page: 8,
          passage:
            "In a blind study, grounded outputs won 72% of head-to-head preference judgments.",
        },
      },
    ],
  },
  {
    key: "feasibility",
    title: "Feasibility",
    score: 71,
    body:
      "The approach runs on a single mid-range GPU and adds roughly 1.4x latency over a plain generation baseline. The authors claim it scales to documents up to 50 pages, though this is only lightly tested.",
    claims: [
      {
        id: "f1",
        text: "Adds about 1.4x latency over a plain generation baseline.",
        faithfulness: "medium",
        score: 70,
        source: {
          section: "Analysis · 5.1",
          page: 9,
          passage:
            "End-to-end latency increases by a factor of 1.38 relative to the ungrounded decoder.",
        },
      },
      {
        id: "f2",
        text: "Scales reliably to documents up to 50 pages.",
        faithfulness: "low",
        score: 41,
        source: {
          section: "Limitations · 6",
          page: 10,
          passage:
            "We did not systematically evaluate documents beyond 20 pages; longer inputs are left to future work.",
        },
      },
    ],
  },
  {
    key: "differentiation",
    title: "Differentiation",
    score: 84,
    body:
      "Unlike prior work that verifies summaries after generation, this method enforces grounding during decoding. That makes the faithfulness signal actionable in real time rather than a post-hoc filter.",
    claims: [
      {
        id: "d1",
        text: "Grounding is enforced during decoding, not post-hoc.",
        faithfulness: "high",
        score: 87,
        source: {
          section: "Related Work · 2",
          page: 3,
          passage:
            "In contrast to post-generation fact-checking, our constraint is applied inline at each decoding step.",
        },
      },
    ],
  },
  {
    key: "impact",
    title: "Impact",
    score: 79,
    body:
      "If adopted, faithfulness-first summarization could make literature review faster and more trustworthy for non-experts. The authors suggest applications in clinical and legal domains, where unsupported claims carry real risk.",
    claims: [
      {
        id: "i1",
        text: "Could enable trustworthy literature review for non-experts.",
        faithfulness: "medium",
        score: 68,
        source: {
          section: "Discussion · 7",
          page: 11,
          passage:
            "We hypothesize that grounded summaries lower the barrier for non-specialists, though user studies are needed.",
        },
      },
    ],
  },
];

export const mockAnalyses: Analysis[] = [
  {
    id: "faithful-summ",
    title: "Faithfulness-First: Grounded Summarization of Scientific Papers",
    authors: "Chen, Okafor, Lindqvist et al.",
    source: "arXiv:2407.01123",
    status: "processed",
    date: "2026-05-28",
    format: "Summary",
    overallScore: 85,
    comprehension: 82,
    sections: sampleSections,
  },
  {
    id: "graph-rag",
    title: "Graph-Augmented Retrieval for Long-Document Reasoning",
    authors: "Nakamura, Bauer et al.",
    source: "PDF · graph_rag_final.pdf",
    status: "processed",
    date: "2026-05-21",
    format: "Slides",
    overallScore: 78,
    comprehension: 74,
    sections: sampleSections,
  },
  {
    id: "protein-fold",
    title: "Diffusion Priors for De Novo Protein Folding",
    authors: "Adebayo, Rossi, Tanaka et al.",
    source: "DOI:10.1038/s41586-026",
    status: "processed",
    date: "2026-05-09",
    format: "Infographic",
    overallScore: 91,
    comprehension: 88,
    sections: sampleSections,
  },
];
