"""Curriculum retrieval and teacher-context extraction.

GDPT 2018 is the curriculum authority: it decides objective, scope, and allowed
difficulty. Optional teacher-uploaded lesson plans or slides personalize the
examples and template configuration, but they never override curriculum scope.
"""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Any, Literal, Protocol

from pydantic import BaseModel, Field

_KB_ROOT = Path(__file__).resolve().parents[2] / "data" / "gdpt_2018"
_LEGACY_FIXTURE = Path(__file__).resolve().parents[2] / "data" / "fixtures" / "sample_subject.json"

Difficulty = Literal["easy", "medium", "hard"]
ScopeStatus = Literal["below_grade", "in_scope", "above_grade", "out_of_program"]


class Misconception(BaseModel):
    id: str | None = None
    misconception: str
    correct_concept: str


class CurriculumContext(BaseModel):
    objective_id: str
    objective_text: str
    subject: str
    grade: int
    topic: str
    curriculum_difficulty: Difficulty
    allowed_difficulty_range: list[Difficulty]
    scope_status: ScopeStatus = "in_scope"
    cognitive_level: str
    required_skills: list[str] = []
    recommended_question_types: list[str] = []
    not_allowed_question_types: list[str] = []
    grounding_passages: list[str] = []
    scope_policy: dict[str, Any] = {}


class TeacherExample(BaseModel):
    raw_text: str
    structured: dict[str, Any] = {}


class TeacherLessonContext(BaseModel):
    uploaded_file_id: str | None = None
    upload_type: Literal["lesson_plan", "slide", "none"] = "none"
    lesson_title: str | None = None
    subject: str
    grade: int
    topic: str | None = None
    teacher_focus: str
    preferred_examples: list[TeacherExample] = []
    extracted_entities: dict[str, Any] = Field(default_factory=dict)
    lesson_activities: list[str] = []
    time_limit_minutes: int | None = None
    student_level_note: str | None = None
    constraints: list[str] = []


class AlignmentResult(BaseModel):
    is_aligned_with_curriculum: bool
    alignment_confidence: float
    mismatch_warnings: list[str] = []
    recommended_adjustments: list[str] = []


class DifficultyAssessment(BaseModel):
    teacher_requested_difficulty: Difficulty
    final_difficulty: Difficulty
    difficulty_rationale: str


class RetrievedContext(BaseModel):
    """Grounding bundle for one lesson request.

    The flattened fields preserve compatibility with the existing generator
    prompt, while the structured fields support the expanded PRD pipeline.
    """

    objective_id: str
    objective_text: str = ""
    passages: list[str] = []
    misconceptions: list[Misconception] = []
    curriculum_context: CurriculumContext | None = None
    teacher_lesson_context: TeacherLessonContext | None = None
    alignment_result: AlignmentResult | None = None
    difficulty_assessment: DifficultyAssessment | None = None
    matched_confidence: float = 0.0


class RetrievalProvider(Protocol):
    def retrieve(
        self,
        *,
        subject: str,
        grade: int,
        objective_id: str | None,
        prompt: str,
        source_text: str | None = None,
        uploaded_file_id: str | None = None,
        upload_type: str = "none",
        teacher_requested_difficulty: str = "medium",
    ) -> RetrievedContext: ...


def _norm(text: str | None) -> str:
    raw = (text or "").casefold()
    decomposed = unicodedata.normalize("NFD", raw)
    no_marks = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    return no_marks.replace("đ", "d")


def _tokens(text: str | None) -> set[str]:
    stop = {
        "tao",
        "game",
        "ve",
        "va",
        "cac",
        "trong",
        "pham",
        "vi",
        "cho",
        "mot",
        "so",
        "duoc",
        "hoc",
        "sinh",
        "don",
        "gian",
    }
    return {
        token
        for token in re.findall(r"[\w]+", _norm(text), flags=re.UNICODE)
        if len(token) > 1 and token not in stop
    }


def _difficulty_rank(value: str) -> int:
    return {"easy": 0, "medium": 1, "hard": 2}.get(value, 1)


def _clamp_difficulty(requested: str, allowed: list[str]) -> Difficulty:
    if requested in allowed:
        return requested  # type: ignore[return-value]
    if not allowed:
        return "medium"
    return max(allowed, key=_difficulty_rank)  # type: ignore[return-value]


_DOMAIN_HINTS: dict[str, tuple[str, ...]] = {
    "numbers": (
        "so tu nhien",
        "dem so",
        "so sanh so",
        "hang tram",
        "hang chuc",
        "hang don vi",
        "lam tron",
        "so den",
        "cau tao so",
    ),
    "operations": (
        "phep cong",
        "phep tru",
        "phep nhan",
        "phep chia",
        "nhan chia",
        "cong tru",
        "bieu thuc",
        "tim thanh phan",
        "bai toan co loi van",
    ),
    "fractions": (
        "phan so",
        "tu so",
        "mau so",
        "so sanh phan so",
        "cong phan so",
        "tru phan so",
    ),
    "decimals": (
        "so thap phan",
        "thap phan",
    ),
    "percent": (
        "ti so phan tram",
        "ty so phan tram",
        "phan tram",
        "giam gia",
        "%",
    ),
    "geometry": (
        "hinh hoc",
        "hinh vuong",
        "hinh chu nhat",
        "hinh tron",
        "hinh tam giac",
        "goc",
        "duong thang",
        "chu vi",
        "dien tich",
        "the tich",
        "dien tich hinh",
        "the tich hinh",
    ),
    "measurement": (
        "do luong",
        "don vi do",
        "so do",
        "do dai",
        "khoi luong",
        "dung tich",
        "don vi dien tich",
        "don vi the tich",
        "so do dien tich",
        "so do the tich",
        "thoi gian",
        "nhiet do",
        "tien viet nam",
        "xang ti met",
        "ki lo gam",
        "lit",
        "van toc",
    ),
    "data": (
        "thong ke",
        "so lieu",
        "du lieu",
        "bang so lieu",
        "bieu do",
        "bieu do tranh",
        "bieu do cot",
        "bieu do hinh quat",
        "thu thap du lieu",
        "phan loai du lieu",
    ),
    "probability": (
        "xac suat",
        "kha nang xay ra",
        "co the xay ra",
        "chac chan",
        "khong the xay ra",
    ),
}
_DOMAIN_OBJECTIVE_MARKERS: dict[str, tuple[str, ...]] = {
    "numbers": ("numbers", "natural_numbers", "count", "rounding", "place_value", "so tu nhien", "so den"),
    "operations": ("operations", "add", "subtract", "multiplication", "division", "expressions", "phep tinh"),
    "fractions": ("fraction", "fractions", "phan so"),
    "decimals": ("decimal", "decimals", "so thap phan"),
    "percent": ("percent", "ratio", "phan tram", "ti so"),
    "geometry": ("geometry", "shapes", "perimeter", "hinh hoc", "hinh", "goc", "chu vi"),
    "measurement": ("measurement", "measurements", "speed", "do luong", "don vi do", "so do", "dai luong"),
    "data": ("statistics", "data", "charts", "chart", "thong ke", "bieu do", "so lieu"),
    "probability": ("probability", "xac suat", "kha nang xay ra"),
}
_NEGATION_PREFIXES = ("khong", "khong dung", "khong ve", "khong lien quan den", "tranh", "loai bo")
_EXCLUSIVE_HINTS = ("chi ", "chi tao", "chi can", "duy nhat", "only")
_MEASUREMENT_UNIT_PATTERN = re.compile(
    r"\b\d+\s*(cm|mm|m|km|g|kg|l|ml|cm2|dm2|m2|km2|ha|cm3|dm3|m3|gio|phut)\b",
    re.IGNORECASE,
)


def _objective_domains(objective: dict[str, Any]) -> set[str]:
    text = _norm(
        " ".join(
            str(part)
            for part in [
                objective.get("objective_id", ""),
                objective.get("topic", ""),
                objective.get("objective_text", ""),
                *objective.get("search_aliases", []),
                *objective.get("required_skills", []),
            ]
        )
    )
    domains = {
        domain
        for domain, markers in _DOMAIN_OBJECTIVE_MARKERS.items()
        if any(marker in text for marker in markers)
    }
    return domains


def _query_domain_constraints(prompt: str, source_text: str | None) -> tuple[set[str], set[str], bool]:
    text = _norm(f"{prompt} {source_text or ''}")
    requested: set[str] = set()
    excluded: set[str] = set()

    for domain, terms in _DOMAIN_HINTS.items():
        for term in terms:
            if term not in text:
                continue
            if _is_negated_term(text, term):
                excluded.add(domain)
            else:
                requested.add(domain)

    if _MEASUREMENT_UNIT_PATTERN.search(text):
        requested.add("measurement")

    requested -= excluded
    exclusive = bool(requested and any(hint in text for hint in _EXCLUSIVE_HINTS))
    return requested, excluded, exclusive


def _is_negated_term(text: str, term: str) -> bool:
    return any(f"{prefix} {term}" in text for prefix in _NEGATION_PREFIXES)


def _domain_score_adjustment(objective: dict[str, Any], prompt: str, source_text: str | None) -> int:
    requested, excluded, exclusive = _query_domain_constraints(prompt, source_text)
    domains = _objective_domains(objective)
    adjustment = 0

    if domains & excluded:
        adjustment -= 24
    if requested and domains & requested:
        adjustment += 12
    elif requested and domains:
        adjustment -= 8
    if exclusive and requested and domains and not (domains & requested):
        adjustment -= 18

    if not requested and not excluded:
        return adjustment
    return adjustment


def _domain_confidence_adjustment(objective: dict[str, Any], prompt: str, source_text: str | None) -> float:
    return _domain_score_adjustment(objective, prompt, source_text) * 0.035


class GDPT2018RetrievalProvider:
    """File-backed GDPT 2018 provider for the primary-math MVP."""

    def __init__(self, kb_root: Path = _KB_ROOT) -> None:
        self._kb_root = kb_root
        self._objectives = self._load_objectives()

    def coverage(self) -> dict[str, set[int]]:
        """Subjects the KB grounds, mapped to the grades available for each.

        Guardrails use this to reject out-of-scope (subject, grade) requests before
        any LLM call. Derived from the loaded objectives, so it always reflects the
        real KB (currently Toán grades 1-5 plus a legacy Lịch sử grade-8 objective).
        """
        cov: dict[str, set[int]] = {}
        for obj in self._objectives:
            subject = obj.get("subject_display") or obj.get("subject") or ""
            grade = obj.get("grade")
            if not subject or grade is None:
                continue
            cov.setdefault(subject, set()).add(int(grade))
        return cov

    def _load_objectives(self) -> list[dict[str, Any]]:
        by_id: dict[str, dict[str, Any]] = {}
        for path in self._kb_root.glob("*/*/objectives.json"):
            for item in json.loads(path.read_text(encoding="utf-8")):
                by_id[item["objective_id"]] = item
        if _LEGACY_FIXTURE.exists():
            fixture = json.loads(_LEGACY_FIXTURE.read_text(encoding="utf-8"))
            for item in fixture.get("objectives", []):
                by_id.setdefault(
                    item["id"],
                    {
                        "objective_id": item["id"],
                        "subject": fixture.get("subject", ""),
                        "subject_display": fixture.get("subject", ""),
                        "grade": fixture.get("grade", 0),
                        "topic": item.get("topic", ""),
                        "objective_text": item.get("description", ""),
                        "cognitive_level": "understand",
                        "difficulty_band": "medium",
                        "allowed_difficulty_range": ["easy", "medium"],
                        "required_skills": ["recall_key_events", "sequence_events"],
                        "prerequisites": [],
                        "grade_scope": {
                            "min_grade": fixture.get("grade", 0),
                            "target_grade": fixture.get("grade", 0),
                            "max_grade": fixture.get("grade", 0),
                        },
                        "complexity_signals": {"abstractness": "medium"},
                        "recommended_question_types": ["multiple_choice", "matching", "fill_in_blank"],
                        "misconceptions": item.get("misconceptions", []),
                        "scope_policy": {
                            "in_scope": [item.get("topic", "")],
                            "below_grade": "simplify_and_generate",
                            "at_grade": "generate_normally",
                            "above_grade": "downgrade_or_warn",
                            "out_of_program": "flag_and_suggest_related_objective",
                            "not_allowed": [],
                        },
                        "grounding_passages": item.get("curriculum_context", []),
                        "search_aliases": [item.get("topic", ""), item.get("description", "")],
                    },
                )
        return list(by_id.values())

    def retrieve(
        self,
        *,
        subject: str,
        grade: int,
        objective_id: str | None,
        prompt: str,
        source_text: str | None = None,
        uploaded_file_id: str | None = None,
        upload_type: str = "none",
        teacher_requested_difficulty: str = "medium",
    ) -> RetrievedContext:
        objective, confidence = self._match_objective(subject, grade, objective_id, prompt, source_text)
        if objective is None:
            teacher_ctx = self._extract_teacher_context(
                subject=subject,
                grade=grade,
                prompt=prompt,
                source_text=source_text,
                uploaded_file_id=uploaded_file_id,
                upload_type=upload_type,
                topic=None,
            )
            alignment = AlignmentResult(
                is_aligned_with_curriculum=False,
                alignment_confidence=0.0,
                mismatch_warnings=["No matching GDPT 2018 objective found for this request."],
                recommended_adjustments=["Choose a closer subject, grade, or curriculum objective."],
            )
            return RetrievedContext(
                objective_id=objective_id or "",
                passages=[source_text.strip()] if source_text else [],
                teacher_lesson_context=teacher_ctx,
                alignment_result=alignment,
                matched_confidence=0.0,
            )

        curriculum_ctx = self._build_curriculum_context(objective, grade, prompt, source_text)
        teacher_ctx = self._extract_teacher_context(
            subject=subject,
            grade=grade,
            prompt=prompt,
            source_text=source_text,
            uploaded_file_id=uploaded_file_id,
            upload_type=upload_type,
            topic=objective.get("topic"),
        )
        alignment = self._align(curriculum_ctx, teacher_ctx, teacher_requested_difficulty)
        difficulty = self._assess_difficulty(curriculum_ctx, teacher_ctx, teacher_requested_difficulty)
        passages = list(curriculum_ctx.grounding_passages)
        if source_text:
            passages.append(source_text.strip())

        return RetrievedContext(
            objective_id=curriculum_ctx.objective_id,
            objective_text=curriculum_ctx.objective_text,
            passages=passages,
            misconceptions=[Misconception(**m) for m in objective.get("misconceptions", [])],
            curriculum_context=curriculum_ctx,
            teacher_lesson_context=teacher_ctx,
            alignment_result=alignment,
            difficulty_assessment=difficulty,
            matched_confidence=confidence,
        )

    def _match_objective(
        self,
        subject: str,
        grade: int,
        objective_id: str | None,
        prompt: str,
        source_text: str | None,
    ) -> tuple[dict[str, Any] | None, float]:
        for obj in self._objectives:
            if objective_id and obj["objective_id"] == objective_id:
                return obj, 1.0

        same_grade = [o for o in self._objectives if int(o.get("grade", -1)) == grade]
        if len(same_grade) == 1:
            return same_grade[0], 0.78

        haystack = _norm(f"{prompt} {source_text or ''}")
        haystack_tokens = _tokens(haystack)
        best: tuple[dict[str, Any] | None, float, int] = (None, 0.0, 0)
        for obj in self._objectives:
            if int(obj.get("grade", -1)) != grade:
                continue
            terms = [
                obj.get("topic", ""),
                obj.get("objective_text", ""),
                *obj.get("search_aliases", []),
                *obj.get("required_skills", []),
                *obj.get("recommended_question_types", []),
            ]
            exact_score = sum(3 for term in terms if _norm(term) and _norm(term) in haystack)
            overlap_score = len(_tokens(" ".join(str(t) for t in terms)) & haystack_tokens)
            alias_subset_score = sum(
                min(5, len(term_tokens))
                for term in [obj.get("topic", ""), *obj.get("search_aliases", [])]
                if (term_tokens := _tokens(str(term))) and len(term_tokens) >= 2 and term_tokens <= haystack_tokens
            )
            score = (
                exact_score
                + overlap_score
                + alias_subset_score
                + _domain_score_adjustment(obj, prompt, source_text)
            )
            confidence = min(0.95, 0.35 + score * 0.06) if score else 0.0
            if score > best[2] or (score == best[2] and confidence > best[1]):
                best = (obj, confidence, score)
        return best[0], best[1]

    def _build_curriculum_context(
        self, objective: dict[str, Any], grade: int, prompt: str, source_text: str | None
    ) -> CurriculumContext:
        scope_status: ScopeStatus = "in_scope"
        merged = _norm(f"{prompt} {source_text or ''}")
        not_allowed = objective.get("scope_policy", {}).get("not_allowed", [])
        if any(_norm(term) in merged for term in not_allowed):
            scope_status = "above_grade"

        return CurriculumContext(
            objective_id=objective["objective_id"],
            objective_text=objective["objective_text"],
            subject=objective.get("subject_display") or objective["subject"],
            grade=grade,
            topic=objective.get("topic", ""),
            curriculum_difficulty=objective.get("difficulty_band", "medium"),
            allowed_difficulty_range=objective.get("allowed_difficulty_range", ["medium"]),
            scope_status=scope_status,
            cognitive_level=objective.get("cognitive_level", "understand"),
            required_skills=objective.get("required_skills", []),
            recommended_question_types=objective.get("recommended_question_types", []),
            not_allowed_question_types=not_allowed,
            grounding_passages=objective.get("grounding_passages", []),
            scope_policy=objective.get("scope_policy", {}),
        )

    def _extract_teacher_context(
        self,
        *,
        subject: str,
        grade: int,
        prompt: str,
        source_text: str | None,
        uploaded_file_id: str | None,
        upload_type: str,
        topic: str | None,
    ) -> TeacherLessonContext:
        text = source_text or ""
        examples = self._extract_examples(text)
        minutes = self._extract_minutes(text)
        constraints: list[str] = []
        if minutes and minutes <= 10:
            constraints.extend(["game ngan", "so cau hoi it", "luat choi don gian"])
        if re.search(r"yeu|cham|can goi y|nham", _norm(text)):
            constraints.extend(["co goi y", "dung so nho", "tranh bai toan nhieu buoc"])

        return TeacherLessonContext(
            uploaded_file_id=uploaded_file_id,
            upload_type=upload_type if upload_type in {"lesson_plan", "slide"} else "none",
            lesson_title=self._extract_title(text),
            subject=subject,
            grade=grade,
            topic=topic,
            teacher_focus=(text.strip().splitlines()[0] if text.strip() else prompt),
            preferred_examples=examples,
            extracted_entities=self._extract_entities(text),
            lesson_activities=self._extract_activities(text),
            time_limit_minutes=minutes,
            student_level_note=self._extract_student_note(text),
            constraints=constraints,
        )

    def _extract_examples(self, text: str) -> list[TeacherExample]:
        examples: list[TeacherExample] = []
        pattern = re.compile(r"(\d+)\s+(\w+)\s+(\w+),?\s+m[oỗ]i\s+\w+\s+(\d+)\s+(\w+)", re.IGNORECASE)
        for match in pattern.finditer(text):
            num_groups = int(match.group(1))
            group = f"{match.group(2)} {match.group(3)}"
            items_per_group = int(match.group(4))
            item = match.group(5)
            examples.append(
                TeacherExample(
                    raw_text=match.group(0),
                    structured={
                        "item": item,
                        "group": group,
                        "num_groups": num_groups,
                        "items_per_group": items_per_group,
                        "expected_result": num_groups * items_per_group,
                    },
                )
            )
        return examples

    def _extract_minutes(self, text: str) -> int | None:
        match = re.search(r"(\d+)\s*ph[uú]t", _norm(text))
        return int(match.group(1)) if match else None

    def _extract_title(self, text: str) -> str | None:
        for line in text.splitlines():
            clean = line.strip()
            if clean and len(clean) <= 120:
                return clean
        return None

    def _extract_entities(self, text: str) -> dict[str, Any]:
        return {
            "numbers": [int(n) for n in re.findall(r"\b\d+\b", text)],
            "operations": [
                op
                for op, keys in {
                    "multiplication": ["nhan", "x", "phep nhan"],
                    "repeated_addition": ["cong lap", "cong cac so hang bang nhau"],
                }.items()
                if any(k in _norm(text) for k in keys)
            ],
        }

    def _extract_activities(self, text: str) -> list[str]:
        return [line.strip() for line in text.splitlines() if "hoat dong" in _norm(line)]

    def _extract_student_note(self, text: str) -> str | None:
        for line in text.splitlines():
            if any(key in _norm(line) for key in ["hoc sinh", "lop", "hs"]):
                return line.strip()
        return None

    def _align(
        self,
        curriculum: CurriculumContext,
        teacher: TeacherLessonContext,
        teacher_requested_difficulty: str,
    ) -> AlignmentResult:
        warnings: list[str] = []
        adjustments: list[str] = []
        aligned = curriculum.scope_status in {"below_grade", "in_scope"}
        confidence = 0.9 if aligned else 0.55

        if teacher_requested_difficulty not in curriculum.allowed_difficulty_range:
            warnings.append(
                "Teacher requested difficulty is outside the GDPT allowed range for this objective."
            )
            adjustments.append(
                f"Use {curriculum.allowed_difficulty_range[-1]} as the highest allowed difficulty."
            )
        if curriculum.scope_status == "above_grade":
            warnings.append("Teacher material or request includes content above the target grade scope.")
            adjustments.append("Downgrade to one-step, concrete, age-appropriate tasks.")
        if not teacher.preferred_examples:
            adjustments.append("Use default age-appropriate examples from the GDPT objective.")

        return AlignmentResult(
            is_aligned_with_curriculum=aligned,
            alignment_confidence=confidence,
            mismatch_warnings=warnings,
            recommended_adjustments=adjustments,
        )

    def _assess_difficulty(
        self,
        curriculum: CurriculumContext,
        teacher: TeacherLessonContext,
        teacher_requested_difficulty: str,
    ) -> DifficultyAssessment:
        final = _clamp_difficulty(teacher_requested_difficulty, curriculum.allowed_difficulty_range)
        if teacher.time_limit_minutes and teacher.time_limit_minutes <= 10 and final == "medium":
            final = "easy"
        if curriculum.scope_status == "above_grade":
            final = curriculum.allowed_difficulty_range[-1]

        rationale = (
            f"GDPT objective has cognitive_level={curriculum.cognitive_level}, "
            f"curriculum_difficulty={curriculum.curriculum_difficulty}, and allows "
            f"{', '.join(curriculum.allowed_difficulty_range)}. "
        )
        if teacher.time_limit_minutes:
            rationale += f"Teacher context limits the game to {teacher.time_limit_minutes} minutes. "
        if teacher_requested_difficulty != final:
            rationale += f"Requested difficulty '{teacher_requested_difficulty}' was adjusted to '{final}'."
        else:
            rationale += f"Final difficulty stays '{final}'."

        return DifficultyAssessment(
            teacher_requested_difficulty=teacher_requested_difficulty if teacher_requested_difficulty in {"easy", "medium", "hard"} else "medium",  # type: ignore[arg-type]
            final_difficulty=final,
            difficulty_rationale=rationale,
        )


def _make_default_provider() -> RetrievalProvider:
    from app.config import settings

    provider = settings.retrieval_provider.strip().lower()
    if provider == "file":
        return GDPT2018RetrievalProvider()
    if provider in {"hybrid", "weaviate"}:
        from app.retrieval.rag_provider import HybridRAGRetrievalProvider

        return HybridRAGRetrievalProvider(require_weaviate=provider == "weaviate")
    raise RuntimeError("RETRIEVAL_PROVIDER must be one of: file, hybrid, weaviate.")


default_provider: RetrievalProvider = _make_default_provider()
