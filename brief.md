**AI Learning-Game Generator**

Project Brief \- AI20K-064  |  Team \- 127

**1\. Audience & problem**

* **Persona (users):** the "preparing teacher" \- lower/upper-secondary teachers who design and run lessons. The tool is teacher-facing (teacher-in-the-loop), not student-facing.  
    
* **Primary persona:** secondary-school teacher preparing an engaging lesson; needs ready-to-use interactive activities fast.  
    
* **Pain point:** when introducing abstract or dry topics, students disengage. Teachers already improvise with games/videos, but (a) building a good per-lesson interactive game is slow, (b) content is *"easy to find, hard to pick"* \- too much, poor lesson-fit, (c) many *don't know how to start* with AI, and (d) they don't trust AI output to be accurate enough to bring into class. Survey (11 teachers) confirms: **accuracy/faithfulness is the \#1 adoption gate**, and *time-to-fix wrong output* is the \#1 churn reason.

**2\. How the system works & output**

* **Processing:** teacher selects subject, class, difficulty \-\> teacher writes a prompt (topic / learning objective / grade, optional source material) → AI **suggests a suitable game template** from a pre-built library → AI **generates the game content as schema-valid JSON** for that template → content passes a fidelity \+ safety gate → JSON is **injected into the pre-coded game shell** → playable game. AI never runs arbitrary code; it only fills validated content into a fixed shell.  
    
* **Content structure:** per game \- question / correct answer / distractors / hint / explanation, all mapped to the lesson objective. Distractors target known misconceptions; the correct answer must be entailed by the source, distractors verifiably wrong.  
    
* **Output formats:** ready-to-play browser mini-games \- quiz, matching/memory, timeline-ordering, fill-in-the-blank, crossword, character-guess. Teachers can preview → edit → approve → use in class or assign.

**3\. Core asset (the differentiator)**

A curated **game-template library \+ strict per-template JSON schema \+ a fidelity/validation layer**. The hard, defensible part is not "generating" content (commodity) but mapping *lesson objective → right game mechanic → schema-valid, faithful, age-appropriate content* that a teacher can trust without rework. This is the true differentiator versus generic prompting (ChatGPT) or manual tools (Canva/Quizizz) \- and directly answers the survey's top demand.

**4\. Scope (reduced)**

* **Mode:** Gamification  
* **Domain:** start with one pilot subject (bounded scope, lower factual/illustration risk), extend to others later. Curriculum-aligned to GDPT 2018\.  
    
* **Architecture & deployment:** generic game engine/shell \+ per-template schema \+ content-generation pipeline, separated for easy extension to new games/subjects. Web app with a public URL, authentication, and a complete teacher dashboard (prompt → suggest → preview → edit → approve → play). No notebook/CLI/localhost prototype.

**5\. Pipeline**

Teacher prompt (+ optional PDF) → parse source (PyMuPDF / OCR) \+ retrieve curriculum context (RAG) → **game recommender** picks a fitting template (supervisor) → **content generator** emits schema-valid JSON for that template (worker) → **fidelity gate**: NLI faithfulness vs source \+ correct-answer entailment \+ distractor verifiably-wrong \+ age/safety classifier → schema validation → inject into pre-coded game shell → teacher preview / edit / approve → publish & play.

**6\. Metrics**

| Most important | Content fidelity \- generated Q/A/content must be entailed by / consistent with the source & curriculum (NLI entailment); correct answer entailed, distractors verifiably wrong. Target faithfulness \> 0.80, hallucination \< 5%. |
| :---- | :---- |
| **Early** | Teacher approval rate without edits \- proxy for *"correct on first try, little rework"*; tested early with teachers to iterate (rework time is the main churn driver). |
| **Supporting** | In-class engagement uplift |

