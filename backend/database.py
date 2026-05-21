import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "veora_restaurant")

client = AsyncIOMotorClient(MONGODB_URL)
database = client[DATABASE_NAME]

def get_collection(collection_name: str):
    return database[collection_name]
