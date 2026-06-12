# AI/ML Paper Simplification Knowledge Base

This seed Knowledge Base supports faithful explanations of AI/ML/DL paper
passages for smart non-technical readers. Its target output is organized into
`problem`, `solution`, `evidence`, and `feasibility`.

## Contents

- `config.yaml`: version, supported tags, retrieval, and generation rules.
- `glossary.json`: sourced term definitions and plain-language explanations.
- `templates.yaml`: uncertainty-preserving explanation patterns.
- `few_shot/*.jsonl`: sourced, paraphrased rewrite demonstrations by subfield.
- `test_set/metadata.csv`: a balanced 30-paper evaluation manifest.
- `test_set/papers/`: optional local cache for legally obtained paper content.

The seed contains 20 glossary terms, 12 templates, and 10 few-shot examples.
Expand the glossary toward 80-150 entries and the few-shot collection toward
30-60 examples after human review.

## Suggested RAG Pipeline

1. Classify the source passage by subfield and output section.
2. Extract hard terms and retrieve matching glossary entries.
3. Retrieve two or three few-shot examples filtered by subfield and section.
4. Retrieve one matching template. Treat it as guidance, not required wording.
5. Generate an explanation using only claims supported by the source passage
   and clearly identified paper context.
6. Run a faithfulness pass that checks numbers, comparison direction,
   uncertainty, scope, and whether interpretations are labeled as such.
7. Return citations or source links alongside the explanation.

Do not let retrieved glossary knowledge add a result or capability claim that
is absent from the paper passage. Glossary entries may clarify a term; they are
not evidence for the paper.

## Prompt Contract

Ask the model to:

- explain to a smart reader without assuming ML training;
- preserve qualifiers such as “may,” “on the tested tasks,” and “under this
  setup”;
- distinguish the authors' report from the system's interpretation;
- explain metrics before interpreting their values;
- state important data, compute, comparison, and evaluation limitations;
- avoid words such as “proves,” “solves,” or “understands” unless the source
  explicitly justifies them.

## Retrieval and Evaluation

Index glossary fields, template intent/text, and few-shot passages and rewrites.
Store `subfield`, `section`, and source fields as filterable metadata. Evaluate
on the 30-paper manifest using held-out passages and score:

- faithfulness: no unsupported or strengthened claims;
- clarity: understandable without specialist vocabulary;
- coverage: captures the important source information;
- uncertainty preservation: retains scope and limitations;
- traceability: each explanation can be connected to its source.

Have domain reviewers inspect a sample before each KB version is released.
Record additions and corrections by incrementing `kb_version`.

## Source and Copyright Policy

Definitions and demonstrations are paraphrased. URLs are retained for
traceability. Do not ingest or redistribute full papers unless their licenses
permit it. Short source passages used for evaluation should remain minimal and
be accompanied by source metadata.
