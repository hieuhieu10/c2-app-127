from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    name: str | None = None
    createdAt: datetime


class AuthResponse(BaseModel):
    user: UserResponse
    accessToken: str


class SignUpRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=255)


class SignInRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=255)


class SignOutResponse(BaseModel):
    success: bool


class UpdateProfileRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class ChangePasswordRequest(BaseModel):
    currentPassword: str = Field(..., min_length=1, max_length=255)
    newPassword: str = Field(..., min_length=6, max_length=255)
