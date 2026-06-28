# Kế Hoạch Evaluation Metrics

Tài liệu này thiết kế khâu đánh giá cho LearnGame Agent. Mục tiêu là có nhiều hơn một metric, có baseline number rõ ràng, và trace được từ test case đến evidence thực tế.

## 1. Mục Tiêu Đánh Giá

Evaluation metrics được dùng để trả lời: hệ thống có tạo game đúng chương trình, đúng ý giáo viên, chơi được, chạy ổn và có chi phí hợp lý không?

| Nhóm | Câu hỏi cần trả lời |
|---|---|
| Curriculum | Agent có truy xuất đúng objective GDPT 2018 theo môn, lớp, chủ đề không? |
| Guardrails | Agent có chặn hoặc downgrade nội dung vượt scope không, đồng thời không block nhầm prompt hợp lệ không? |
| Game quality | Nội dung game có đúng schema, đúng sư phạm và chơi được không? |
| System | Luồng chạy có đủ nhanh, đủ rẻ và ổn định không? |

## 2. Evaluation Suite Tổng Quan

| Metric ID | Metric | Cách đo | Baseline |
|---|---|---|---:|
| `RET_TOP1` | Objective top-1 accuracy | So sánh objective đầu tiên với expected objective | `>= 70%` |
| `RET_TOP3` | Objective top-3 recall | Expected objective nằm trong top 3 retrieval | `>= 90%` |
| `SCOPE_PASS` | Scope compliance rate | Output không có nội dung sai lớp/môn | `>= 90%` |
| `GUARD_OOS` | Out-of-scope detection recall | Prompt vượt scope được flag/block/downgrade | `>= 90%` |
| `GUARD_FP` | Guardrail false positive rate | Prompt hợp lệ nhưng bị block sai | `<= 10%` |
| `SCHEMA_PASS` | Schema validation pass rate | Pydantic/schema validator pass | `>= 95%` |
| `REPAIR_SUCCESS` | Repair success rate | Output lỗi được repair thành hợp lệ | `>= 80%` |
| `GEVAL_CURR` | G-Eval curriculum alignment | LLM judge theo rubric GDPT | `>= 0.80` |
| `GEVAL_PED` | G-Eval pedagogical quality | LLM judge theo rubric sư phạm | `>= 0.75` |
| `GEVAL_PLAY` | G-Eval game playability | LLM judge theo rubric khả năng chơi | `>= 0.80` |
| `GEVAL_TEACHER_CTX` | G-Eval teacher context usefulness | LLM judge mức độ tận dụng giáo án/slide | `>= 0.75`, conditional |
| `LAT_P50` | Full-flow latency P50 | Timer từ request đến response hoàn chỉnh | `<= 12s` |
| `LAT_P95` | Full-flow latency P95 | Timer P95 trên eval set | `<= 30s` |
| `COST_AVG` | Average cost/request | Token usage x provider price | `<= $0.03` |
| `API_SUCCESS` | API success rate | HTTP 2xx hoặc response `ok=true/blocked=true` hợp lệ | `>= 98%` |

## 3. Metric Deterministic

Các metric deterministic không dùng LLM judge. Chúng nên chạy trong CI hoặc chạy local bằng command repeatable.

### 3.1 Objective Retrieval

Mục tiêu: đo retrieval có map đúng prompt/source_text sang objective GDPT không.

Input cần lưu cho mỗi case:

```json
{
  "case_id": "RET_MATH4_MEASUREMENT_001",
  "subject": "Toán",
  "grade": 4,
  "prompt": "Tạo game về đổi đơn vị đo độ dài",
  "source_text": "",
  "expected_objective_id": "math_4_measurement_unit_conversion"
}
```

Cách tính:

```text
RET_TOP1 = số case top_1_objective == expected_objective / tổng số case
RET_TOP3 = số case expected_objective nằm trong top_3_objectives / tổng số case
```

Baseline:

```text
RET_TOP1 >= 70%
RET_TOP3 >= 90%
Wrong subject rate <= 5%
Wrong grade rate <= 10%
```

### 3.2 Scope Và Guardrails

Mục tiêu: kiểm tra agent có xử lý prompt vượt chương trình không.

Case bắt buộc nên có:

| Case | Expected |
|---|---|
| Toán lớp 3 yêu cầu số thập phân `0,5`, `1,25` | Flag/downgrade vì số thập phân không thuộc lớp 3 |
| Toán lớp 3 yêu cầu phân số nâng cao | Flag/downgrade nếu vượt lớp |
| Subject là Toán, prompt dài chứa nhiều câu hỏi toán | Không báo nhầm sang Tiếng Việt |
| Toán lớp 4 đo lường | Không map sang thống kê/biểu đồ |
| Toán lớp 5 phần trăm | In-scope |

Cách tính:

```text
SCOPE_PASS = số output đúng scope / tổng số output
GUARD_OOS = số prompt vượt scope được phát hiện / tổng số prompt vượt scope
GUARD_FP = số prompt hợp lệ bị block sai / tổng số prompt hợp lệ
```

Baseline:

```text
SCOPE_PASS >= 90%
GUARD_OOS >= 90%
GUARD_FP <= 10%
Grade-inappropriate content rate <= 5%
```

### 3.3 Schema Và Content Validity

Mục tiêu: output có đúng data contract để FE render game không.

Cách tính:

```text
SCHEMA_PASS = số response pass schema lần đầu / tổng số response
REPAIR_SUCCESS = số response lỗi được repair thành hợp lệ / số response cần repair
Required field missing rate = số lỗi thiếu field bắt buộc / tổng số response
```

Baseline:

```text
SCHEMA_PASS >= 95%
REPAIR_SUCCESS >= 80%
Required field missing rate <= 3%
Incorrect answer rate <= 5%
```

Các lỗi regression cần giữ lại:

- Item thiếu `objective_id`.
- `num_items` không đúng request.
- Đáp án đúng không khớp explanation.
- Matching pair không tương ứng.
- Quiz thiếu distractors.

## 4. G-Eval Với DeepEval

G-Eval dùng cho các khía cạnh khó đo bằng rule: chất lượng sư phạm, bám objective, khả năng chơi trong lớp. G-Eval không thay thế latency, cost, retrieval accuracy hoặc schema validation.

Quy ước scale:

```text
DeepEval GEval thường trả score đã normalize về [0, 1].
Baseline trong tài liệu này dùng thang [0, 1].
Rubric bên dưới dùng mô tả 0-10 để người review dễ hiểu, nhưng khi implement cần map về threshold DeepEval tương ứng.
Nếu dùng evaluator tự viết trả score thô 0-10, threshold phải đổi:
- GEVAL_CURR >= 8.0
- GEVAL_PED >= 7.5
- GEVAL_PLAY >= 8.0
- GEVAL_TEACHER_CTX >= 7.5
```

### 4.1 Curriculum Alignment G-Eval

Metric ID: `GEVAL_CURR`

Baseline:

```text
score >= 0.80
```

Rubric:

| Score | Ý nghĩa |
|---:|---|
| 0-2 | Sai môn, sai lớp hoặc sai objective |
| 3-5 | Có liên quan nhưng lệch trọng tâm hoặc thiếu căn cứ GDPT |
| 6-8 | Đúng objective và phù hợp lớp, còn thiếu vài chi tiết nhỏ |
| 9-10 | Bám sát objective, đúng phạm vi GDPT, phù hợp học sinh |

DeepEval sketch:

```python
from deepeval.metrics import GEval
from deepeval.metrics.g_eval import Rubric
from deepeval.test_case import SingleTurnParams

curriculum_alignment = GEval(
    name="Curriculum Alignment",
    evaluation_steps=[
        "Kiểm tra actual_output có đúng subject, grade và objective trong expected_output không.",
        "Kiểm tra nội dung sinh ra có nằm trong phạm vi GDPT của lớp đó không.",
        "Phạt nặng nếu có khái niệm vượt lớp, sai môn hoặc sai chủ đề.",
        "Đánh giá mức độ bám sát objective và giải thích lý do."
    ],
    evaluation_params=[
        SingleTurnParams.INPUT,
        SingleTurnParams.ACTUAL_OUTPUT,
        SingleTurnParams.EXPECTED_OUTPUT,
        SingleTurnParams.RETRIEVAL_CONTEXT,
    ],
    rubric=[
        Rubric(score_range=(0, 2), expected_outcome="Sai môn, sai lớp hoặc sai objective."),
        Rubric(score_range=(3, 5), expected_outcome="Có liên quan nhưng lệch trọng tâm hoặc thiếu căn cứ GDPT."),
        Rubric(score_range=(6, 8), expected_outcome="Đúng objective, phù hợp lớp, còn thiếu chi tiết nhỏ."),
        Rubric(score_range=(9, 10), expected_outcome="Bám sát objective, đúng phạm vi GDPT và phù hợp học sinh."),
    ],
    threshold=0.8,
)
```

### 4.2 Pedagogical Quality G-Eval

Metric ID: `GEVAL_PED`

Baseline:

```text
score >= 0.75
```

Rubric:

| Score | Ý nghĩa |
|---:|---|
| 0-2 | Câu hỏi khó hiểu, sai kiến thức hoặc không phù hợp học sinh |
| 3-5 | Dùng được một phần nhưng thiếu hint/explanation hoặc quá máy móc |
| 6-8 | Rõ ràng, đúng kiến thức, có hint/explanation hữu ích |
| 9-10 | Giáo viên có thể dùng gần như ngay, có lỗi sai thường gặp và phản hồi tốt |

Các tiêu chí judge:

- Câu hỏi rõ ràng, không mâu thuẫn dữ kiện.
- Explanation đúng và đủ ngắn cho học sinh tiểu học.
- Distractor phản ánh lỗi sai thường gặp.
- Ngôn ngữ phù hợp lứa tuổi.

### 4.3 Game Playability G-Eval

Metric ID: `GEVAL_PLAY`

Baseline:

```text
score >= 0.80
```

Rubric:

| Score | Ý nghĩa |
|---:|---|
| 0-2 | Không chơi được trong template đã chọn |
| 3-5 | Chơi được nhưng dữ liệu thiếu hoặc luật/câu hỏi rời rạc |
| 6-8 | Phù hợp template quiz/matching/fill_in_blank, có thể render |
| 9-10 | Phù hợp game shell, có tính tương tác và dùng được trước lớp |

Các tiêu chí judge:

- `template_id` khớp cấu trúc content.
- Nội dung đủ item để game diễn ra.
- Game phù hợp giáo viên thao tác trước lớp.
- Không có item gây nhầm lẫn vì format.

### 4.4 Teacher Context Usefulness G-Eval

Metric ID: `GEVAL_TEACHER_CTX`

Baseline:

```text
score >= 0.75
```

Chỉ chạy metric này với case có `source_text`, giáo án hoặc slide.

Đây là metric conditional:

```text
Nếu eval case không có source_text/upload context: bỏ qua metric này.
Nếu eval case có source_text/upload context: metric này được tính vào pass/fail của case đó.
Trong summary toàn bộ eval run, báo riêng average trên nhóm teacher-context cases.
```

Rubric:

| Score | Ý nghĩa |
|---:|---|
| 0-2 | Bỏ qua teacher context |
| 3-5 | Có dùng nhưng hời hợt hoặc không đúng trọng tâm |
| 6-8 | Dùng đúng ví dụ, thời lượng hoặc hoạt động chính |
| 9-10 | Cá nhân hóa sát tiết học và vẫn bám GDPT |

## 5. Latency Và Cost

### 5.1 Latency

Nên đo theo stage để debug dễ hơn:

| Stage | Baseline |
|---|---:|
| Upload parsing | `<= 2s` |
| Objective retrieval | `<= 1.5s` |
| Template/game recommendation | `<= 5s` |
| Content generation | `<= 15s` |
| Full flow P50 | `<= 12s` |
| Full flow P95 | `<= 30s` |

Lưu ý với BGE-M3 local:

```text
Cold start embedding model có thể 20-60s.
Warm retrieval request nên <= 1.5s.
```

Nên tách `cold_start_latency` và `warm_latency` để không đánh giá nhầm production.

Quy tắc warm-up cho eval runner:

```text
1. Nếu RETRIEVAL_PROVIDER=hybrid hoặc dùng BGE-M3 local, chạy 1 request warm-up trước khi bắt đầu đo latency.
2. Log thời gian warm-up vào field cold_start_latency_ms.
3. Không tính warm-up request vào LAT_P50/LAT_P95 chính.
4. Với CI container mới, report cả cold_start_latency_ms và warm_latency_ms để biết chi phí khởi động thật.
5. Nếu production giữ process/model warm, dùng warm_latency làm gate chính.
```

### 5.2 Cost

Baseline:

| Metric | Baseline |
|---|---:|
| Average cost/request | `<= $0.03` |
| Input tokens/request | `<= 6000` |
| Output tokens/request | `<= 3000` |
| LLM calls/request | `<= 3` |

Cost baseline `<= $0.03/request` được hiểu là baseline ban đầu cho model rẻ/nhẹ như `gpt-5.4-nano`, `gpt-4.1-mini` hoặc DeepSeek tương đương trong flow hiện tại. Nếu đổi sang model/provider khác, phải ghi rõ provider/model trong evidence và recalibrate baseline.

Log đề xuất:

```json
{
  "case_id": "GEN_MATH5_PERCENT_001",
  "request_id": "...",
  "provider": "openai",
  "model": "gpt-5.4-nano",
  "input_tokens": 4200,
  "output_tokens": 1800,
  "llm_calls": 2,
  "estimated_cost_usd": 0.012,
  "latency_ms": 14320
}
```

## 6. Eval Dataset Đề Xuất

Giai đoạn đầu nên có 30-50 case Toán tiểu học. Tập case phải phủ đều lớp 1-5, không dồn quá nhiều vào lớp 4-5.

| Nhóm case | Số lượng tối thiểu |
|---|---:|
| Toán lớp 1-5, prompt đúng scope | 20 |
| Prompt có teacher context/slide/source_text | 8 |
| Prompt vượt scope cần guardrail | 8 |
| Prompt dài chứa đề bài/câu hỏi có sẵn | 5 |
| Prompt dễ nhầm topic, ví dụ đo lường vs thống kê | 5 |
| Prompt mix tiếng Việt và tiếng Anh | 3 |

Phân bổ tối thiểu theo lớp:

| Lớp | Số case tối thiểu |
|---|---:|
| Lớp 1 | 4 |
| Lớp 2 | 4 |
| Lớp 3 | 4 |
| Lớp 4 | 4 |
| Lớp 5 | 4 |

Schema một eval case:

```json
{
  "case_id": "MATH4_MEASUREMENT_001",
  "subject": "Toán",
  "grade": 4,
  "difficulty": "medium",
  "prompt": "Tạo game về đổi đơn vị đo độ dài",
  "source_text": "",
  "upload_type": "none",
  "num_items": 5,
  "expected_objective_id": "math_4_measurement_unit_conversion",
  "expected_template_ids": ["quiz", "matching"],
  "expected_scope_status": "in_scope",
  "must_not_contain": ["biểu đồ cột", "số thập phân lớp 5"],
  "notes": "Case dễ bị nhầm sang thống kê."
}
```

`expected_objective_id` phải là objective ID thật trong GDPT data đang được backend dùng, ví dụ từ `backend/data/gdpt_2018/*.json` hoặc Weaviate collection `CurriculumObjective`. Không dùng placeholder trong eval case chính thức. Nếu objective ID chưa ổn định trong giai đoạn migrate Weaviate, case phải có thêm `expected_topic` và `expected_grade`, nhưng không được tính vào `RET_TOP1/RET_TOP3` cho đến khi ID được chốt.

Ví dụ case mix tiếng Anh:

```json
{
  "case_id": "MATH3_MULTIPLICATION_MIXED_LANG_001",
  "subject": "Toán",
  "grade": 3,
  "difficulty": "medium",
  "prompt": "Create a quick matching game về phép nhân là phép cộng lặp, dùng ví dụ apple baskets.",
  "source_text": "",
  "upload_type": "none",
  "num_items": 5,
  "expected_objective_id": "math_3_multiplication_repeated_addition",
  "expected_template_ids": ["matching"],
  "expected_scope_status": "in_scope",
  "must_not_contain": ["số thập phân", "biểu đồ cột"],
  "notes": "Kiểm tra prompt mixed English/Vietnamese không bị guardrail false positive."
}
```

## 7. Evidence Cần Lưu

Mỗi lần chạy eval nên sinh một file evidence dạng JSON hoặc JSONL:

```json
{
  "run_id": "eval_2026_06_26_001",
  "case_id": "MATH4_MEASUREMENT_001",
  "request": {},
  "retrieved_objectives": [],
  "response": {},
  "metrics": {
    "RET_TOP1": true,
    "SCOPE_PASS": true,
    "SCHEMA_PASS": true,
    "GEVAL_CURR": 0.86,
    "GEVAL_PED": 0.81,
    "GEVAL_PLAY": 0.84,
    "LATENCY_MS": 14200,
    "ESTIMATED_COST_USD": 0.012
  },
  "passed": true,
  "failure_reasons": []
}
```

Nơi lưu đề xuất:

```text
backend/evals/cases/*.jsonl
backend/evals/results/*.jsonl
docs/EVAL_EVIDENCE.md
```

`docs/EVAL_EVIDENCE.md` chỉ nên chứa summary và một số output tiêu biểu. File JSONL giữ raw evidence để trace chi tiết.

## 8. Cách Tính Pass/Fail Cho Một Eval Run

Một eval run được xem là pass nếu đạt tất cả điều kiện:

```text
RET_TOP1 >= 70%
RET_TOP3 >= 90%
SCOPE_PASS >= 90%
GUARD_OOS >= 90%
GUARD_FP <= 10%
SCHEMA_PASS >= 95%
GEVAL_CURR average >= 0.80
GEVAL_PED average >= 0.75
GEVAL_PLAY average >= 0.80
GEVAL_TEACHER_CTX average >= 0.75 trên các case có source_text/upload context
LAT_P95 <= 30s
COST_AVG <= $0.03
API_SUCCESS >= 98%
```

Ghi chú:

- `GEVAL_TEACHER_CTX` chỉ block pass/fail cho subset có teacher context. Nếu eval run không có case nào có `source_text` hoặc upload context, metric này phải được report là `not_applicable`, không tính fail.
- `GUARD_FP` là gate chính thức vì false positive làm giáo viên bị chặn prompt hợp lệ.
- `LAT_P95` dùng warm latency sau warm-up, không tính cold start của BGE-M3 vào gate chính. `cold_start_latency_ms` vẫn phải report riêng.

Với PR nhỏ, có thể chạy subset:

| Loại thay đổi | Eval bắt buộc |
|---|---|
| Sửa retrieval/RAG | `RET_TOP1`, `RET_TOP3`, `SCOPE_PASS` |
| Sửa prompt/generator | `SCHEMA_PASS`, `GEVAL_CURR`, `GEVAL_PED`, `GEVAL_PLAY` |
| Sửa guardrails | `GUARD_OOS`, `GUARD_FP` |
| Sửa FE/BE API contract | `API_SUCCESS`, schema validation |
| Đổi provider/model | latency, cost, G-Eval sample |

## 9. Kế Hoạch Triển Khai

### Phase 1 - Manual Baseline

Mục tiêu: có baseline evidence nhanh.

Việc cần làm:

- Tạo 30-50 eval cases dạng JSONL.
- Chạy retrieval và guardrail deterministic.
- Gọi một số case full-flow có LLM thật.
- Ghi kết quả vào `docs/EVAL_EVIDENCE.md`.

### Phase 2 - Automated Eval Runner

Mục tiêu: chạy lại eval bằng một command.

Việc cần làm:

- Thêm `backend/evals/run_eval.py`.
- Hỗ trợ mode `retrieval-only`, `full-flow`, `geval`.
- Ghi raw result vào `backend/evals/results/`.
- Xuất summary table ra terminal.
- Chạy warm-up BGE-M3 trước khi đo latency nếu dùng hybrid retrieval.

Command mong muốn:

```powershell
cd backend
uv run python evals/run_eval.py --mode retrieval-only
uv run python evals/run_eval.py --mode full-flow --limit 10
uv run python evals/run_eval.py --mode geval --result-file evals/results/latest.jsonl
```

### Phase 3 - DeepEval Integration

Mục tiêu: dùng G-Eval cho quality metrics.

Việc cần làm:

- Thêm dependency `deepeval`.
- Tạo custom metrics:
  - `Curriculum Alignment`
  - `Pedagogical Quality`
  - `Game Playability`
  - `Teacher Context Usefulness`
- Cho phép chọn judge model qua env.

Env đề xuất:

```env
DEEPEVAL_JUDGE_PROVIDER=deepseek
DEEPEVAL_JUDGE_MODEL=deepseek-chat
DEEPSEEK_API_KEY=...
```

Nếu DeepEval version đang dùng không hỗ trợ DeepSeek trực tiếp, triển khai judge bằng OpenAI-compatible base URL của DeepSeek hoặc chạy G-Eval thủ công qua adapter nội bộ. Không dùng OpenAI judge mặc định nếu mục tiêu evaluation là đo hành vi của DeepSeek trong project.

### Phase 4 - CI/Regression Gate

Mục tiêu: chống regression trước khi merge.

Việc cần làm:

- CI chạy deterministic eval trên subset nhỏ.
- Full G-Eval chạy thủ công hoặc nightly vì tốn chi phí.
- PR bị block nếu schema/retrieval/guardrail regression nghiêm trọng.

Gating đề xuất:

```text
CI mandatory:
- unit tests
- retrieval eval subset
- schema validation subset
- guardrail false positive subset

Manual/nightly:
- full-flow LLM eval
- DeepEval G-Eval
- latency/cost report
```

## 10. Baseline Ban Đầu Để Báo Cáo

Nếu cần đưa vào report ngay, dùng baseline này:

| Metric | Baseline |
|---|---:|
| Objective top-1 accuracy | `>= 70%` |
| Objective top-3 recall | `>= 90%` |
| Scope compliance rate | `>= 90%` |
| Out-of-scope detection recall | `>= 90%` |
| Guardrail false positive rate | `<= 10%` |
| Schema validation pass rate | `>= 95%` |
| Curriculum Alignment G-Eval | `>= 0.80` |
| Pedagogical Quality G-Eval | `>= 0.75` |
| Game Playability G-Eval | `>= 0.80` |
| Teacher Context Usefulness G-Eval | `>= 0.75`, chỉ áp dụng case có teacher context |
| Full-flow latency P95 | `<= 30s` |
| Average cost/request | `<= $0.03` cho model baseline đã khai báo |
| API success rate | `>= 98%` |

## 11. Khi Nào Chạy Evaluation

| Thời điểm | Eval nên chạy |
|---|---|
| Sửa retrieval/RAG | `RET_TOP1`, `RET_TOP3`, `SCOPE_PASS`, `GUARD_FP` |
| Sửa prompt/generator | `SCHEMA_PASS`, `GEVAL_CURR`, `GEVAL_PED`, `GEVAL_PLAY` |
| Sửa guardrails | `GUARD_OOS`, `GUARD_FP`, prompt hợp lệ/không hợp lệ |
| Đổi model/provider | latency, cost, G-Eval sample |
| Trước PR/merge | deterministic subset và unit tests |
| Trước demo/release | full-flow eval, G-Eval, latency/cost report |

## 12. Ghi Chú Thiết Kế

- G-Eval chỉ dùng để judge chất lượng nội dung, không dùng để đo latency/cost/schema.
- G-Eval baseline trong tài liệu dùng score normalize `[0, 1]`. Nếu evaluator trả score `0-10`, phải đổi threshold tương ứng.
- Deterministic metrics phải chạy được không cần LLM key nếu chỉ test retrieval/guardrail/schema.
- Với RAG/Weaviate, cần lưu cả retrieved objective list để debug khi map sai.
- Với teacher context, GDPT vẫn là nguồn chuẩn cao nhất. Nếu giáo án vượt scope, metric đúng phải là flag/downgrade, không phải sinh theo giáo án.
- Với production, nên log token/cost/latency theo `request_id` để nối được với eval evidence.
