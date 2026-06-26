# BE_AI Agent Workflow Backend

Backend này xử lý luồng tạo learning game:

```text
retrieve GDPT objective -> recommend template -> generate content -> validate/repair
```

MVP hiện tập trung vào **Toán tiểu học lớp 1-5 theo GDPT 2018**. Backend có LLM adapter cho Anthropic, OpenAI và DeepSeek.

## Cài Đặt

BE_AI dùng `uv` làm công cụ quản lý môi trường và dependency chính. File `requirements.txt` vẫn được giữ để fallback/export runtime; local development nên dùng `uv`.

```powershell
cd backend
uv sync --extra dev
```

Nếu chưa có `uv`:

```powershell
python -m pip install uv
```

Tạo file `.env` ở repo root, ví dụ:

```env
LLM_PROVIDER=auto
OPENAI_API_KEY=sk-...
DEFAULT_MODEL=gpt-4.1-mini
API_DEBUG=false
```

Provider hỗ trợ:

| Provider | Key bắt buộc | Default model |
|---|---|---|
| `openai` | `OPENAI_API_KEY` | `gpt-4.1-mini` |
| `deepseek` | `DEEPSEEK_API_KEY` | `deepseek-chat` |
| `anthropic` | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` |

`LLM_PROVIDER=auto` ưu tiên OpenAI, sau đó DeepSeek, sau đó Anthropic. Nếu muốn ép provider, đặt `LLM_PROVIDER=openai`, `deepseek` hoặc `anthropic`.

Để xem request/response API trong terminal backend khi debug local, đặt:

```env
API_DEBUG=true
```

Khi bật, backend log request body, JSON response và từng SSE event của `/generate/stream`. Không bật chế độ này ở môi trường production.

Với DeepSeek, `DEEPSEEK_BASE_URL` mặc định là:

```text
https://api.deepseek.com
```

## Chạy Backend

```powershell
cd backend
uv run uvicorn app.main:app --reload --port 8000
```

API chạy tại:

```text
http://127.0.0.1:8000
```

Swagger UI:

```text
http://127.0.0.1:8000/docs
```

## Test

Chạy test không cần LLM key:

```powershell
cd backend
uv run pytest
```

Chạy smoke test end-to-end có gọi LLM:

```powershell
cd backend
uv run python -m scripts.smoke_generate
```

## API Usage

### Endpoints

| Method | Path | Cần LLM key | Mục đích |
|---|---|---:|---|
| `GET` | `/health` | Không | Kiểm tra server sống |
| `GET` | `/templates` | Không | Liệt kê content templates đang active |
| `POST` | `/recommend/games` | Có | Đề xuất game library phù hợp cho FE |
| `POST` | `/recommend` | Có | Chỉ chọn content template phù hợp |
| `POST` | `/generate` | Có | Generate với `override_template` cụ thể |
| `POST` | `/generate/full` | Có | Luồng đầy đủ: retrieve -> recommend -> generate -> validate/repair |
| `POST` | `/generate/stream` | Có | Stream stage events và content cho giao diện tạo game |

FE hiện gọi `/recommend/games` trước. Sau khi giáo viên chọn game, FE gọi `/generate/stream`. Endpoint `/generate/full` vẫn hữu ích cho script, test hoặc manual API khi không cần stream.

### Request Body

Payload chung cho `/recommend`, `/generate`, `/generate/full` và `/generate/stream`:

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

Ý nghĩa field:

| Field | Bắt buộc | Ghi chú |
|---|---:|---|
| `subject` | Có | Hiện nên gửi `"Toán"` hoặc `"Toan"`. |
| `grade` | Có | MVP focus lớp `1-5`, schema vẫn cho `1-12`. |
| `difficulty` | Không | `"easy"`, `"medium"`, `"hard"`; mặc định `"medium"`. |
| `prompt` | Có | Yêu cầu tự nhiên của giáo viên. |
| `objective_id` | Không | Nếu biết objective thì gửi id; nếu không gửi `""` hoặc `null` để backend tự retrieval. |
| `source_text` | Không | Text đã parse từ giáo án/slide upload. |
| `uploaded_file_id` | Không | ID file upload do frontend/storage quản lý. |
| `upload_type` | Không | `"none"`, `"lesson_plan"` hoặc `"slide"`. |
| `num_items` | Không | Số item/câu/pair muốn tạo, từ `1` đến `20`. |
| `override_template` | Không | Dùng cho `/generate`; ví dụ `"quiz"`, `"matching"`. |

### Ví Dụ Full Flow Không Có Upload

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

### Ví Dụ Có Teacher Context

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

Trong case này, GDPT KB vẫn quyết định objective, scope và difficulty. `source_text` chỉ dùng để ưu tiên bối cảnh, ví dụ, thời lượng và ghi chú sư phạm.

### Ví Dụ Recommend Only

```powershell
$body = @{
  subject = "Toán"
  grade = 3
  difficulty = "medium"
  prompt = "Tạo game chia đều 12 cái kẹo cho 3 bạn"
  objective_id = ""
  source_text = ""
  uploaded_file_id = ""
  upload_type = "none"
  num_items = 5
  override_template = ""
} | ConvertTo-Json -Depth 10

Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8000/recommend" `
  -ContentType "application/json; charset=utf-8" `
  -Body $body
```

Response shape:

```json
{
  "template_id": "quiz",
  "rationale": "Dạng trắc nghiệm phù hợp để kiểm tra nhanh cách học sinh nhận biết phép chia đều trong tình huống đơn giản.",
  "candidates": []
}
```

### Ví Dụ Generate Với Template Đã Chọn

Dùng `/generate` khi frontend hoặc giáo viên đã chọn template.

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

Nếu `ok=false`, frontend nên hiển thị `error` và có thể log `validation_errors` để debug.

## Knowledge Base Runtime

Runtime loader đọc KB từ:

```text
backend/data/gdpt_2018/math/
```

Bản canonical để review nằm tại:

```text
knowledge_base/gdpt_2018/
```

## Hybrid RAG Với BGE-M3 Và Weaviate

Mặc định backend vẫn dùng `RETRIEVAL_PROVIDER=file`, tức là đọc `objectives.json` và match bằng keyword/metadata như trước. Để bật kiến trúc hybrid RAG:

```env
RETRIEVAL_PROVIDER=hybrid
WEAVIATE_URL=http://localhost:8080
WEAVIATE_COLLECTION=CurriculumObjective
EMBEDDING_MODEL=BAAI/bge-m3
```

Ý nghĩa mode:

| Mode | Hành vi |
|---|---|
| `file` | Chỉ dùng JSON local, phù hợp test nhanh và môi trường chưa có Docker. |
| `hybrid` | Dùng BGE-M3 + Weaviate nếu sẵn sàng; nếu lỗi thì fallback về JSON local. |
| `weaviate` | Bắt buộc dùng BGE-M3 + Weaviate; lỗi nếu DB/model chưa sẵn sàng. |

Chạy Weaviate bằng Docker:

```powershell
docker compose -f docker-compose.rag.yml up -d
```

Ingest GDPT 2018 objectives vào Weaviate:

```powershell
cd backend
uv sync --extra dev
uv run python scripts/ingest_gdpt_to_weaviate.py
```

Lần đầu cài BGE-M3 sẽ kéo `sentence-transformers` và `torch`, có thể khá nặng. Nếu `uv` timeout khi tải `torch`, tăng timeout rồi chạy lại:

```powershell
$env:UV_HTTP_TIMEOUT = "120"
uv sync --extra dev
```

Pipeline retrieval sau khi bật RAG:

```text
Teacher prompt/source_text
-> BGE-M3 embedding
-> Weaviate vector search với filter subject + grade
-> objective candidates
-> structured GDPT context/difficulty/scope logic như cũ
-> recommend/generate/validate
```

Lưu ý: Weaviate chỉ giúp tìm objective gần nghĩa hơn khi prompt hoặc giáo án dài. Các quyết định chuẩn chương trình như `subject`, `grade`, `scope_status`, `allowed_difficulty_range` vẫn dựa trên metadata GDPT có cấu trúc, không giao hoàn toàn cho vector search.

Khi cập nhật canonical KB, mirror lại bằng:

```powershell
cd backend
uv run python scripts/repair_primary_math_kb.py
```

## Cấu Trúc

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
