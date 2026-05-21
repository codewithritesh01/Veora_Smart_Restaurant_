from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordRequestForm
from database import get_collection
from auth import verify_password, get_password_hash, create_access_token, get_current_user
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
import uuid

from utils import get_current_ist

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2)
    email: EmailStr
    password: str = Field(..., min_length=6)
    mobile: Optional[str] = ""
    role: str = "user"  # "user" or "admin"


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest):
    col = get_collection("users")
    existing = await col.find_one({"email": req.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed = get_password_hash(req.password)
    cust_id = f"CUST-{uuid.uuid4().hex[:8].upper()}"
    user_doc = {
        "name": req.name,
        "email": req.email,
        "password": hashed,
        "mobile": req.mobile,
        "cust_id": cust_id,
        "role": req.role,
        "status": "active",
        "total_points": 0,
        "created_at": get_current_ist(),
    }
    result = await col.insert_one(user_doc)
    return {"message": "User registered successfully", "id": str(result.inserted_id)}


@router.post("/login")
async def login(req: RegisterRequest = None, form_data: OAuth2PasswordRequestForm = Depends()):
    """Login with email + password, returns JWT token."""
    col = get_collection("users")
    user = await col.find_one({"email": form_data.username})
    if not user or not verify_password(form_data.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(data={"sub": str(user["_id"])})
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.get("role", "user"),
        "name": user.get("name", ""),
    }


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/login-json")
async def login_json(body: LoginRequest):
    """JSON body login endpoint for frontend Axios calls."""
    col = get_collection("users")
    email = body.email
    password = body.password
    user = await col.find_one({"email": email})
    if not user or not verify_password(password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(data={"sub": str(user["_id"])})
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.get("role", "user"),
        "name": user.get("name", ""),
    }


@router.get("/me")
async def get_me(current_user = Depends(get_current_user)):
    return {
        "id": str(current_user["_id"]),
        "name": current_user.get("name"),
        "email": current_user.get("email"),
        "role": current_user.get("role"),
        "total_points": current_user.get("total_points", 0),
        "cust_id": current_user.get("cust_id"),
    }
