**AI Science Communication Assistant**

Project Brief \- AI20K-040  |  Team \- 127

**1\. Audience & problem**

* **Persona (output readers):** the “adviser” \- Technology Transfer Office (TTO) officers and deep-tech VC analysts. Familiar with the field but not deep research specialists; interested in papers that researchers want to fund / commercialize.

* **Primary persona:** TTO officer (primary), VC analyst (secondary) \- one persona to be locked down to drive the output design.

* **Problem:** the adviser needs to quickly grasp the problem – solution – evidence – feasibility without reading the original paper. The gap is both the conceptual framework and the academic language.

**2\. How the system works & output**

* **Processing:** simplify \+ visualize \+ summarize the issues raised in the paper, then reframe them into a proposal in plain language.

* **Content structure:** problem → solution → evidence → feasibility, plus market differentiation and impact.

* **Output formats:** multiple \- summary, slides, infographic \- packaged as ready-to-use proposal material. Group B is treated more broadly (covering the whole pitch flow) rather than narrowly.

**3\. Knowledge Base (core asset)**

Build a Knowledge Base for paraphrasing academic language → plain language: term mapping, expression templates, analogies, and few-shot examples for AI/ML. This is the true differentiator versus generic prompting (ChatGPT) \- and the foundation for staying faithful while simplifying.

**4\. Scope (reduced)**

* **Mode:** Pitcher only; Explain Mode moves to the future roadmap.

* **Domain:** AI/ML \- as a domain expert, can build the KB and evaluate test cases.

* **Architecture & deployment:** separate generic pipeline / domain config \+ KB for easy extension. Web app deployed online with a public URL, authentication, and a complete UI/UX \- no notebook/CLI/localhost prototype.

**5\. Pipeline**

Upload PDF → parse (PyMuPDF) to extract text \+ structure → segment & detect hard terms/passages → simplify \+ reframe into a proposal (problem / solution / evidence / feasibility) using KB paraphrasing → factual-consistency check (NLI) against the source → render multi-format (summary / slides / infographic) \+ visualization.

**6\. Metrics**

| Most important | Similarity between generated content and the source (semantic similarity / NLI entailment) \- ensures no fabrication or over-claim. Target \> 0.80. |
| :---- | :---- |
| **Early** | Reader comprehension \- tested early (with readers / a proxy) to iterate and improve the model. |
| **Supporting** | Readability delta (Flesch-Kincaid)  |  Hallucination rate \< 5%  |  Task completion rate. |

