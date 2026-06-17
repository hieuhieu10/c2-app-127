from __future__ import annotations

from pathlib import Path
from time import time

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, get_current_user, hash_password, verify_password
from app.core.settings import settings
from app.db.models import User
from app.db.session import get_db
from app.schemas.auth import (
    AuthResponse,
    ChangePasswordRequest,
    SignInRequest,
    SignOutResponse,
    SignUpRequest,
    UpdateProfileRequest,
    UserResponse,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
ALLOWED_AVATAR_CONTENT_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
}


@router.post("/signup", response_model=AuthResponse)
def signup(request: SignUpRequest, db: Session = Depends(get_db)) -> AuthResponse:
    existing = db.scalar(select(User).where(User.email == request.email))
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")

    user = User(
        email=request.email,
        name=request.name,
        password_hash=hash_password(request.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return AuthResponse(user=to_user_response(user), accessToken=create_access_token(str(user.id)))


@router.post("/signin", response_model=AuthResponse)
def signin(request: SignInRequest, db: Session = Depends(get_db)) -> AuthResponse:
    user = db.scalar(select(User).where(User.email == request.email))
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    return AuthResponse(user=to_user_response(user), accessToken=create_access_token(str(user.id)))


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return to_user_response(current_user)


@router.patch("/me", response_model=UserResponse)
def update_me(
    request: UpdateProfileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    current_user.name = request.name.strip()
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return to_user_response(current_user)


@router.post("/change-password", response_model=SignOutResponse)
def change_password(
    request: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SignOutResponse:
    if not verify_password(request.currentPassword, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")

    current_user.password_hash = hash_password(request.newPassword)
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return SignOutResponse(success=True)


@router.post("/me/avatar", response_model=UserResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    extension = ALLOWED_AVATAR_CONTENT_TYPES.get(file.content_type or "")
    if not extension:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Avatar must be a PNG, JPEG, or WebP image",
        )

    content = await file.read()
    if len(content) > settings.max_avatar_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Avatar must be {settings.max_avatar_size_bytes // (1024 * 1024)}MB or smaller",
        )

    avatar_dir = Path(settings.upload_dir) / "avatars"
    avatar_dir.mkdir(parents=True, exist_ok=True)
    filename = f"user-{current_user.id}-{int(time() * 1000)}{extension}"
    filepath = avatar_dir / filename
    filepath.write_bytes(content)

    current_user.avatar_url = f"/uploads/avatars/{filename}"
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return to_user_response(current_user)


@router.post("/signout", response_model=SignOutResponse)
def signout(current_user: User = Depends(get_current_user)) -> SignOutResponse:
    return SignOutResponse(success=True)


def to_user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        avatarUrl=user.avatar_url,
        createdAt=user.created_at,
    )
