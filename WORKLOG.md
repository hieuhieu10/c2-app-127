# Worklog

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
