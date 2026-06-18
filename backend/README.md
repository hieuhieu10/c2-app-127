# Agent Workflow Backend

Backend này xử lý luồng tạo learning game:

```text
retrieve GDPT objective -> recommend template -> generate content -> validate/repair
```

MVP hiện tại tập trung vào **Toán tiểu học lớp 1-5 theo GDPT 2018**. Backend có
LLM adapter cho Anthropic, OpenAI và DeepSeek.

## Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
```

Hoặc dùng editable install:

```bash
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -e ".[dev]"
```

Tạo file `.env` ở repo root, ví dụ:

```env
LLM_PROVIDER=auto
OPENAI_API_KEY=sk-...
DEFAULT_MODEL=gpt-4.1-mini
```

Provider hỗ trợ:

| Provider | Required key | Default model |
|----------|--------------|---------------|
| `openai` | `OPENAI_API_KEY` | `gpt-4.1-mini` |
| `deepseek` | `DEEPSEEK_API_KEY` | `deepseek-chat` |
| `anthropic` | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` |

`LLM_PROVIDER=auto` ưu tiên OpenAI, sau đó DeepSeek, sau đó Anthropic. Nếu muốn
ép provider, đặt `LLM_PROVIDER=openai`, `deepseek`, hoặc `anthropic`.

Với DeepSeek, `DEEPSEEK_BASE_URL` mặc định là `https://api.deepseek.com`.

## Run

```bash
cd backend
.venv\Scripts\uvicorn app.main:app --reload
```

API chạy tại:

```text
http://127.0.0.1:8000
```

Swagger UI:

```text
http://127.0.0.1:8000/docs
```

Chạy test không cần LLM key:

```bash
cd backend
python -m pytest
```

Chạy smoke test end-to-end có gọi LLM:

```bash
cd backend
python -m scripts.smoke_generate
```

## API Usage

### Endpoints

| Method | Path | Cần LLM key | Purpose |
|--------|------|-------------|---------|
| `GET` | `/health` | No | Kiểm tra server sống |
| `GET` | `/templates` | No | List các game template đang active |
| `POST` | `/recommend` | Yes | Chỉ chọn template phù hợp |
| `POST` | `/generate` | Yes | Generate với `override_template` cụ thể |
| `POST` | `/generate/full` | Yes | Luồng đầy đủ: retrieve -> recommend -> generate -> validate/repair |

Frontend nên gọi `/generate/full` cho luồng hoàn chỉnh.

### Request Body

Payload chung cho `/recommend`, `/generate`, và `/generate/full`:

```json
{
  "subject": "Toán",
  "grade": 5,
  "difficulty": "medium",
  "prompt": "Hãy tạo một trò chơi ngắn giúp học sinh luyện tập tỉ số phần trăm qua tình huống giảm giá.",
  "objective_id": "",
  "source_text": "",
  "uploaded_file_id": "",
  "upload_type": "none",
  "num_items": 5,
  "override_template": ""
}
```

Field meaning:

| Field | Required | Notes |
|-------|----------|-------|
| `subject` | Yes | Hiện nên gửi `"Toán"` hoặc `"Toan"` |
| `grade` | Yes | MVP focus `1-5`, schema backend vẫn cho `1-12` |
| `difficulty` | No | `"easy"`, `"medium"`, `"hard"`; default `"medium"` |
| `prompt` | Yes | Yêu cầu tự nhiên của giáo viên |
| `objective_id` | No | Nếu biết objective thì gửi id; nếu không biết gửi `""` hoặc `null` để backend tự retrieval |
| `source_text` | No | Text đã parse từ giáo án/slide upload; nếu không upload gửi `""` hoặc `null` |
| `uploaded_file_id` | No | ID file upload do frontend/storage quản lý |
| `upload_type` | No | `"none"`, `"lesson_plan"`, hoặc `"slide"` |
| `num_items` | No | Số item/câu/pair muốn tạo, từ `1` đến `20` |
| `override_template` | No | Dùng cho `/generate`; ví dụ `"quiz"`, `"matching"`; để `""`/`null` nếu muốn recommender chọn |

### Example: Full Flow Without Upload

```bash
curl -X POST http://127.0.0.1:8000/generate/full ^
  -H "Content-Type: application/json" ^
  -d "{\"subject\":\"Toán\",\"grade\":5,\"difficulty\":\"medium\",\"prompt\":\"Tạo game luyện tỉ số phần trăm qua tình huống giảm giá khi mua đồ dùng học tập.\",\"objective_id\":\"\",\"source_text\":\"\",\"uploaded_file_id\":\"\",\"upload_type\":\"none\",\"num_items\":5,\"override_template\":\"\"}"
```

PowerShell version:

```powershell
$body = @{
  subject = "Toán"
  grade = 5
  difficulty = "medium"
  prompt = "Tạo game luyện tỉ số phần trăm qua tình huống giảm giá khi mua đồ dùng học tập."
  objective_id = ""
  source_text = ""
  uploaded_file_id = ""
  upload_type = "none"
  num_items = 5
  override_template = ""
} | ConvertTo-Json -Depth 10

Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8000/generate/full" `
  -ContentType "application/json; charset=utf-8" `
  -Body $body
```

### Example: Full Flow With Lesson Plan Context

```json
{
  "subject": "Toán",
  "grade": 5,
  "difficulty": "medium",
  "prompt": "Hãy tạo trò chơi luyện tỉ số phần trăm qua tình huống giảm giá.",
  "objective_id": "",
  "source_text": "Tên bài: Tỉ số phần trăm và giảm giá. Trọng tâm: hiểu 25% nghĩa là 25 phần trên 100 và biết tính số tiền được giảm. Ví dụ ưu tiên: một hộp bút giá 40.000 đồng được giảm 25%. Hoạt động 10 phút cuối giờ, học sinh làm theo nhóm đôi.",
  "uploaded_file_id": "lesson_math5_percent_discount_001",
  "upload_type": "lesson_plan",
  "num_items": 5,
  "override_template": ""
}
```

Trong case này, GDPT KB vẫn quyết định objective/scope/difficulty. `source_text`
chỉ dùng để ưu tiên bối cảnh, ví dụ, thời lượng và ghi chú sư phạm.

### Example: Recommend Only

```bash
curl -X POST http://127.0.0.1:8000/recommend ^
  -H "Content-Type: application/json" ^
  -d "{\"subject\":\"Toán\",\"grade\":3,\"difficulty\":\"medium\",\"prompt\":\"Tạo game chia đều 12 cái kẹo cho 3 bạn\",\"objective_id\":\"\",\"source_text\":\"\",\"uploaded_file_id\":\"\",\"upload_type\":\"none\",\"num_items\":5,\"override_template\":\"\"}"
```

Response shape:

```json
{
  "template_id": "quiz",
  "rationale": "Dạng trắc nghiệm phù hợp để kiểm tra nhanh cách học sinh nhận biết phép chia đều trong tình huống đơn giản.",
  "candidates": []
}
```

### Example: Generate With Explicit Template

Use `/generate` when frontend or teacher has already selected a template.

```json
{
  "subject": "Toán",
  "grade": 3,
  "difficulty": "medium",
  "prompt": "Tạo 5 bài toán đố về phép nhân và phép chia trong phạm vi 100.",
  "objective_id": "",
  "source_text": "",
  "uploaded_file_id": "",
  "upload_type": "none",
  "num_items": 5,
  "override_template": "quiz"
}
```

### Full Response Shape

`/generate/full` và `/generate` trả về:

```json
{
  "ok": true,
  "template_id": "quiz",
  "rationale": "Lý do chọn template...",
  "content": {},
  "objective_id": "math_5_percent_ratio",
  "validation_errors": [],
  "repair_attempts": 0,
  "error": null
}
```

Nếu `ok=false`, frontend nên hiển thị `error` và có thể log
`validation_errors` để debug.

## Knowledge Base Runtime

Runtime loader đọc KB từ:

```text
backend/data/gdpt_2018/math/
```

Bản canonical để review nằm tại:

```text
knowledge_base/gdpt_2018/
```

Khi cập nhật canonical KB, mirror lại bằng:

```bash
python backend/scripts/repair_primary_math_kb.py
```

## Layout

```text
app/
  config.py
  models.py
  api/routes_generate.py
  agents/
  templates/
  validation/
  retrieval/
data/
  gdpt_2018/
  fixtures/
tests/
scripts/
```
