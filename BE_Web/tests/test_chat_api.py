from __future__ import annotations

import json

from app.api import chat as chat_api
from app.db.models import ChatMessage, Game, Lesson
from conftest import auth_headers
from sqlalchemy import select


def create_session(client, headers: dict[str, str]) -> int:
    response = client.post("/api/chat/sessions", headers=headers)
    assert response.status_code == 200
    return response.json()["id"]


def test_chat_session_requires_authentication(client):
    assert client.post("/api/chat/sessions").status_code == 401
    assert client.get("/api/chat/sessions").status_code == 401
    assert client.get("/api/chat/sessions/1").status_code == 401


def test_recommend_persists_user_and_assistant_messages(client, monkeypatch):
    headers = auth_headers(client)
    session_id = create_session(client, headers)

    async def fake_recommend(payload):
        assert payload["prompt"] == "Tạo game ôn phép cộng"
        return {
            "recommendations": [
                {
                    "template_id": "treasure_hunt",
                    "name": "Treasure Hunt",
                    "intro": "Phù hợp luyện phép cộng.",
                    "recommended": True,
                }
            ]
        }

    monkeypatch.setattr(chat_api, "recommend_games", fake_recommend)

    response = client.post(
        f"/api/chat/sessions/{session_id}/recommend",
        headers=headers,
        json={
            "subject": "Toán",
            "grade": 3,
            "difficulty": "medium",
            "prompt": "Tạo game ôn phép cộng",
            "numItems": 8,
            "sourceText": "Nguồn mẫu",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["session"]["title"] == "Tạo game ôn phép cộng"
    assert body["userMessage"]["role"] == "user"
    assert body["assistantMessage"]["messageType"] == "recommendations"
    assert body["assistantMessage"]["payloadJson"]["recommendations"][0]["template_id"] == "treasure_hunt"

    detail = client.get(f"/api/chat/sessions/{session_id}", headers=headers)
    assert detail.status_code == 200
    assert [message["role"] for message in detail.json()["messages"]] == ["user", "assistant"]


def test_recommend_guardrail_response_is_saved_in_history(client, monkeypatch):
    headers = auth_headers(client)
    session_id = create_session(client, headers)

    async def fake_recommend(payload):
        return {
            "blocked": True,
            "message": "Ngoài phạm vi hỗ trợ.",
            "suggestion": "Hãy nhập yêu cầu bài học tiểu học.",
            "recommendations": [],
        }

    monkeypatch.setattr(chat_api, "recommend_games", fake_recommend)

    response = client.post(
        f"/api/chat/sessions/{session_id}/recommend",
        headers=headers,
        json={
            "subject": "Lịch sử",
            "grade": 11,
            "difficulty": "medium",
            "prompt": "Viết game chiến tranh chi tiết",
            "numItems": 8,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["assistantMessage"]["messageType"] == "guardrail"
    assert body["assistantMessage"]["payloadJson"]["message"] == "Ngoài phạm vi hỗ trợ."


def test_user_cannot_read_other_users_chat_session(client):
    owner_headers = auth_headers(client, email="owner@example.com", name="Owner")
    other_headers = auth_headers(client, email="other@example.com", name="Other")
    session_id = create_session(client, owner_headers)

    response = client.get(f"/api/chat/sessions/{session_id}", headers=other_headers)

    assert response.status_code == 404


def test_list_chat_sessions_returns_current_user_newest_first_with_summary(client, monkeypatch):
    owner_headers = auth_headers(client, email="owner@example.com", name="Owner")
    other_headers = auth_headers(client, email="other@example.com", name="Other")

    async def first_recommend(payload):
        return {
            "recommendations": [
                {
                    "template_id": "treasure_hunt",
                    "name": "Treasure Hunt",
                    "intro": "Đoạn chat đầu tiên.",
                    "recommended": True,
                }
            ]
        }

    async def second_recommend(payload):
        return {
            "blocked": True,
            "message": "Đoạn chat mới hơn.",
            "suggestion": "Điều chỉnh prompt.",
            "recommendations": [],
        }

    monkeypatch.setattr(chat_api, "recommend_games", first_recommend)
    first_session_id = create_session(client, owner_headers)
    first_response = client.post(
        f"/api/chat/sessions/{first_session_id}/recommend",
        headers=owner_headers,
        json={
            "subject": "Toán",
            "grade": 3,
            "difficulty": "medium",
            "prompt": "Chat đầu tiên",
            "numItems": 8,
        },
    )
    assert first_response.status_code == 200

    monkeypatch.setattr(chat_api, "recommend_games", second_recommend)
    second_session_id = create_session(client, owner_headers)
    second_response = client.post(
        f"/api/chat/sessions/{second_session_id}/recommend",
        headers=owner_headers,
        json={
            "subject": "Khoa học",
            "grade": 4,
            "difficulty": "easy",
            "prompt": "Chat thứ hai",
            "numItems": 6,
        },
    )
    assert second_response.status_code == 200

    other_session_id = create_session(client, other_headers)
    assert other_session_id > 0

    response = client.get("/api/chat/sessions", headers=owner_headers)

    assert response.status_code == 200
    body = response.json()
    assert [session["id"] for session in body] == [second_session_id, first_session_id]
    assert body[0]["messageCount"] == 2
    assert body[0]["lastMessagePreview"] == "Đoạn chat mới hơn."
    assert body[0]["title"] == "Chat thứ hai"
    assert body[1]["messageCount"] == 2
    assert body[1]["lastMessagePreview"] == "Đã đề xuất trò chơi phù hợp."


def test_generate_stream_persists_game_and_assistant_payload(client, monkeypatch):
    headers = auth_headers(client)
    session_id = create_session(client, headers)

    async def fake_recommend(payload):
        return {
            "recommendations": [
                {
                    "template_id": "treasure_hunt",
                    "name": "Treasure Hunt",
                    "intro": "Phù hợp luyện phép cộng.",
                    "recommended": True,
                }
            ]
        }

    async def fake_stream(payload):
        yield {
            "type": "stage",
            "id": "recommend",
            "label": "Đề xuất mẫu trò chơi",
            "subtitle": "Chọn mẫu Treasure Hunt",
            "tag": "Bộ điều phối",
            "status": "done",
        }
        yield {
            "type": "safety",
            "report": {
                "overall": "pass",
                "checks": [{"id": "entailment", "label": "Đáp án", "detail": "Ổn", "status": "pass"}],
                "schema_valid": True,
            },
            "elapsed_ms": 1200,
        }
        yield {
            "type": "complete",
            "template_id": "treasure_hunt",
            "template_name": "Treasure Hunt",
            "content": {
                "template_id": "treasure_hunt",
                "questions": [
                    {
                        "question": "2 + 2 = ?",
                        "correct_answer": "4",
                        "distractors": ["3", "5", "6"],
                        "hint": "Cộng hai số giống nhau",
                        "explanation": "2 + 2 bằng 4",
                        "objective_id": "OBJ-CHAT-1",
                    }
                ],
            },
            "safety_report": {
                "overall": "pass",
                "checks": [{"id": "entailment", "label": "Đáp án", "detail": "Ổn", "status": "pass"}],
                "schema_valid": True,
            },
            "elapsed_ms": 2200,
        }

    monkeypatch.setattr(chat_api, "recommend_games", fake_recommend)
    monkeypatch.setattr(chat_api, "stream_generate", fake_stream)

    recommend_response = client.post(
        f"/api/chat/sessions/{session_id}/recommend",
        headers=headers,
        json={
            "subject": "Toán",
            "grade": 3,
            "difficulty": "medium",
            "prompt": "Tạo game ôn phép cộng",
            "numItems": 8,
        },
    )
    assert recommend_response.status_code == 200
    prompt_message_id = recommend_response.json()["userMessage"]["id"]

    stream_response = client.post(
        f"/api/chat/sessions/{session_id}/generate",
        headers=headers,
        json={"templateId": "treasure_hunt", "promptMessageId": prompt_message_id},
    )

    assert stream_response.status_code == 200
    chunks = [chunk for chunk in stream_response.text.split("\n\n") if chunk.strip()]
    final_event = json.loads(chunks[-1][6:])
    assert final_event["type"] == "complete"
    assert final_event["gameId"] >= 1
    assert final_event["lessonId"] >= 1

    SessionLocal = client.app.state.testing_session_local
    db = SessionLocal()
    try:
        saved_game = db.scalar(select(Game).where(Game.id == final_event["gameId"]))
        saved_lesson = db.scalar(select(Lesson).where(Lesson.id == final_event["lessonId"]))
        assistant_message = db.scalar(select(ChatMessage).where(ChatMessage.id == final_event["assistantMessageId"]))
        assert saved_game is not None
        assert saved_lesson is not None
        assert assistant_message is not None
        assert assistant_message.status.value == "done"
        assert assistant_message.payload_json["result"]["gameId"] == saved_game.id
        assert assistant_message.payload_json["result"]["lessonId"] == saved_lesson.id
    finally:
        db.close()
