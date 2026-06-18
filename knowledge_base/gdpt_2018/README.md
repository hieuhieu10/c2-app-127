# GDPT 2018 Knowledge Base

Thư mục này là nguồn tri thức chương trình cho LearnGame.

MVP hiện tại tập trung vào **Toán cấp tiểu học, lớp 1-5** theo GDPT 2018.

GDPT 2018 đóng vai trò **curriculum authority**. Hệ thống dùng KB này để xác định:

- Nội dung thuộc môn, lớp, topic và objective nào.
- Nội dung có nằm trong phạm vi chương trình không.
- Difficulty phù hợp với lớp đó.
- Dạng câu hỏi hoặc game template nào phù hợp với objective.

Giáo án hoặc slide giáo viên upload chỉ là **teacher context** để cá nhân hóa ví dụ, thời lượng và trọng tâm tiết học. Teacher context không thay thế GDPT 2018.

## Cấu Trúc

```text
knowledge_base/gdpt_2018/
  README.md
  source_documents/
    GDPT_2018.md
    toan1-5.pdf
  math/
    source_text/
      toan1-5.txt
      grade_1_source.txt
      grade_2_source.txt
      grade_3_source.txt
      grade_4_source.txt
      grade_5_source.txt
    grade_1/
      objectives.json
    grade_2/
      objectives.json
    grade_3/
      objectives.json
    grade_4/
      objectives.json
    grade_5/
      objectives.json
    primary/
      README.md
      mechanic_map.json
```

Vai trò từng nhóm file:

- `source_documents/`: tài liệu gốc do team đưa vào, ví dụ `GDPT_2018.md` và `toan1-5.pdf`.
- `math/source_text/`: text được trích xuất từ tài liệu nguồn, dùng để review và curate objective.
- `math/grade_*/objectives.json`: objective có cấu trúc theo từng khối lớp.
- `math/primary/`: metadata dùng chung cho Toán tiểu học, ví dụ mapping giữa kỹ năng và game mechanic.

Backend runtime đang dùng bản mirror tại:

```text
backend/data/gdpt_2018/math/
```

Quy ước hiện tại:

- `knowledge_base/` là bản canonical để con người review/chỉnh sửa.
- `backend/data/` là bản runtime để API load khi chạy.
- Khi sửa KB canonical, cần mirror lại sang `backend/data`.

Script mirror/repair:

```powershell
cd backend
uv run python scripts/repair_primary_math_kb.py
```

## Vì Sao Tách Theo Từng Khối

Objective được tách theo `grade_1` đến `grade_5`, không gộp vào một file `primary/objectives.json`, vì pipeline luôn bắt đầu từ:

```text
subject + grade + teacher request
```

Cách tách này giúp:

- Retrieval chỉ xét objective đúng khối lớp.
- Scope check dễ xác định nội dung đang dưới lớp, đúng lớp hay vượt lớp.
- Review từng khối rõ ràng hơn.
- Tránh trùng hoặc nhầm `objective_id`.
- Dễ mở rộng sang môn/lớp khác mà không đổi interface backend.

Thư mục `primary/` chỉ dành cho metadata dùng chung, không chứa objective riêng của từng lớp.

## Tiếng Việt Có Dấu Và Không Dấu

KB dùng cả tiếng Việt có dấu và không dấu, nhưng vai trò khác nhau:

- Tiếng Việt có dấu là nguồn chuẩn cho `subject`, `topic`, `objective_text`, `grounding_passages`, `misconceptions`, `default_examples`.
- Tiếng Việt không dấu chỉ dùng trong `search_aliases` để hỗ trợ retrieval khi giáo viên gõ không dấu hoặc OCR làm mất dấu.

Ví dụ:

```json
{
  "objective_id": "math_3_multiplication_division_within_100",
  "subject": "Toán",
  "grade": 3,
  "topic": "Nhân chia trong phạm vi 100",
  "objective_text": "Vận dụng các bảng nhân, bảng chia 2 đến 9; thực hiện phép nhân với số có một chữ số, phép chia cho số có một chữ số...",
  "search_aliases": [
    "nhân chia trong phạm vi 100",
    "nhan chia trong pham vi 100",
    "bảng nhân",
    "bang nhan"
  ]
}
```

Không nên lưu field hiển thị bằng tiếng Việt không dấu, vì generator sẽ dễ sinh nội dung kém tự nhiên cho giáo viên và học sinh.

## Objective Schema

Mỗi object trong `grade_*/objectives.json` nên có các field chính:

```json
{
  "objective_id": "math_5_percent_ratio",
  "subject": "Toán",
  "subject_display": "Toán",
  "grade": 5,
  "topic": "Tỉ số phần trăm",
  "objective_text": "Nhận biết và vận dụng tỉ số phần trăm trong các tình huống đơn giản...",
  "language": "vi",
  "source_ref": "GDPT_2018_math_primary_curated_v1",
  "search_aliases": ["tỉ số phần trăm", "ti so phan tram", "giảm giá", "giam gia"],
  "cognitive_level": "apply",
  "difficulty_band": "medium",
  "allowed_difficulty_range": ["easy", "medium"],
  "required_skills": ["interpret_percent", "solve_simple_word_problem"],
  "prerequisites": ["Hiểu phân số và số thập phân cơ bản"],
  "grade_scope": {
    "min_grade": 5,
    "target_grade": 5,
    "max_grade": 5
  },
  "complexity_signals": {
    "number_of_steps": 2,
    "abstractness": "medium"
  },
  "recommended_question_types": ["multiple_choice", "matching"],
  "misconceptions": [
    {
      "misconception": "Học sinh nhầm 25% với 25 lần.",
      "correct_concept": "25% nghĩa là 25 phần trên 100."
    }
  ],
  "scope_policy": {
    "in_scope": ["tỉ số phần trăm", "giảm giá đơn giản"],
    "below_grade": "simplify_and_generate",
    "at_grade": "generate_normally",
    "above_grade": "downgrade_or_warn",
    "out_of_program": "flag_and_suggest_related_objective",
    "not_allowed": ["lãi suất kép", "phương trình đại số"]
  },
  "grounding_passages": [
    "Lớp 5 làm quen và vận dụng tỉ số phần trăm trong các tình huống thực tế đơn giản."
  ],
  "default_examples": [
    {
      "raw_text": "Một hộp bút giá 40.000 đồng được giảm 25%.",
      "structured": {
        "price": 40000,
        "percent": 25,
        "context": "giảm giá"
      }
    }
  ]
}
```

## Luồng Sử Dụng

```text
Teacher Request
-> Optional Lesson Plan/Slide Parsing
-> Curriculum Objective Retrieval from GDPT 2018
-> Align Teacher Context with Curriculum Objective
-> Scope Check
-> Difficulty Assessment
-> Game Template Recommendation
-> Content Generation
-> Schema Validation
-> Faithfulness, Scope & Safety Check
-> Teacher Review
```

Nếu giáo viên không upload giáo án/slide, hệ thống chỉ dùng request và GDPT KB. Nếu có upload, nội dung upload được dùng để ưu tiên ví dụ, bối cảnh, thời lượng và ghi chú về học sinh, nhưng GDPT vẫn là chuẩn cao nhất để kiểm tra phạm vi.

## Quy Trình Cập Nhật KB

1. Thêm hoặc sửa objective trong `knowledge_base/gdpt_2018/math/grade_*/objectives.json`.
2. Đảm bảo field hiển thị là tiếng Việt có dấu.
3. Thêm cả alias có dấu và không dấu vào `search_aliases`.
4. Chạy script repair/mirror:

```powershell
cd backend
uv run python scripts/repair_primary_math_kb.py
```

5. Chạy test:

```powershell
cd backend
uv run pytest tests/test_curriculum_retrieval.py tests/test_primary_math_kb.py
```

6. Kiểm tra không còn ký tự lỗi encoding trong JSON.
