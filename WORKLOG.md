# Worklog

## 2026-06-28

### Bug: "model returned no tool call for tool 'emit_game_content'"

- **Symptom:** generate đôi khi fail với `RuntimeError: Model returned no tool call for tool 'emit_game_content'` (`backend/app/agents/llm.py`). Chập chờn: request nhỏ OK, request lớn (nhiều item + distractor + giải thích) thì chết.
- **Root cause:** `DEFAULT_MODEL=deepseek-v4-flash` là model *thinking*. Mặc định nó (a) từ chối forced `tool_choice`, nên code cũ né bằng `tool_choice="auto"`; và (b) đốt `max_tokens` vào `reasoning_content`. Với prompt generate thật, model cạn token khi vẫn đang reasoning → `finish_reason='length'`, **không có tool_calls và content rỗng** → rơi vào nhánh raise ở `_extract_openai_compatible_tool_args`.
- **Cách dò:** gọi trực tiếp DeepSeek API thử nhiều knob; chỉ `extra_body={"thinking": {"type": "disabled"}}` vừa cho phép forced `tool_choice` vừa cho `reasoning_len=0`. Verify cả `deepseek-chat` và `deepseek-v4-flash`.

### Technical decision: tắt thinking thay vì đổi model

- Sửa `_call_openai_compatible_tool` (`llm.py`): DeepSeek nay dùng **forced `tool_choice`** + `extra_body={"thinking": {"type": "disabled"}}` thay cho `tool_choice="auto"`. Tool call mang tính tất định, không còn reasoning đốt token. An toàn với `deepseek-chat`.
- Defensive: khi vẫn gặp `finish_reason='length'`, báo lỗi rõ (gợi ý dùng `deepseek-chat` / tăng `MAX_TOKENS`) thay vì thông báo khó hiểu.
- Reason: giữ được `deepseek-v4-flash` (nhanh/rẻ) như team muốn mà không phải hạ về `deepseek-chat`.
- Scope: chỉ `backend/app/agents/llm.py`. Test: `test_llm_adapter.py` 11 passed, full backend **97 passed**; E2E thật `deepseek-v4-flash` 15 câu @ `max_tokens=4096` (đúng budget từng truncate) trả 15 item hợp lệ.

### Task status — chuẩn bị deploy Docker/VPS

- Validate `docker compose --env-file .env.production config` ✅; backend 97 / BE_Web 33 passed.
- Lưu ý trước khi đẩy lên VPS thật: `NEXT_PUBLIC_BE_WEB_URL` + `CORS_ORIGINS` trong `.env.production` đang là `localhost` (chỉ đúng để test local) → phải đổi sang domain công khai; `JWT_SECRET_KEY=change-me` phải thay bằng secret thật.

## 2026-06-07

### Technical decision: Normalize Codex hook configuration

- Updated `.codex/hooks.json` so Codex `UserPromptSubmit` and `Stop` hooks explicitly declare `"type": "command"`.
- Switched Codex hook commands from `bash scripts/_pyrun.sh` to `scripts\_pyrun.cmd` for Windows compatibility.
- Reason: keep the Codex hook schema explicit and avoid relying on Bash/WSL on Windows machines.
- Scope: no application code changes; this only affects AI usage logging behavior for Codex sessions.

### Task status

- Verified repository is still a starter template with no project implementation yet.
- `.ai-log/` currently contains only `.gitkeep`; no submitted AI log files are present in the repo.
- Reproduced `Stop hook (failed) error: hook exited with code 1`; root cause was `bash` resolving to WSL where `/bin/bash` was unavailable.
- Verified the Windows hook command exits successfully with a sample `Stop` payload.
- Updated `scripts/log_hook.py` to resolve Git metadata and relative `AI_LOG_DIR` from the repository root, not the hook process cwd.
- Updated hook stdin decoding to accept UTF-8 BOM payloads from PowerShell tests.
- Verified a sample `Stop` payload writes `.ai-log/session.jsonl`.
