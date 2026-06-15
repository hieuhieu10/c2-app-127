**Product Requirements Document**

AI Learning-Game Generator \- AI20K-064 | Team 127

# **1\. Overview**

AI Learning-Game Generator is a web application that turns a teacher's lesson request into a ready-to-play interactive mini-game. The teacher selects subject, class and difficulty and describes a topic or learning objective; the system recommends a suitable game template from a pre-built library, generates the game content as schema-valid JSON, checks that content for faithfulness and age-appropriateness, and injects it into a pre-coded game shell. The teacher previews, edits, approves, and uses the game in class. The AI only fills validated content into fixed game shells \- it never runs arbitrary code \- and every game is aligned to a GDPT 2018 learning objective ("yêu cầu cần đạt").

# **2\. Problem statement**

When a lesson introduces an abstract or dry topic, students disengage. Teachers already know that games and visuals re-capture attention, and most improvise with them, but turning that instinct into a good, lesson-fit interactive activity is slow and unreliable. Generic content is *"easy to find, hard to pick"* \- there is too much of it and little of it maps cleanly to the specific objective the teacher must cover. General-purpose AI (ChatGPT) can produce activities, but teachers cannot tell when it has invented or distorted a fact, and that is precisely the risk they will not take into a classroom.

The gap is therefore both a *production* gap (building a fitting interactive game per lesson is slow) and a *trust* gap (AI output is not dependable enough to use without rework).

## **Pain point**

**A teacher who wants an engaging, curriculum-correct interactive activity for a specific lesson has no fast, trustworthy way to produce one.** Building it by hand is slow; adapting generic material is fiddly; and AI-generated activities cannot be trusted without checking and fixing every item \- which costs the very time the teacher was trying to save.

This pain point manifests as:

* **Production time cost:** designing a good per-lesson interactive game (questions, distractors, mechanics) is slow, and finding fitting ready-made content means sifting through too many poorly-matched options.  
    
* **Lesson-fit gap:** teachers need activities tied to the exact objective they must teach, not generic quizzes only loosely related to the topic.  
    
* **Trust risk:** generic AI paraphrasing can fabricate facts, teach a misconception as correct, or pitch content at the wrong level \- with no signal to the teacher when it does.  
    
* **Adoption barrier:** many teachers want to use AI but *don't know how to start*, and abandon a tool the moment its output requires repeated fixing.

A survey of 11 teachers confirms the priorities: **content accuracy/faithfulness is the \#1 condition for bringing AI output into class**, and **time spent fixing wrong output is the \#1 reason teachers stop using a tool**. No teacher chose free-form creative content alone over interactive games.

# **3\. Goals & non-goals**

## **3.1. Goals**

* **Recommend a fitting game** for a teacher's lesson request from a pre-built template library, with a short rationale.  
    
* **Generate game content as schema-valid JSON** for the chosen template \- question, correct answer, misconception-targeting distractors, hint, explanation \- mapped to a GDPT 2018 learning objective.  
    
* **Control faithfulness and safety** via a directional NLI check (correct answer entailed by the source/curriculum; distractors verifiably wrong) plus an age/curriculum-appropriateness gate, before any content reaches the game shell.  
    
* **Keep the teacher in the loop:** preview → edit → approve, so only teacher-approved games are used in class.  
    
* **Ship a complete web app** with a public URL, authentication, and a complete teacher dashboard.

## **3.2. Non-goals (out of scope for the MVP)**

* Student-facing accounts or autonomous student use \- the tool is teacher-facing.  
    
* Free-form creative content as a standalone product (stories / images / songs) \- future roadmap, and only in service of games.  
    
* Adaptive difficulty and per-student personalization \- phase 2\.  
    
* AI generating arbitrary, executable mini-games \- only validated content injected into fixed, pre-coded shells.  
    
* More than one pilot subject in the MVP \- additional subjects are added later via config \+ curriculum KB.

# **4\. User personas**

The tool is teacher-facing (teacher-in-the-loop). Students are the ultimate audience whose in-class engagement measures success, but they do not operate the tool.

| Persona | Description & needs | Role |
| :---- | :---- | :---- |
| Preparing teacher (secondary school) | Designs and runs lessons; needs ready-to-use interactive activities tied to a specific objective, fast and trustworthy enough to use without rework. | Primary user |
| Student (in-class player) | Plays the approved game during the lesson; the engagement/learning outcome is the success signal. Not a direct user of the app. | Indirect beneficiary |

# **5\. Scope**

## **5.1. In scope**

* **Input:** subject \+ class \+ difficulty selection; a topic/objective prompt; an optional source material (PDF/text); a linked GDPT 2018 learning objective.  
    
* **Processing:** recommend a game template, generate schema-valid content, check faithfulness \+ safety, validate against schema.  
    
* **Output:** ready-to-play browser mini-games (quiz, matching/memory, timeline-ordering, fill-in-the-blank, crossword, character-guess), previewable and editable, then approved and launched in class or shared by link.  
    
* **System:** web app deployed online, authentication, a library/history of created and approved games.

## **5.2. Overall architecture**

Cleanly separate the **generic engine** (game shells, schema validator, orchestration pipeline) from the **domain-specific data** (GDPT 2018 curriculum objectives, per-subject misconception bank, few-shot examples, game-template metadata) held as config/data. Goal: adding a new game \= adding a shell \+ schema; adding a new subject \= adding curriculum config \+ objectives \- neither requires rewriting the core pipeline.

# **6\. Functional requirements**

Priority: **P0** \= required for the MVP, **P1** \= nice to have, **P2** \= roadmap.

| ID | Epic | Requirement (user story) | Priority |
| :---- | :---- | :---- | :---- |
| FR-01 | Lesson setup | As a teacher, I select subject, grade, and difficulty for the activity. | P0 |
| FR-02 | Lesson setup | As a teacher, I describe the topic / learning objective in a prompt and optionally upload source material (PDF/text). | P0 |
| FR-03 | Lesson setup | As a teacher, I see processing status (recommending / generating / checking / done). | P0 |
| FR-04 | Game recommendation | As a teacher, I receive a recommended game template fitting my objective and content type, with a short rationale. | P0 |
| FR-05 | Game recommendation | As a teacher, I override the recommendation and pick a different template from the library. | P1 |
| FR-06 | Content generation | As a teacher, the system generates the game content as schema-valid JSON for the chosen template (question / answer / distractors / hint / explanation). | P0 |
| FR-07 | Content generation | As a teacher, distractors target known misconceptions and are verifiably wrong, while the correct answer is supported by the source/curriculum. | P0 |
| FR-08 | Content generation | As a teacher, I adjust the number of items, difficulty, or language register. | P1 |
| FR-09 | Fidelity & safety | As a teacher, I see a per-item faithfulness score and a flag on any item below threshold. | P0 |
| FR-10 | Fidelity & safety | As a teacher, content must pass an age- and curriculum-appropriateness gate before it can be played. | P0 |
| FR-11 | Preview & approve | As a teacher, I preview the playable game before using it. | P0 |
| FR-12 | Preview & approve | As a teacher, I edit any item inline, which re-runs validation. | P0 |
| FR-13 | Preview & approve | As a teacher, I approve a game; only approved games are usable in class. | P0 |
| FR-14 | Play & assign | As a teacher, I launch and play the game in the browser during class. | P0 |
| FR-15 | Play & assign | As a teacher, I share/assign the game to students via a link. | P1 |
| FR-16 | Play & assign | As a teacher, I see basic play results (scores, misconception hits) after a session. | P2 |
| FR-17 | Account | As a teacher, I register / log in (email \+ OAuth). | P0 |
| FR-18 | Account | As a teacher, I view a library/history of the games I have created and approved. | P1 |

## 

## **6.1. Acceptance criteria (key P0 flows)**

* **FR-04/07:** the recommender always returns a valid template \+ rationale; generated content is **always schema-valid before injection** \- invalid JSON is repaired or regenerated and never reaches the game shell.  
    
* **FR-07:** the correct answer is entailed by the retrieved source/curriculum (entailment \> threshold); each distractor is checked to be *not entailed* and ideally contradicted, so a misconception is never presented as a plausibly-correct answer.  
    
* **FR-09/10:** a faithfulness score is shown per item; items below threshold are highlighted; content failing the age/curriculum-safety gate is blocked from play and surfaced to the teacher.  
    
* **FR-12/13:** edits re-trigger validation; a game can be approved only when all items are schema-valid and pass the fidelity \+ safety gate.

# **7\. Non-functional requirements**

* **Deployment:** public URL (Vercel for the frontend, Render/Railway for the backend); no notebook/CLI/localhost prototype.  
    
* **Performance:** generation \+ checking time reasonable for a web experience (target tens of seconds, with progress states); NLI runs serverless via HuggingFace Inference, no dedicated GPU.  
    
* **Safety by construction:** the AI emits only content (JSON) into fixed, pre-coded shells; it never executes arbitrary code. Schema validation is a hard gate.  
    
* **Security:** authentication via Supabase (email \+ OAuth); each teacher accesses only their own data, enforced via Row-Level Security; uploaded files accessible only to their owner; student play data (if enabled) minimized and consent-aware.  
    
* **Extensibility:** new game \= shell \+ schema; new subject \= curriculum config \+ objectives \+ misconception bank \- no change to the core pipeline.  
    
* **Cost:** prioritize free tiers (HF Inference, Supabase, Vercel) for the MVP; LLM API cost controlled via item limits and caching.

# **8\. Architecture & processing pipeline**

**Pipeline:** teacher input (subject/class/difficulty \+ prompt \+ linked GDPT objective \+ optional PDF) → parse source (PyMuPDF / OCR) \+ retrieve curriculum context (RAG over the GDPT 2018 KB) → **game recommender** picks a fitting template (supervisor) → **content generator** emits schema-valid JSON for that template (worker) → **fidelity \+ safety gate** (answer entailment \+ distractor verifiably-wrong \+ age/curriculum classifier) → schema validation → inject into the pre-coded game shell → teacher preview / edit / approve → publish & play.

## **8.1. Components**

* **Frontend** Next.js \+ Tailwind: lesson setup, objective picker, recommendation view, game preview/edit, fidelity flags, play & share. Hosts the pre-coded game shells.  
    
* **Backend** FastAPI: parse source, orchestrate the multi-agent pipeline, run NLI \+ safety checks, validate JSON, store results.  
    
* **AI core** Claude API for recommendation and content generation, organized as a supervisor–worker multi-agent flow (LangGraph): recommender \= supervisor, content generator \= worker; a multilingual cross-encoder NLI model for faithfulness; an embedding model for curriculum/source retrieval.  
    
* **Game engine** a library of pre-coded React game shells, each with a strict JSON schema and a schema validator; AI-generated content is injected only after passing validation and the fidelity/safety gate.  
    
* **Data** Supabase (Auth \+ DB \+ storage); a vector store (pgvector/Weaviate) for curriculum \+ source retrieval; the GDPT 2018 curriculum KB, misconception bank, and template metadata held as config/data, kept separate per subject.

## **8.2. Visualization**

* Objective → mechanic map: which learning objective each game covers.  
    
* Misconception-coverage view: which common misconceptions the distractors target for a lesson.

# **9\. Core asset (the differentiator)**

The defensible asset is not "generating" content (a commodity) but the layer that maps *lesson objective → right game mechanic → schema-valid, faithful, age-appropriate content* a teacher can trust without rework. It has four parts, curated by the developer as config/data for the MVP:

* **Game-template library** \- each template is a pre-coded React shell \+ a strict JSON schema \+ metadata describing which content structures and objective types it fits, and the grade range it suits.  
    
* **GDPT 2018 curriculum KB** \- the program's required outcomes ("yêu cầu cần đạt") per subject / grade / topic, stored as structured, queryable data. The program is publicly issued (MOET), so it is the safe backbone for *what to teach* and the grounding for keeping content in-scope; it also enables objective-linking (FR-03), in-scope grounding, and tagging games by objective for reuse.  
    
* **Misconception bank & few-shot examples** \- per subject, common student misconceptions that drive high-quality distractors, plus (objective, good game-content) example pairs.  
    
* **Content schema \+ validation layer** \- the strict schemas and the fidelity/safety gate that together guarantee only correct, in-scope, age-appropriate content reaches a game.  
    
* **Pilot test set** \- a fixed set of objectives/lessons for the pilot subject, used to evaluate faithfulness, distractor quality, and coverage.

# **10\. Fidelity & safety control mechanism**

**Important distinction:** the check is not topic similarity (cosine), which only measures shared subject and cannot catch a wrong answer; it is directional NLI entailment \- "is this game item supported by the source/curriculum?". Premise \= the source content \+ linked objective; hypothesis \= a generated claim (the correct answer, the explanation, or a distractor under test).

## **10.1. Procedure**

* **Build the premise:** chunk and embed the teacher's source material and retrieve the relevant passages, combined with the linked GDPT 2018 objective and curriculum KB context.  
    
* **Decompose the item:** for each generated game item, separate the correct answer, the explanation/hint, and each distractor into atomic claims.  
    
* **Two-way check:**  
    
  * *Correct answer & explanation* \- must be entailed: max P(entailment) over retrieved premises \> threshold (e.g. 0.80).  
  * *Distractors* \- must be **verifiably wrong**: not entailed, and ideally contradicted, so a misconception is never taught as plausibly true. A distractor that the model entails is rejected/regenerated.


* **Schema validation:** the item's JSON must conform to the template schema \- a hard gate; failures are repaired or regenerated, never injected.  
    
* **Age/curriculum-safety gate:** a classifier checks age-appropriateness and that content stays within the linked objective's scope; flagged content is blocked from play.  
    
* **Item & game score:** per-item entailment scores roll up to a game-level faithfulness score and a flag count surfaced to the teacher.

## **10.2. Technical notes**

* **Multilingual NLI** \- content is in Vietnamese, so use a multilingual NLI model (e.g. mDeBERTa-v3 XNLI / XLM-R XNLI) rather than English-only; avoid back-translation, which compounds errors. English-first is acceptable if a subject's pilot content is in English.  
    
* **Retrieve from full source, not a snippet** \- the premise must come from the retrieved source \+ curriculum context; checking against a single passage wrongly flags items the full context supports.  
    
* **Distractor verification is the sharp edge** \- the two-way constraint (answer entailed *and* distractor verifiably wrong) is what stops the system from quietly teaching misconceptions; calibrate both thresholds on the pilot set.  
    
* **Upgrades (for rigorous evaluation)** \- SummaC / AlignScore / QAFactEval / Vectara HHEM when higher accuracy than a plain cross-encoder is needed.

# **11\. Metrics & evaluation plan**

| Group | Metric | Target |
| :---- | :---- | :---- |
| Most important | Content fidelity \- correct answer \+ explanation entailed by source/curriculum (NLI) | \> 0.80 |
| Most important | Distractor verifiably-wrong rate | High; misconception-as-answer ≈ 0 |
| Most important | Hallucination rate (human-labeled) | \< 5% |
| Early | Teacher approval-without-edits rate (first-try correctness) | Measure & improve iteratively |
| Supporting | Time-to-create a game vs manual | Clear reduction |
| Supporting | In-class engagement uplift | Positive |
| Supporting | Game-mechanic & objective coverage | Broad |
| Supporting | Task completion rate (session logs) | High |

Evaluated on the pilot subject's objective/lesson test set. The teacher approval-without-edits metric is set up **early** (a quick rating in the preview/approve flow) to create an improvement loop for prompts / schemas / misconception bank from mid-sprint, since rework time is the main churn driver.

# **12\. Tech stack**

| Layer | Technology |
| :---- | :---- |
| Frontend | Next.js \+ Tailwind CSS (Vercel); pre-coded React game shells |
| Backend | FastAPI (Render/Railway); source parsing via PyMuPDF \+ OCR |
| Recommendation & generation | Claude API in a supervisor–worker multi-agent flow (LangGraph) |
| Fidelity & safety | Multilingual cross-encoder NLI via HuggingFace Inference; embedding model for retrieval; JSON-Schema validator; age/curriculum-safety classifier |
| Curriculum & data | GDPT 2018 curriculum KB \+ misconception bank \+ template metadata (config/data); vector store (pgvector/Weaviate) |
| Auth & data | Supabase Auth (email \+ OAuth), DB, storage, RLS |
| Infrastructure | Low-infra, no dedicated GPU; free tiers prioritized for the MVP |

# **13\. 6-week implementation plan**

| Week | Content |
| :---- | :---- |
| Week 1 | Repo, Next.js \+ FastAPI skeleton, Supabase Auth; lesson-setup flow (subject/class/difficulty \+ prompt \+ optional PDF parse). Initialize GDPT 2018 curriculum KB v0 for the pilot subject, 2–3 game shells \+ schemas, and the pilot test set (FR-01/02/03/04/20). |
| Week 2 | Game recommender (supervisor) \+ content generator (worker) → schema-valid JSON; injection into the first shells; preview (FR-06/08/14). |
| Week 3 | Fidelity \+ safety gate: answer entailment \+ distractor verifiably-wrong \+ schema validation \+ age/curriculum classifier; per-item scores, flags, source/objective mapping (FR-09/11/12/13). |
| Week 4 | Edit/approve loop \+ more templates (matching, timeline, fill-in-the-blank); launch in class \+ share link (FR-07/10/15/16/17/18). |
| Week 5 | Objective tagging & coverage view; teacher approval-without-edits feedback loop; game library/history; UI/UX polish (FR-21). |
| Week 6 | Evaluate on the pilot test set, calibrate thresholds/prompts/schemas; deploy to production; write report \+ prepare demo. |

# **14\. Risks & open questions**

## **14.1. Risks**

* **Multilingual NLI accuracy:** Vietnamese NLI is weaker than monolingual English \- test and calibrate thresholds early on the pilot set.  
    
* **LLM JSON-schema compliance:** the model may emit invalid or partially-valid JSON \- enforce strict schema validation with a repair/regenerate loop; malformed content never reaches a shell.  
    
* **Distractor quality:** AI may produce distractors that are actually correct or ambiguous \- mitigated by the two-way NLI check plus mandatory teacher approval.  
    
* **Curriculum data effort:** digitizing GDPT 2018 objectives is real work, and official textbooks are image flipbooks needing OCR \- bound the MVP to one subject \+ grade band, and ground on the public *objectives* rather than redistributing textbook prose.  
    
* **Scope creep:** many game templates in 6 weeks \- ship 2–3 first (P0), add the rest as P1/P2.  
    
* **Source-material copyright:** teachers may upload textbook scans \- ground on public curriculum objectives \+ the teacher's own material; do not store or redistribute textbook text.

## **14.2. Open questions**

* Which pilot subject and grade band should bound the curriculum KB for the MVP?  
    
* How many teacher edits are acceptable before an output counts as a "fail" (the approval-without-edits threshold)?  
    
* Should student play-results be captured, given these are minors (privacy/consent)? \- currently P2.

