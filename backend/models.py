from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import List, Optional
from utils import get_current_ist

class User(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: str
    email: EmailStr
    cust_id: str
    password: str
    mobile: str
    status: str
    created_at: datetime = Field(default_factory=get_current_ist)
    role: str
    total_points: int = 0

class Sale(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    date: datetime = Field(alias="Date")
    day_of_week: str
    is_holiday: bool
    weather_type: str
    temperature_range: str
    customer_id: str
    items_purchased: List[str]
    total_bill: float
    created_at: datetime = Field(default_factory=get_current_ist)
    payment_method: str

class Recipe(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    item: str = Field(alias="Item")
    ingredient: str = Field(alias="Ingredient")
    qty_per_dish: float = Field(alias="Qty per dish")

class Inventory(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    date: datetime = Field(alias="Date")
    ingredient: str = Field(alias="Ingredient")
    stock: float = Field(alias="Stock")

class UserCoupon(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    cust_id: str
    coupon: str
    created_at: datetime = Field(default_factory=get_current_ist)
    isvalid: bool

class Menu(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    category: str = Field(alias="Category")
    item_name: str = Field(alias="Item Name")
    price: float = Field(alias="Price (₹)")
    ingredients_and_quantity: str = Field(alias="Ingredients & Quantity")
    total_weight_g: float = Field(alias="Total Weight (g)")
    food_type: str = Field(alias="Type", default="Veg") # Defaulting to Veg if missing

class Log(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    timestamp: datetime = Field(default_factory=get_current_ist)
    level: str
    message: str
    user_id: Optional[str] = None
    action: Optional[str] = None

class Booking(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    date: str
    time: str
    guests: int
    name: str
    email: str
    phone: str
    message: Optional[str] = None
    coupon_code: Optional[str] = None
    discount_applied: float = 0.0
    created_at: datetime = Field(default_factory=get_current_ist)

class WasteUpload(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    image_url: str
    waste_percentage: float
    points_earned: int
    timestamp: datetime = Field(default_factory=get_current_ist)

class Coupon(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    code: str
    discount_value: float
    status: str = "active" # active, used, expired
    created_at: datetime = Field(default_factory=get_current_ist)
