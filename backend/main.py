from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routers import auth_router, admin_router, user_router
import os
from contextlib import asynccontextmanager
from datetime import datetime
from database import get_collection
from auth import get_password_hash

from utils import get_current_ist

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Seed admin
    col = get_collection("users")
    # Ensure unique email index
    await col.create_index("email", unique=True)
    admin = await col.find_one({"email": "admin@test.com"})
    print("admin",admin)
    if not admin:
        hashed = get_password_hash("admin123")
        await col.insert_one({
            "name": "Super Admin",
            "email": "admin@test.com",
            "password": hashed,
            "mobile": "",
            "cust_id": "ADMIN-000",
            "role": "admin",
            "status": "active",
            "total_points": 0,
            "created_at": get_current_ist(),
        })
    yield
    # Shutdown logic (if any) could go here

app = FastAPI(
    title="Veora Restaurant API",
    description="Backend API for Veora Fine Dining — Auth, Admin, User, and ML Endpoints",
    version="1.0.0",
    lifespan=lifespan
)

# ── CORS ──────────────────────────────────────────────────────────────────────
allowed_origins_env = os.getenv("ALLOWED_ORIGINS")
if allowed_origins_env:
    allow_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]
else:
    allow_origins = [
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:5174", "http://127.0.0.1:5174",
        "http://localhost:5175", "http://127.0.0.1:5175",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static files (uploaded images & bills) ────────────────────────────────────
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
MEDIA_DIR = os.path.join(os.path.dirname(__file__), "media")
os.makedirs(os.path.join(UPLOADS_DIR, "images"), exist_ok=True)
os.makedirs(os.path.join(UPLOADS_DIR, "bills"), exist_ok=True)

app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router.router)
app.include_router(admin_router.router)
app.include_router(user_router.router)


@app.get("/")
async def root():
    return {"message": "Veora Restaurant API is running 🍽️", "docs": "/docs"}


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

