"""End-to-end pipeline test for every injectable game **except Beat Forge**.

It exercises both halves of the product pipeline for each game:

1. **Generation (BE_AI)** — ``run_workflow(override_template=<game>)`` runs the real
   guardrail -> retrieve -> recommend(skip) -> generate -> validate graph against the
   configured LLM and returns schema-validated ``content``.
2. **Injection (BE_Web)** — the validated ``content`` is fed to
   ``app.services.game_generation.map_content_to_items`` to confirm BE_Web can turn it
   into ``GameItem`` rows.

The two services both expose a top-level ``app`` package, so they cannot share a Python
process. Generation runs in this (backend) venv; the validated content for each game is
written to a temp artifact and the injection step runs as a subprocess in BE_Web's venv.

Usage:
    cd backend && .venv/bin/python -m scripts.test_pipeline
Requires a valid LLM API key in the repo .env. Exit code is non-zero if any game fails
either stage.
"""

from __future__ import annotations

import asyncio
import json
import subprocess
import tempfile
from pathlib import Path

from app.agents.graph import run_workflow
from app.config import settings

REPO_ROOT = Path(__file__).resolve().parents[2]
BE_WEB_DIR = REPO_ROOT / "BE_Web"
BE_WEB_PYTHON = BE_WEB_DIR / ".venv" / "bin" / "python"

# One case per injectable game (Beat Forge intentionally excluded). Subject/grade are
# constrained to the live KB coverage (Toán lớp 1-5, Lịch sử lớp 8); num_items honours
# each game's SPEC.min_items so generation isn't under-filled.
CASES: list[dict] = [
    {
        "game": "quiz",
        "subject": "Lịch sử",
        "grade": 8,
        "difficulty": "medium",
        "objective_id": "ls8-phongtrao-canvuong",
        "num_items": 5,
        "prompt": "Tạo trò chơi trắc nghiệm về phong trào Cần Vương cho học sinh lớp 8.",
    },
    {
        "game": "battleship",
        "subject": "Lịch sử",
        "grade": 8,
        "difficulty": "medium",
        "objective_id": "ls8-phongtrao-canvuong",
        "num_items": 25,  # SPEC.min_items = 25
        "prompt": "Tạo trò chơi bắn tàu hỏi đáp về phong trào Cần Vương cho học sinh lớp 8.",
    },
    {
        "game": "treasure_hunt",
        "subject": "Lịch sử",
        "grade": 8,
        "difficulty": "medium",
        "objective_id": "ls8-phongtrao-canvuong",
        "num_items": 8,  # SPEC.min_items = 8
        "prompt": "Tạo trò chơi truy tìm kho báu về phong trào Cần Vương cho học sinh lớp 8.",
    },
    {
        "game": "cat_jump",
        "subject": "Toán",
        "grade": 4,
        "difficulty": "medium",
        "objective_id": None,
        "num_items": 6,
        "prompt": "Tạo trò chơi về dãy số và quy luật số, đếm cách cho học sinh lớp 4.",
    },
    {
        "game": "feed_the_cats",
        "subject": "Toán",
        "grade": 3,
        "difficulty": "easy",
        "objective_id": None,
        "num_items": 6,  # SPEC.min_items = 6
        "prompt": "Tạo trò chơi luyện phép nhân trong phạm vi bảng cửu chương cho học sinh lớp 3.",
    },
    {
        "game": "farm_builder",
        "subject": "Toán",
        "grade": 5,
        "difficulty": "medium",
        "objective_id": None,
        "num_items": 4,  # SPEC.min_items = 3
        "prompt": "Tạo trò chơi về chu vi và diện tích hình vuông, hình chữ nhật cho học sinh lớp 5.",
    },
]


def _top_level_count(content: dict) -> int:
    for key in ("questions", "items", "problems", "lanes"):
        if isinstance(content.get(key), list):
            return len(content[key])
    return 0


# Injection-stage script, run inside BE_Web's venv (cwd=BE_Web so `app` resolves there).
_INJECTION_CHECK = r'''
import glob, json, os, sys
from app.services.game_generation import map_content_to_items

artifacts_dir = sys.argv[1]
results = []
for path in sorted(glob.glob(os.path.join(artifacts_dir, "*.json"))):
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    rec = {"game": data["game"], "template_id": data["template_id"]}
    try:
        items = map_content_to_items(data["template_id"], data["content"])
        rec["inj_ok"] = True
        rec["item_count"] = len(items)
        rec["empty_fields"] = [
            i for i, it in enumerate(items)
            if not str(it.get("question", "")).strip()
            or not str(it.get("correct_answer", "")).strip()
        ]
    except Exception as exc:  # noqa: BLE001 - surface every mapper failure
        rec["inj_ok"] = False
        rec["error"] = f"{type(exc).__name__}: {exc}"
    results.append(rec)
print("INJECTION_RESULTS_JSON:" + json.dumps(results, ensure_ascii=False))
'''


def run_injection(artifacts_dir: Path) -> dict[str, dict]:
    """Map each generated artifact via BE_Web; return {game: injection_record}."""
    if not BE_WEB_PYTHON.exists():
        return {"__error__": {"error": f"BE_Web venv not found at {BE_WEB_PYTHON}"}}
    proc = subprocess.run(
        [str(BE_WEB_PYTHON), "-c", _INJECTION_CHECK, str(artifacts_dir)],
        cwd=str(BE_WEB_DIR),
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        return {"__error__": {"error": proc.stderr.strip() or "injection subprocess failed"}}
    for line in proc.stdout.splitlines():
        if line.startswith("INJECTION_RESULTS_JSON:"):
            records = json.loads(line[len("INJECTION_RESULTS_JSON:"):])
            return {r["game"]: r for r in records}
    return {"__error__": {"error": "no injection results emitted\n" + proc.stdout}}


async def main() -> int:
    if not settings.has_api_key:
        print("SKIP: no valid API key in .env")
        return 0

    print(f"Model: {settings.default_model}   max_repairs: {settings.max_repairs}")
    print(f"Testing {len(CASES)} games (Beat Forge excluded)\n")

    gen_results: list[dict] = []
    with tempfile.TemporaryDirectory(prefix="pipeline_test_") as tmp:
        artifacts_dir = Path(tmp)

        # --- Stage 1: generation -------------------------------------------------
        for case in CASES:
            game = case["game"]
            print(f"[generate] {game:<14} {case['subject']} lớp {case['grade']} "
                  f"(num_items={case['num_items']}) ...", flush=True)
            try:
                state = await run_workflow(
                    subject=case["subject"],
                    grade=case["grade"],
                    difficulty=case["difficulty"],
                    prompt=case["prompt"],
                    objective_id=case["objective_id"],
                    num_items=case["num_items"],
                    override_template=game,
                )
            except Exception as exc:  # noqa: BLE001 - one game must not abort the run
                gen_results.append({"game": game, "gen_ok": False, "error": f"{type(exc).__name__}: {exc}"})
                print(f"             EXCEPTION: {type(exc).__name__}: {exc}\n")
                continue

            ok = bool(state.get("ok"))
            template_id = state.get("template_id")
            rec = {
                "game": game,
                "gen_ok": ok,
                "template_id": template_id,
                "blocked": state.get("blocked"),
                "repair_attempts": state.get("repair_attempts", 0),
                "error": state.get("error"),
                "validation_errors": state.get("validation_errors"),
            }
            if ok and isinstance(state.get("content"), dict):
                content = state["content"]
                rec["item_count"] = _top_level_count(content)
                (artifacts_dir / f"{game}.json").write_text(
                    json.dumps({"game": game, "template_id": template_id, "content": content},
                               ensure_ascii=False),
                    encoding="utf-8",
                )
                print(f"             ok  items={rec['item_count']}  repairs={rec['repair_attempts']}\n")
            else:
                detail = state.get("error") or state.get("validation_errors") or "blocked/failed"
                print(f"             FAIL: {detail}\n")
            gen_results.append(rec)

        # --- Stage 2: injection (BE_Web) ----------------------------------------
        print("[inject] running BE_Web mappers on generated content ...\n")
        inj_results = run_injection(artifacts_dir)

    if "__error__" in inj_results:
        print(f"INJECTION SUBPROCESS ERROR:\n{inj_results['__error__']['error']}\n")

    # --- Report -----------------------------------------------------------------
    print("=" * 78)
    print(f"{'GAME':<15}{'GENERATE':<24}{'INJECT':<24}{'RESULT'}")
    print("-" * 78)
    failures = 0
    for rec in gen_results:
        game = rec["game"]
        if rec["gen_ok"]:
            gen_cell = f"ok ({rec.get('item_count', '?')} items)"
        else:
            gen_cell = "FAIL"
        inj = inj_results.get(game)
        if not rec["gen_ok"]:
            inj_cell = "skipped"
            ok = False
        elif inj is None:
            inj_cell = "no result"
            ok = False
        elif inj.get("inj_ok"):
            empties = inj.get("empty_fields") or []
            inj_cell = f"ok ({inj.get('item_count', '?')} items)"
            ok = not empties
            if empties:
                inj_cell += f" EMPTY@{empties}"
        else:
            inj_cell = "FAIL"
            ok = False
        if not ok:
            failures += 1
        print(f"{game:<15}{gen_cell:<24}{inj_cell:<24}{'PASS' if ok else 'PROBLEM'}")
    print("=" * 78)

    # Detail any problems.
    for rec in gen_results:
        game = rec["game"]
        if not rec["gen_ok"]:
            print(f"\n[{game}] generation problem:")
            print(f"  blocked={rec.get('blocked')} error={rec.get('error')}")
            if rec.get("validation_errors"):
                print(f"  validation_errors={rec['validation_errors']}")
            continue
        inj = inj_results.get(game) or {}
        if inj and not inj.get("inj_ok"):
            print(f"\n[{game}] injection problem:")
            print(f"  {inj.get('error')}")
        elif inj.get("empty_fields"):
            print(f"\n[{game}] injection produced empty question/answer at indices {inj['empty_fields']}")

    print(f"\n{len(gen_results) - failures}/{len(gen_results)} games passed both stages.")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
