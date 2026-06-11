**Product Requirements Document**

AI Science Communication Assistant

# **1\. Overview**

AI Science Communication Assistant is a web application that turns an AI/ML/DL research paper into plain-language proposal material \- summary, slides, and infographic \- so that people deciding on funding can quickly grasp the potential of a piece of research without reading the original paper, while keeping the generated content faithful to the source through an automated factual-consistency check.

# **2\. Problem statement**

Valuable AI/ML/DL research that could be commercialized rarely passes the first evaluation gate. The people who decide whether a piece of research is worth funding or licensing \- technology transfer officers and deep-tech investment analysts \- are familiar with the field but are not specialists in the specific research. Yet the papers they must assess are written in dense academic language for expert peers, and researchers who submit them often frame the work in jargon or over-claim its significance.

The gap is therefore both conceptual and linguistic. To judge funding potential, an evaluator needs a clear problem – solution – evidence – feasibility picture, plus a sense of differentiation and impact \- but no current tool produces that from a paper in a fast and trustworthy way.

## **Pain point**

**An evaluator who must decide on a paper's funding potential has no fast, trustworthy way to turn that paper into digestible proposal material.** Reading the dense original is slow and still leaves them without a clear funding-relevant picture; relying on the researcher's own framing risks jargon and unverified over-claims.

This pain point manifests as:

* **High time cost:** extracting the funding-relevant story (problem, solution, evidence, feasibility) from a dense paper is slow and requires expertise the evaluator may not have.

* **Framework gap:** the evaluator needs the research reframed into the terms in which funding decisions are actually made, not merely simplified text.

* **Trust risk:** generic AI paraphrasing (e.g. ChatGPT) can simplify text but gives no signal when it fabricates or over-claims \- exactly the risk an evaluator cannot accept.

* **Tooling gap:** existing tools either help readers understand a paper, or generate slides from generic business ideas \- none turn an academic paper into faithful, plain-language proposal material.

# **3\. Goals & non-goals**

## **3.1. Goals**

* **Generate proposal material** from an AI/ML /DLpaper structured as problem → solution → evidence → feasibility, with market differentiation and impact, in plain language.

* **Multi-format output** (summary, slides, infographic) ready to use as proposal material.

* **Control faithfulness** via a similarity/NLI score between generated content and the source, flagging risky passages.

* **Ship a complete web app** with a public URL, authentication, and a complete UI/UX.

## **3.2. Non-goals (out of scope for the MVP)**

* Explain Mode (popularizing research for researchers in adjacent subfields).

* Domains outside AI/ML (robotics, biology, physics, etc.).

* Automatically generating trustworthy market-size figures \- see Risks.

* End-to-end fundraising workflow or submission management.

# **4\. User personas**

The persona group is the “adviser” \- someone who evaluates funding potential, is familiar with the field but not a deep research specialist, and cares about papers that researchers want to fund or commercialize.

| Persona | Description & needs | Role |
| :---- | :---- | :---- |
| Technology Transfer Office (TTO) officer | Receives papers from researchers; needs to quickly assess commercialization potential and produce material to present to decision-makers. | Primary user |
| VC analyst (deep-tech) | Receives research; needs to evaluate it and produce an internal pitch about the investment opportunity. | Secondary user |

# 

# 

# 

# **5\. Scope**

## **5.1. In scope**

* **Input:** DL paper PDF, in English.

* **Processing:** parse, segment, simplify \+ reframe into a proposal, and check faithfulness.

* **Output:** summary (web), slides, infographic; plain English (default).

* **System:** web app deployed online, authentication, processing history.

## **5.2. Overall architecture**

Clearly separate the generic pipeline from the domain-specific part (Knowledge Base, glossary, few-shot examples, test set) as separate config/data. Goal: extending to an adjacent domain only requires adding new config \+ KB, not rewriting the system.

# **6\. Functional requirements**

Priority: **P0** \= required for the MVP, **P1** \= nice to have, **P2** \= roadmap.

| ID | Epic | Requirement (user story) | Priority |
| :---- | :---- | :---- | :---- |
| FR-01 | Upload & parse | As a user, I upload a paper PDF so the system starts processing. | P0 |
| FR-02 | Upload & parse | As a user, I see the processing status (parsing/generating/done). | P0 |
| FR-03 | Upload & parse | As a user, I enter a DOI/arXiv link instead of uploading a file. | P1 |
| FR-04 | Generate proposal | As a user, I receive a summary structured as problem → solution → evidence → feasibility. | P0 |
| FR-05 | Generate proposal | As a user, I read the content in plain language, free of academic jargon. | P0 |
| FR-06 | Generate proposal | As a user, I see market differentiation and impact. | P0 |
| FR-07 | Generate proposal | As a user, I adjust the length/depth of the output. | P1 |
| FR-08 | Multi-format output | As a user, I view the summary directly on the web. | P0 |
| FR-09 | Multi-format output | As a user, I generate slides from the proposal. | P1 |
| FR-10 | Multi-format output | As a user, I generate a summarizing infographic. | P1 |
| FR-11 | Multi-format output | As a user, I download the output (PDF/PNG). | P1 |
| FR-12 | Faithfulness | As a user, I see the similarity score between generated content and the source. | P0 |
| FR-13 | Faithfulness | As a user, I am warned about sentences at risk of being inaccurate. | P0 |
| FR-14 | Faithfulness | As a user, I click a claim to see the source passage in the paper. | P1 |
| FR-15 | Comprehension | As a user, I quickly rate whether an output is understandable. | P0 |
| FR-16 | Account | As a user, I register / log in (email \+ OAuth). | P0 |
| FR-17 | Account | As a user, I view the history of papers I have processed. | P1 |

## **6.1. Acceptance criteria (key P0 flows)**

* **FR-04/05/06:** the output always contains the four sections (problem/solution/evidence/feasibility) plus differentiation and impact; the language meets a plain-language readability target; each claim in the evidence section maps to a fact present in the paper; no section is left empty when the paper contains the corresponding information.

* **FR-12/13:** a faithfulness score is shown per section; sentences below the threshold (e.g. entailment \< 0.80) are highlighted; sentences flagged by the NLI model with high contradiction are warned separately.

* **FR-16:** each authenticated user can access only their own uploads and outputs; isolation is enforced at the backend (RLS), not only in the UI.

# **7\. Non-functional requirements**

* **Deployment:** public URL (Vercel for the frontend, Render/Railway for the backend); no notebook/CLI/localhost prototype.

* **Performance:** generation time reasonable for a web experience (target tens of seconds, with progress states); NLI runs serverless via HuggingFace Inference, no dedicated GPU.

* **Security:** authentication via Supabase (email \+ OAuth); each user can access only their own data, enforced via Row-Level Security; uploaded files accessible only to their owner.

* **Extensibility:** adding a new domain \= adding config \+ KB, with no change to the core pipeline.

* **Cost:** prioritize free tiers (HF Inference, Supabase, Vercel) for the MVP; LLM API cost controlled via length limits and caching.

# **8\. Architecture & processing pipeline**

**Pipeline:** Upload PDF → parse (PyMuPDF) to extract text \+ structure → segment by section & detect hard terms/passages → simplify \+ reframe into a proposal (problem/solution/evidence/feasibility) using the Knowledge Base paraphrasing → factual-consistency check (NLI) against the source → render multi-format (summary/slides/infographic) \+ visualization.

## **8.1. Components**

* **Frontend** Next.js \+ Tailwind: upload, proposal display, faithfulness highlighting, format export.

* **Backend** FastAPI: parse PDF, orchestrate the LLM, run NLI, store results.

* **AI core** Claude API for content generation; a cross-encoder NLI model for the faithfulness check; SBERT for source-passage retrieval.

* **Data** Supabase (Auth \+ DB \+ storage); the Knowledge Base stored as config/data, kept separate per domain.

## **8.2. Visualization**

* Problem – solution diagram.

* Claim – evidence map: which claim is supported by which result/passage in the paper.

# **9\. Knowledge Base (core asset)**

The Knowledge Base encodes how to paraphrase academic language into plain language for AI/ML/DL \- the true differentiator versus generic prompting, and the foundation for staying faithful while simplifying. For the MVP it is curated by the developer as config/data (no in-app management UI).

* **Term mapping** academic term → plain-language expression (e.g. “self-attention” → an easy-to-understand description with an analogy).

* **Expression templates & analogies** reusable phrasings for common AI/ML/DL concepts.

* **Few-shot examples** (paper passage, good explanation) pairs by subfield DL.

* **Test set** 30 AI/ML/DL papers to evaluate faithfulness and comprehensibility.

# **10\. Faithfulness control mechanism (NLI)**

**Important distinction:** “similarity” here is not cosine similarity (which only measures shared topic and cannot catch over-claiming) but directional NLI entailment \- it asks “is the generated claim supported by the paper?”. Premise \= the source content, hypothesis \= a sentence/claim in the proposal.

## **10.1. Procedure**

* **Chunk the source:** split the paper into passages and embed them with SBERT (the paper is longer than the \~512-token limit of an NLI cross-encoder).

* **Extract claims:** split the proposal into atomic claims (sentence splitting or LLM claim extraction).

* **Retrieve:** for each claim, take the top-k most relevant source passages (cosine/BM25) as the premise.

* **Run NLI:** for each (source passage, claim) pair, take the max P(entailment) over the candidates.

* **Decide** a claim is supported if max P(entailment) \> threshold (e.g. 0.80); high P(contradiction) raises a hallucination flag.

* **Document score:** average P(entailment) over claims, or the fraction of supported claims.

## **10.2. Technical notes**

* **Cross-lingual** the paper is in English while the output is in Vietnamese → use a multilingual NLI model (e.g. mDeBERTa-v3 XNLI / XLM-R XNLI) rather than English-only NLI; avoid back-translation, which compounds errors.

\-\> Decision: English output first, expand to Vietnamese if we have time.

* **Do not use the abstract only** the premise must be retrieved from the full text; checking against the abstract alone wrongly flags claims that the body supports.

* **Upgrades (for rigorous evaluation)** SummaC / AlignScore / QAFactEval / Vectara HHEM when higher accuracy than a plain cross-encoder is needed.

# **11\. Metrics & evaluation plan**

| Group | Metric | Target |
| :---- | :---- | :---- |
| Most important | Similarity of generated vs source (NLI entailment) | \> 0.80 |
| Early | Reader comprehension | Measure & improve iteratively |
| Supporting | Readability delta (Flesch-Kincaid) | Clear reduction |
| Supporting | Hallucination rate (human-labeled) | \< 5% |
| Supporting | Task completion rate (session logs) | High |

Evaluated on a 30-paper AI/ML/DL test set. The reader-comprehension metric is set up **early** (a quick rating form or a proxy) to create an improvement loop for prompts/KB from mid-sprint rather than only at the end.

# **12\. Tech stack**

| Layer | Technology |
| :---- | :---- |
| Frontend | Next.js \+ Tailwind CSS (deployed on Vercel) |
| Backend | FastAPI (deployed on Render/Railway); PDF parsing via PyMuPDF |
| Content generation | LLM API |
| Faithfulness | Cross-encoder NLI (multilingual) via HuggingFace Inference; SBERT for retrieval |
| Auth & data | Supabase Auth (email \+ OAuth), DB, storage, RLS |
| Infrastructure | Low-infra, no dedicated GPU; free tiers prioritized for the MVP |

# **13\. 6-week implementation plan**

| Week | Content |
| :---- | :---- |
| Week 1 | Set up repo, Next.js \+ FastAPI skeleton, Supabase Auth; upload \+ PyMuPDF parse flow. Initialize KB v0 \+ the 30-paper AI/ML/DL test set (FR-01/02/16). |
| Week 2 | Proposal generation pipeline: segment, extract claims, prompt Claude in the four-section structure \+ differentiation/impact. Web summary output (FR-04/05/06/08). |
| Week 3 | Faithfulness: claim decomposition \+ retrieval \+ multilingual NLI; show scores, highlight risky passages, claim–source map (FR-12/13/14). |
| Week 4 | Multi-format: slides \+ infographic \+ export; problem–solution & claim–evidence visualization (FR-09/10/11). |
| Week 5 | Finalize KB (developer-curated); reader-comprehension feedback form; processing history; polish UI/UX (FR-15/17). |
| Week 6 | Evaluate on 30 papers, tune thresholds/prompts/KB; deploy to production; write report \+ prepare demo. |

# **14\. Risks & open questions**

## **14.1. Risks**

* **Cross-lingual NLI:** English–Vietnamese NLI accuracy is lower than monolingual \- must be tested and the threshold calibrated early.

* **PDF parsing quality:** formulas, tables, and two-column layouts break easily \- needs error handling and clear feedback to the user.

* **Scope creep:** three output formats in 6 weeks \- prioritize the summary (P0) first; slides/infographic (P1) can be cut if time is short.

* **Market-size generation:** AI easily fabricates market size \- by default do not generate figures; provide only qualitative framing unless a source exists.

## **14.2. Open questions**

* Which is the primary persona: TTO officer or VC analyst?

* Should the system generate market-size data, and how to control the risk of wrong figures?

