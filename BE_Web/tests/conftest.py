from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.games import get_ai_client
from app.db import models  # noqa: F401
from app.db.session import Base, get_db
from app.main import app
from app.schemas.ai import AIGameResponse


class MockAIClient:
    def __init__(self, response: AIGameResponse | None = None) -> None:
        self.response = response or AIGameResponse(
            ok=True,
            template_id="quiz",
            content={
                "title": "Sample quiz",
                "objective_id": "OBJ-1",
                "items": [
                    {
                        "question": "What is 2 + 2?",
                        "correct_answer": "4",
                        "distractors": ["3", "5", "6"],
                        "hint": "Add the two numbers.",
                        "explanation": "2 + 2 equals 4.",
                        "objective_id": "OBJ-1",
                    }
                ],
            },
        )

    async def generate(self, request):
        return self.response


@pytest.fixture()
def client() -> TestClient:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    Base.metadata.create_all(bind=engine)

    def override_db():
        db: Session = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_ai_client] = lambda: MockAIClient()
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def auth_headers(
    client: TestClient,
    *,
    email: str = "teacher@example.com",
    password: str = "secret123",
    name: str = "Teacher",
) -> dict[str, str]:
    response = client.post(
        "/api/auth/signup",
        json={"name": name, "email": email, "password": password},
    )
    assert response.status_code == 200
    token = response.json()["accessToken"]
    return {"Authorization": f"Bearer {token}"}
