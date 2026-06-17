from __future__ import annotations

from app.core.settings import settings
from app.api.games import get_ai_client
from app.main import app
from app.schemas.ai import AIGameResponse
from tests.conftest import MockAIClient, auth_headers


def test_templates_returns_treasure_hunt(client):
    response = client.get("/api/templates")

    assert response.status_code == 200
    assert response.json()[0]["id"] == "treasure_hunt"
    assert response.json()[0]["ai_template_id"] == "quiz"


def test_signup_creates_user_and_returns_token(client):
    response = client.post(
        "/api/auth/signup",
        json={"name": "Teacher", "email": "teacher@example.com", "password": "secret123"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["user"]["email"] == "teacher@example.com"
    assert body["user"]["name"] == "Teacher"
    assert body["accessToken"]


def test_signup_rejects_duplicate_email(client):
    client.post(
        "/api/auth/signup",
        json={"name": "Teacher", "email": "teacher@example.com", "password": "secret123"},
    )

    response = client.post(
        "/api/auth/signup",
        json={"name": "Teacher 2", "email": "teacher@example.com", "password": "secret123"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Email already exists"


def test_signin_rejects_invalid_password(client):
    client.post(
        "/api/auth/signup",
        json={"name": "Teacher", "email": "teacher@example.com", "password": "secret123"},
    )

    response = client.post(
        "/api/auth/signin",
        json={"email": "teacher@example.com", "password": "wrong-password"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"


def test_me_requires_valid_token(client):
    headers = auth_headers(client)

    ok = client.get("/api/auth/me", headers=headers)
    assert ok.status_code == 200
    assert ok.json()["email"] == "teacher@example.com"

    missing = client.get("/api/auth/me")
    assert missing.status_code == 401

    invalid = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-token"})
    assert invalid.status_code == 401


def test_profile_management_requires_authentication(client):
    assert client.patch("/api/auth/me", json={"name": "Updated Name"}).status_code == 401
    assert client.post(
        "/api/auth/change-password",
        json={"currentPassword": "secret123", "newPassword": "newsecret123"},
    ).status_code == 401


def test_update_me_updates_current_user_profile(client):
    headers = auth_headers(client, name="Original Name")

    response = client.patch("/api/auth/me", headers=headers, json={"name": "Updated Name"})

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Updated Name"
    assert "password_hash" not in body
    assert client.get("/api/auth/me", headers=headers).json()["name"] == "Updated Name"


def test_change_password_rejects_incorrect_current_password(client):
    headers = auth_headers(client)

    response = client.post(
        "/api/auth/change-password",
        headers=headers,
        json={"currentPassword": "wrong-password", "newPassword": "newsecret123"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Current password is incorrect"


def test_change_password_replaces_old_password(client):
    client.post(
        "/api/auth/signup",
        json={"name": "Teacher", "email": "teacher@example.com", "password": "secret123"},
    )
    signin = client.post(
        "/api/auth/signin",
        json={"email": "teacher@example.com", "password": "secret123"},
    )
    headers = {"Authorization": f"Bearer {signin.json()['accessToken']}"}

    changed = client.post(
        "/api/auth/change-password",
        headers=headers,
        json={"currentPassword": "secret123", "newPassword": "newsecret123"},
    )
    assert changed.status_code == 200

    old_signin = client.post(
        "/api/auth/signin",
        json={"email": "teacher@example.com", "password": "secret123"},
    )
    assert old_signin.status_code == 401

    new_signin = client.post(
        "/api/auth/signin",
        json={"email": "teacher@example.com", "password": "newsecret123"},
    )
    assert new_signin.status_code == 200


def test_avatar_upload_requires_authentication(client):
    response = client.post(
        "/api/auth/me/avatar",
        files={"file": ("avatar.png", b"\x89PNG\r\n\x1a\navatar", "image/png")},
    )

    assert response.status_code == 401


def test_avatar_upload_updates_user_and_serves_static_file(client):
    headers = auth_headers(client)

    response = client.post(
        "/api/auth/me/avatar",
        headers=headers,
        files={"file": ("avatar.png", b"\x89PNG\r\n\x1a\navatar", "image/png")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["avatarUrl"].startswith("/uploads/avatars/user-")
    assert client.get("/api/auth/me", headers=headers).json()["avatarUrl"] == body["avatarUrl"]

    uploaded = client.get(body["avatarUrl"])
    assert uploaded.status_code == 200
    assert uploaded.content == b"\x89PNG\r\n\x1a\navatar"


def test_avatar_upload_rejects_large_files(client):
    headers = auth_headers(client)
    oversized = b"0" * (settings.max_avatar_size_bytes + 1)

    response = client.post(
        "/api/auth/me/avatar",
        headers=headers,
        files={"file": ("avatar.png", oversized, "image/png")},
    )

    assert response.status_code == 400
    assert "2MB or smaller" in response.json()["detail"]


def test_avatar_upload_rejects_non_image_files(client):
    headers = auth_headers(client)

    response = client.post(
        "/api/auth/me/avatar",
        headers=headers,
        files={"file": ("avatar.txt", b"not-an-image", "text/plain")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Avatar must be a PNG, JPEG, or WebP image"


def test_generate_game_requires_authentication(client):
    assert client.get("/api/games").status_code == 401

    response = client.post(
        "/api/games/generate",
        json={"title": "Math facts", "input": "Teach simple addition."},
    )

    assert response.status_code == 401


def test_generate_game_creates_review_ready_payload_for_owner(client):
    headers = auth_headers(client, email="owner@example.com")

    response = client.post(
        "/api/games/generate",
        headers=headers,
        json={
            "title": "Math facts",
            "input": "Teach simple addition.",
            "product_template_id": "treasure_hunt",
            "grade": 3,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["lessonId"] == 1
    assert body["gameId"] == 1
    assert body["status"] == "draft"
    assert body["aiTemplateId"] == "quiz"
    assert body["productTemplateId"] == "treasure_hunt"
    assert body["grade"] == 3
    assert body["settings"] == {
        "numItems": 10,
        "playerCount": 2,
        "mapTheme": "treasure-hunt",
    }
    assert body["items"][0]["correctAnswer"] == "4"
    assert body["items"][0]["correctAnswer"] in body["items"][0]["options"]
    assert body["items"][0]["options"][0] != body["items"][0]["correctAnswer"]


def test_list_games_returns_current_user_games_newest_first(client):
    headers = auth_headers(client, email="owner@example.com")

    first = client.post(
        "/api/games/generate",
        headers=headers,
        json={"title": "First game", "input": "First input"},
    )
    second = client.post(
        "/api/games/generate",
        headers=headers,
        json={"title": "Second game", "input": "Second input"},
    )

    response = client.get("/api/games", headers=headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    assert body[0]["title"] == "Second game"
    assert body[0]["gameId"] == 2
    assert body[0]["lessonId"] == 2
    assert body[0]["itemCount"] == 1
    assert body[0]["status"] == "draft"
    assert body[1]["title"] == "First game"


def test_list_games_hides_other_users_games(client):
    owner_headers = auth_headers(client, email="owner@example.com", name="Owner")
    other_headers = auth_headers(client, email="other@example.com", name="Other")
    client.post(
        "/api/games/generate",
        headers=owner_headers,
        json={"title": "Owner game", "input": "Teach simple addition."},
    )

    response = client.get("/api/games", headers=other_headers)

    assert response.status_code == 200
    assert response.json() == []


def test_get_edit_recheck_approve_publish_flow(client):
    headers = auth_headers(client)
    generated = client.post(
        "/api/games/generate",
        headers=headers,
        json={"title": "Math facts", "input": "Teach simple addition."},
    ).json()
    game_id = generated["gameId"]
    item_id = generated["items"][0]["id"]

    detail = client.get(f"/api/games/{game_id}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["items"][0]["question"] == "What is 2 + 2?"

    edited = client.patch(
        f"/api/games/{game_id}/items/{item_id}",
        headers=headers,
        json={"question": "Edited question?", "options": ["4", "3", "5"]},
    )
    assert edited.status_code == 200
    assert edited.json()["question"] == "Edited question?"

    rechecked = client.post(f"/api/games/{game_id}/items/{item_id}/recheck", headers=headers)
    assert rechecked.status_code == 200
    assert rechecked.json()["validationStatus"] == "valid"

    approved = client.post(f"/api/games/{game_id}/approve", headers=headers)
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"

    published = client.post(f"/api/games/{game_id}/publish", headers=headers)
    assert published.status_code == 200
    assert published.json()["status"] == "published"


def test_user_cannot_access_other_users_game(client):
    owner_headers = auth_headers(client, email="owner@example.com", name="Owner")
    other_headers = auth_headers(client, email="other@example.com", name="Other")
    generated = client.post(
        "/api/games/generate",
        headers=owner_headers,
        json={"title": "Math facts", "input": "Teach simple addition."},
    ).json()
    game_id = generated["gameId"]
    item_id = generated["items"][0]["id"]

    assert client.get(f"/api/games/{game_id}", headers=other_headers).status_code == 404
    assert client.patch(
        f"/api/games/{game_id}/items/{item_id}",
        headers=other_headers,
        json={"question": "Nope"},
    ).status_code == 404
    assert client.post(f"/api/games/{game_id}/approve", headers=other_headers).status_code == 404
    assert client.post(f"/api/games/{game_id}/publish", headers=other_headers).status_code == 404


def test_publish_requires_approval(client):
    headers = auth_headers(client)
    generated = client.post(
        "/api/games/generate",
        headers=headers,
        json={"title": "Math facts", "input": "Teach simple addition."},
    ).json()

    response = client.post(f"/api/games/{generated['gameId']}/publish", headers=headers)

    assert response.status_code == 400


def test_invalid_ai_response_returns_clear_error(client):
    headers = auth_headers(client)
    app.dependency_overrides[get_ai_client] = lambda: MockAIClient(
        AIGameResponse(ok=True, template_id="quiz", content={"title": "Bad", "items": []})
    )

    response = client.post(
        "/api/games/generate",
        headers=headers,
        json={"title": "Bad", "input": "Bad source"},
    )

    assert response.status_code == 502
    assert "non-empty items list" in response.json()["detail"]


def test_regenerate_not_implemented(client):
    headers = auth_headers(client)
    generated = client.post(
        "/api/games/generate",
        headers=headers,
        json={"title": "Math facts", "input": "Teach simple addition."},
    ).json()
    game_id = generated["gameId"]
    item_id = generated["items"][0]["id"]

    response = client.post(f"/api/games/{game_id}/items/{item_id}/regenerate", headers=headers)

    assert response.status_code == 501
