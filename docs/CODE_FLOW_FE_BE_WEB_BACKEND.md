# Code Flow Note: FE, BE_Web, backend

Mục tiêu của note này là ghi lại luồng thực tế trong code hiện tại của 3 folder:

- `FE/`: giao diện Next.js cho giáo viên
- `BE_Web/`: web-facing FastAPI + auth + DB + review/persistence
- `backend/`: AI generation FastAPI + retrieval/recommend/generate/validate

Note này bám theo code hiện tại trong repo, không chỉ theo README. Có một điểm quan trọng:

- README gốc vẫn còn mô tả một phần luồng cũ: `FE -> backend` trực tiếp cho tạo game.
- Code hiện tại ở trang `/dashboard/game/new` đã chuyển sang luồng mới: `FE -> BE_Web chat -> backend`.

## 1. Bức tranh tổng thể

Luồng end-to-end hiện tại nên hiểu như sau:

```text
Người dùng
  -> FE (Next.js)
    -> BE_Web (auth, chat session, save game, review, publish)
      -> backend / BE_AI (recommend, generate, stream SSE)
        -> GDPT KB + LLM + validation/repair
      -> DB (users, chat_sessions, chat_messages, lessons, games, game_items, review_events)
    -> FE render review / preview / playable shell
```

Có 2 kiểu flow AI trong repo:

1. Flow đang dùng ở UI tạo game mới:
- `FE/app/dashboard/game/new/page.tsx`
- FE gọi `BE_Web /api/chat/...`
- `BE_Web` gọi tiếp `backend /recommend/games` và `backend /generate/stream`
- `BE_Web` lưu session, message, game, item vào DB

2. Flow AI thuần vẫn còn tồn tại ở service level:
- FE có `FE/src/features/game-creation/ai-api.ts`
- file này gọi thẳng `backend`
- hiện tại page tạo game mới không còn dùng flow này làm luồng chính

## 2. FE: vai trò và luồng chính

## 2.1. FE entry structure

Các page chính:

- `FE/app/page.tsx`: landing
- `FE/app/signin/page.tsx`: đăng nhập
- `FE/app/signup/page.tsx`: đăng ký
- `FE/app/dashboard/page.tsx`: dashboard liệt kê game
- `FE/app/dashboard/game/new/page.tsx`: chat-style tạo game mới
- `FE/app/dashboard/game/preview/page.tsx`: preview local/session-based
- `FE/app/dashboard/lesson/[lessonId]/validate/[gameId]/page.tsx`: teacher review workspace
- `FE/app/dashboard/lesson/[lessonId]/review/[gameId]/page.tsx`: approved/published playable review
- `FE/app/dashboard/account/page.tsx`: account/profile

Auth provider:

- `FE/src/features/auth/auth-context.tsx`

BE_Web client:

- `FE/src/features/game-library/services/be-web.ts`

AI direct client cũ:

- `FE/src/features/game-creation/ai-api.ts`

## 2.2. FE auth flow

Luồng auth ở FE:

1. `AuthProvider` mount lên app.
2. FE đọc token từ `localStorage` key `be_web_access_token`.
3. Nếu có token, FE gọi `beWebApi.me()` tới `GET /api/auth/me`.
4. Nếu token hợp lệ:
- map user BE_Web về shape FE qua `mapAuthUser`
- set `user`
5. Nếu lỗi:
- xóa token local
- set user null

Các action auth chính:

- `signUp()` -> `POST /api/auth/signup`
- `signIn()` -> `POST /api/auth/signin`
- `signOut()` -> `POST /api/auth/signout`, sau đó xóa token FE
- `updateProfile()` -> `PATCH /api/auth/me`
- `changePassword()` -> `POST /api/auth/change-password`
- `uploadAvatar()` -> `POST /api/auth/me/avatar`

Kết luận:

- FE không tự quản auth logic phức tạp
- FE chỉ giữ access token và dùng `Authorization: Bearer ...` cho mọi request tới `BE_Web`

## 2.3. FE dashboard flow

File chính:

- `FE/app/dashboard/page.tsx`

Luồng:

1. Check auth.
2. Gọi `beWebApi.listGames()` -> `GET /api/games`.
3. Đồng thời load local games từ `local-games.ts`.
4. Hiển thị 2 nhóm:
- game lưu local
- game thật từ BE_Web DB
5. Khi click 1 game:
- nếu status là `approved` hoặc `published` -> vào trang `review`
- nếu chưa -> vào trang `validate`

Điểm đáng chú ý:

- dashboard hiện vẫn hỗ trợ cả local preview cũ
- nhưng hệ thống chính đã chuyển sang game persistence qua `BE_Web`

## 2.4. FE tạo game mới: flow thực tế hiện tại

File chính:

- `FE/app/dashboard/game/new/page.tsx`

Đây là page quan trọng nhất của toàn hệ thống hiện tại.

### A. Tạo hoặc mở chat session

Khi user vào trang:

- nếu có query `?session=...`, FE gọi `beWebApi.getChatSession(sessionId)`
- nếu chưa có session, FE chỉ tạo session khi user submit prompt đầu tiên qua `beWebApi.createChatSession()`

API dùng:

- `POST /api/chat/sessions`
- `GET /api/chat/sessions/{sessionId}`

### B. User gửi prompt

Khi teacher nhập:

- subject
- grade
- difficulty
- prompt
- optional source text từ file `.txt/.md/.csv/.json`

FE gọi:

- `beWebApi.recommendChat(sessionId, payload)`
- tương ứng `POST /api/chat/sessions/{sessionId}/recommend`

### C. FE nhận recommendations hoặc guardrail

BE_Web trả về:

- `userMessage`
- `assistantMessage`
- `session`

FE render 1 trong 2 case:

1. `recommendations`
- danh sách game teacher có thể chọn

2. `guardrail`
- yêu cầu bị chặn vì out-of-scope / unsafe / không phù hợp

### D. Teacher chọn game

Khi click một recommendation:

- FE gọi `beWebApi.generateChat(sessionId, { templateId, promptMessageId, recommendationMessageId })`
- đây là stream SSE từ `POST /api/chat/sessions/{sessionId}/generate`

### E. FE render pipeline stages

FE lắng nghe các event stream:

- `stage`
- `safety`
- `complete`
- `error`

Và hiển thị:

- parse tài liệu
- RAG GDPT
- recommend
- generate
- safety gate
- post-gate

### F. Khi complete

Event `complete` cuối cùng được `BE_Web` enrich thêm:

- `assistantMessageId`
- `gameId`
- `lessonId`

Sau đó FE bấm nút "Xem trước & duyệt" để chuyển sang:

- `/dashboard/lesson/{lessonId}/validate/{gameId}`

Kết luận:

- page này không chỉ là UI
- nó là controller chính của flow tạo game
- và flow hiện tại đi qua `BE_Web`, không đi thẳng `backend`

## 2.5. FE validation flow

File chính:

- `FE/app/dashboard/lesson/[lessonId]/validate/[gameId]/page.tsx`

Luồng:

1. Check auth.
2. Gọi `beWebApi.getGame(gameId)` -> `GET /api/games/{gameId}`.
3. Map response sang shape FE qua:
- `mapBeWebLesson`
- `mapBeWebGame`

Teacher có thể:

- sửa item
- recheck item
- approve game

Các API:

- `PATCH /api/games/{gameId}/items/{itemId}`
- `POST /api/games/{gameId}/items/{itemId}/recheck`
- `POST /api/games/{gameId}/approve`

Logic approve phía FE:

- FE còn chạy validate local lần nữa bằng `validateGameItems`
- chỉ khi toàn bộ item hợp lệ mới gọi approve

## 2.6. FE review/play flow

File chính:

- `FE/app/dashboard/lesson/[lessonId]/review/[gameId]/page.tsx`

Luồng:

1. Check auth.
2. Load game từ `BE_Web`.
3. Render `GameShell`.
4. Cho phép publish game.

API:

- `GET /api/games/{gameId}`
- `POST /api/games/{gameId}/publish`

Fullscreen ở đây là fullscreen nội bộ bằng CSS, không dùng browser Fullscreen API.

## 2.7. FE shell registry

Các file quan trọng:

- `FE/src/features/game-shells/registry.tsx`
- `FE/src/features/game-shells/GameShell.tsx`
- `FE/src/features/game-creation/template-registry.ts`

Hiện FE có 2 game chính:

- `treasure_hunt`
- `battleship`

Registry này là single source of truth cho:

- backend template id
- FE template type
- metadata hiển thị ở picker
- shell React để render game

Ý nghĩa kiến trúc:

- thêm game mới thì cần đồng bộ đúng registry
- FE render shell dựa trên `game.templateType`

## 3. BE_Web: vai trò và luồng chính

## 3.1. Entry và trách nhiệm

File entry:

- `BE_Web/app/main.py`

Main app:

- mount CORS
- mount static uploads tại `/uploads`
- include routers:
  - `auth`
  - `chat`
  - `games`

BE_Web hiện là lớp orchestration phía sản phẩm:

- auth
- chat session
- bridge sang backend AI
- lưu game vào DB
- review/edit/approve/publish
- avatar upload

## 3.2. DB model chính

File:

- `BE_Web/app/db/models.py`

Các bảng/aggregate chính:

- `users`
- `chat_sessions`
- `chat_messages`
- `lessons`
- `games`
- `game_items`
- `game_review_events`

Hiểu quan hệ như sau:

1. `User`
- có nhiều `Lesson`
- có nhiều `ChatSession`

2. `ChatSession`
- chứa context teacher đang trao đổi: subject, grade, difficulty, num_items, source_text
- có nhiều `ChatMessage`

3. `Lesson`
- là metadata của một lesson/game request sau khi được materialize

4. `Game`
- thuộc về một `Lesson`
- lưu:
  - `product_template_id`
  - `ai_template_id`
  - `status`
  - `settings_json`
  - `ai_raw_response_json`

5. `GameItem`
- từng câu hỏi/item của game

6. `GameReviewEvent`
- audit trail cho generate/edit/recheck/approve/publish/regenerate

Điểm mạnh của thiết kế này:

- chat history và game persistence tách bạch
- có thể trace từ prompt -> recommendation -> generation -> saved game -> review events

## 3.3. Auth API flow

File:

- `BE_Web/app/api/auth.py`

Luồng:

### Signup

- check email unique
- hash password
- tạo user
- trả `accessToken`

### Signin

- lookup user theo email
- verify password
- trả `accessToken`

### Me / profile

- `GET /api/auth/me`
- `PATCH /api/auth/me`

### Change password

- verify current password
- replace hash

### Avatar upload

- chỉ nhận `png/jpeg/webp`
- check size
- lưu vào `BE_Web/uploads/avatars`
- trả `avatarUrl` dạng `/uploads/avatars/...`

### Signout

- BE_Web hiện trả success đơn giản
- token invalidation thật chưa có stateful revocation

## 3.4. Chat API flow: lớp bọc generation thật

File:

- `BE_Web/app/api/chat.py`

Đây là lớp rất quan trọng vì nó nối FE với backend AI.

### A. Create session

`POST /api/chat/sessions`

- tạo `ChatSession` rỗng cho user

### B. List/get session

- `GET /api/chat/sessions`
- `GET /api/chat/sessions/{sessionId}`

### C. Recommend within session

`POST /api/chat/sessions/{sessionId}/recommend`

Luồng bên trong:

1. Load session theo user.
2. Tạo `ChatMessage` role `user`, type `user_prompt`.
3. Update session context:
- subject
- grade
- difficulty
- num_items
- source_text
- title
4. Gọi `app.services.ai_gateway.recommend_games(...)`.
5. Nếu backend trả blocked:
- tạo assistant message type `guardrail`
6. Nếu ok:
- tạo assistant message type `recommendations`
7. Commit DB và trả lại cả 2 message.

### D. Generate within session

`POST /api/chat/sessions/{sessionId}/generate`

Luồng bên trong:

1. Resolve prompt message được dùng để generate.
2. Tạo assistant message type `generation_result`, status `running`.
3. Tạo payload từ session:
- subject
- grade
- difficulty
- prompt
- num_items
- source_text
- override_template
4. Gọi stream tới backend qua `stream_session_generation(...)`.

### E. Stream session generation

Hàm:

- `stream_session_generation(...)`

Luồng:

1. Nhận stream event từ `backend /generate/stream`.
2. Forward các event `stage`, `safety`.
3. Khi nhận `complete`:
- gọi `create_game_from_generation(...)`
- materialize `Lesson`, `Game`, `GameItem`
- update assistant message thành done
- embed `gameId`, `lessonId` vào result
4. Nếu `blocked` hoặc `error`:
- update assistant message status `error`
- gửi SSE error về FE

Kết luận:

- `BE_Web` không generate nội dung
- nhưng `BE_Web` là nơi biến AI output thành dữ liệu sản phẩm có thể review/publish

## 3.5. AI gateway trong BE_Web

File:

- `BE_Web/app/services/ai_gateway.py`

Vai trò:

- HTTP client sang `backend`

2 hàm chính:

- `recommend_games(payload)` -> gọi `/recommend/games`
- `stream_generate(payload)` -> stream `/generate/stream`

Nếu `backend` lỗi:

- wrap thành `BeAiGatewayError`

Điểm này giúp:

- FE không cần biết backend AI chạy kiểu gì
- chỉ cần nói chuyện với `BE_Web`

## 3.6. Game persistence mapping

File:

- `BE_Web/app/services/game_generation.py`
- `BE_Web/app/services/game_mapper.py`

### create_game_from_generation

Khi AI generate xong:

1. Tạo `Lesson`
2. Tạo `Game`
3. Map AI content thành `GameItem`
4. Ghi `GameReviewEvent` loại `generate`
5. Commit

### map_content_to_items

Rule hiện tại:

- `treasure_hunt` và `battleship` đều kỳ vọng `content.questions`
- `treasure_hunt` được map như quiz synthetic
- `battleship` dùng mapping riêng
- `quiz` dùng `content.items`

Điều này rất quan trọng:

- `product_template_id` có thể là `treasure_hunt`
- nhưng dữ liệu item lưu xuống DB vẫn là question-centric
- shell FE mới là nơi biến item list thành gameplay experience

## 3.7. Review và publish API

Files:

- `BE_Web/app/api/games.py`
- `BE_Web/app/services/game_review.py`

### List/get game

- `GET /api/games`
- `GET /api/games/{gameId}`

Chỉ trả game thuộc user hiện tại.

### Patch item

- update question/correct/options/explanation/hint
- lưu `GameReviewEvent` loại `edit`

### Recheck item

Logic hiện tại khá đơn giản:

- correct answer phải nằm trong options
- options phải unique

Nếu sai:

- `validation_status = invalid`
- fill `validation_errors_json`

### Approve

- set `Game.status = approved`
- add review event `approve`

### Publish

- chỉ publish được nếu game đang `approved`
- add review event `publish`

### Play endpoint

`GET /api/games/{gameId}/play`

Flow này dành riêng cho `battleship`:

1. nhận token qua query param
2. verify token
3. load game
4. đảm bảo `product_template_id == battleship`
5. dựng `window.GAME_CONTENT`
6. fetch HTML shell từ `backend /static/battleship.html`
7. rewrite asset path sang `backend/static/...`
8. inject content vào HTML và trả về

Điểm đáng chú ý:

- `battleship` đang dùng HTML/JS static shell phía `backend`
- không phải React shell thuần như `Treasure Hunt`

## 4. backend: vai trò và luồng AI

## 4.1. Entry

File:

- `backend/app/main.py`

Main app:

- mount CORS cho FE localhost
- include router `routes_generate`
- mount `/static`

Nó là AI service thuần:

- guardrail
- retrieval
- recommendation
- generation
- validation/repair
- SSE stream

## 4.2. API surface chính

File:

- `backend/app/api/routes_generate.py`

Endpoints chính:

- `GET /health`
- `GET /templates`
- `POST /recommend/games`
- `POST /recommend`
- `POST /generate`
- `POST /generate/full`
- `POST /generate/stream`
- `POST /game/battleship/generate`

## 4.3. Guardrail

Trước khi recommend/generate:

- backend chạy `run_guardrails(...)`

Nếu block:

- `/recommend/games` không throw 422 mà trả HTTP 200 với `blocked=True`
- `/generate/stream` trả event `blocked`
- các endpoint khác có thể raise HTTP 422

Ý nghĩa:

- frontend chat UX có thể hiển thị block inline thay vì crash

## 4.4. Recommend flow

### `/recommend/games`

Mục tiêu:

- xếp hạng các game playable cho giáo viên chọn

Luồng:

1. guardrail
2. lấy danh sách playable games từ registry
3. gọi `app.agents.recommender.recommend_games(...)`
4. trả list best-first, item đầu có `recommended=true`

### `/recommend`

Mục tiêu:

- chọn 1 content template duy nhất

Luồng:

1. guardrail
2. lấy candidate theo grade
3. gọi `recommend_node`
4. trả `template_id + rationale`

## 4.5. Generate flow

File lõi:

- `backend/app/agents/graph.py`
- `backend/app/agents/generator.py`

Graph logic:

```text
guardrail
  -> retrieve
  -> recommend
  -> generate
  -> validate
     -> done
     -> repair -> validate
     -> give_up -> finalize_failure
```

### retrieve_node

Vai trò:

- query GDPT context
- resolve objective_id thật
- gắn `context` vào state

### recommend_node

Vai trò:

- nếu teacher đã chọn template hợp lệ -> skip LLM
- nếu không -> LLM chọn template tốt nhất theo grade/prompt/context

### generate_node

Vai trò:

- build prompt + schema
- gọi LLM tool mode để emit JSON content

### validate_node

Vai trò:

- validate output theo schema của template

### repair_node

Vai trò:

- nếu schema invalid thì gọi LLM sửa
- loop đến `max_repairs`

Kết luận:

- `backend` là engine AI thật
- `BE_Web` chỉ orchestration + persistence

## 4.6. Stream flow

Endpoint:

- `POST /generate/stream`

Đây là endpoint quan trọng nhất đối với UX hiện tại.

Nó stream các giai đoạn:

1. guardrail
2. parse tài liệu / retrieve
3. RAG
4. recommend
5. generate
6. safety report
7. schema gate
8. build
9. complete

Các event shape FE/BE_Web dựa vào:

- `stage`
- `safety`
- `blocked`
- `complete`
- `error`

## 4.7. Template registry

File:

- `backend/app/templates/registry.py`

Cơ chế:

- auto-discover mọi schema module trong `backend/app/templates/schemas`
- mỗi game schema export `SPEC`
- registry dùng để:
  - list template
  - get template
  - kiểm tra có content model không
  - lọc theo grade
  - lọc playable

Ý nghĩa:

- thêm game mới phía backend tương đối clean
- không phải hardcode tất cả vào một file JSON

## 4.8. backend model/request shape

File:

- `backend/app/models.py`

Payload request chuẩn:

- `subject`
- `grade`
- `difficulty`
- `prompt`
- `objective_id`
- `source_text`
- `uploaded_file_id`
- `upload_type`
- `num_items`
- `override_template`

Đây chính là shape mà:

- FE direct AI client dùng
- BE_Web AI gateway cũng build theo

## 5. Luồng dữ liệu end-to-end theo tình huống

## 5.1. Đăng nhập

```text
FE signin/signup page
  -> BE_Web /api/auth/signin hoặc /signup
  -> trả accessToken
  -> FE lưu localStorage
  -> các page khác gọi /api/auth/me để hydrate user
```

## 5.2. Tạo game mới theo flow hiện tại

```text
Teacher nhập prompt ở FE
  -> FE ensure chat session trong BE_Web
  -> FE gọi /api/chat/sessions/{id}/recommend
  -> BE_Web lưu user prompt
  -> BE_Web gọi backend /recommend/games
  -> backend guardrail + rank game
  -> BE_Web lưu assistant recommendations
  -> FE hiển thị list game
  -> Teacher chọn game
  -> FE gọi /api/chat/sessions/{id}/generate
  -> BE_Web mở SSE tới backend /generate/stream
  -> backend retrieve/recommend/generate/validate/repair
  -> BE_Web forward stage events
  -> khi complete: BE_Web tạo Lesson + Game + GameItems + ReviewEvent
  -> FE nhận gameId/lessonId
  -> FE chuyển sang trang validate
```

## 5.3. Review và approve

```text
FE validate page
  -> BE_Web /api/games/{gameId}
  -> teacher edit item
  -> BE_Web patch item + review event
  -> teacher recheck
  -> BE_Web simple validation
  -> teacher approve
  -> BE_Web set status = approved
  -> FE chuyển sang review page
```

## 5.4. Publish và play

```text
FE review page
  -> load approved game
  -> render shell
  -> teacher publish
  -> BE_Web set status = published
```

Play details:

- `Treasure Hunt`: render bằng React shell trong FE
- `Battleship`: có thêm flow play HTML qua `BE_Web /api/games/{gameId}/play` và static assets từ `backend`

## 6. Những điểm cần nhớ khi đọc repo này

1. `FE -> backend` direct vẫn còn trong vài file service/README, nhưng flow UI chính đã chuyển sang `FE -> BE_Web -> backend`.

2. `BE_Web` là layer sản phẩm quan trọng nhất:
- auth
- session
- persistence
- audit
- review/publish

3. `backend` không lưu DB sản phẩm:
- nó chủ yếu trả AI output và stream stage

4. `Treasure Hunt` và `Battleship` không cùng kiểu render:
- `Treasure Hunt` đi qua React shell FE
- `Battleship` còn có static HTML/JS shell ở backend

5. Validation ở `BE_Web` hiện tại còn nhẹ:
- chủ yếu check option uniqueness và correct answer có nằm trong options không
- “an toàn/chất lượng sâu” chủ yếu đến từ backend generation + safety report

6. Dashboard hiện vẫn chứa dấu vết local preview cũ:
- nên khi sửa feature mới cần phân biệt “local legacy flow” và “DB-backed flow”

## 7. File nào nên đọc đầu tiên nếu cần debug tiếp

Nếu muốn hiểu flow sản phẩm:

- `FE/app/dashboard/game/new/page.tsx`
- `FE/src/features/game-library/services/be-web.ts`
- `BE_Web/app/api/chat.py`
- `BE_Web/app/services/game_generation.py`
- `BE_Web/app/api/games.py`

Nếu muốn hiểu AI pipeline:

- `backend/app/api/routes_generate.py`
- `backend/app/agents/graph.py`
- `backend/app/agents/generator.py`
- `backend/app/agents/recommender.py`
- `backend/app/templates/registry.py`

Nếu muốn hiểu data model:

- `BE_Web/app/db/models.py`
- `backend/app/models.py`

## 8. Kết luận ngắn

Repo này hiện đã tiến hóa thành mô hình 3 lớp:

1. `FE` lo UX cho giáo viên.
2. `BE_Web` lo auth, session, DB, review, publish và làm gateway sản phẩm.
3. `backend` lo AI pipeline thật: guardrail, GDPT retrieval, recommend, generate, validate, repair.

Nói ngắn gọn:

- `backend` sinh nội dung
- `BE_Web` biến nội dung đó thành game có thể quản lý
- `FE` biến game đó thành trải nghiệm tạo, duyệt và chơi
