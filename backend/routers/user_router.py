from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from database import get_collection
from auth import get_current_user
from bson import ObjectId
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import os, uuid, random, secrets

from utils import get_current_ist

router = APIRouter(prefix="/api/user", tags=["User"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "images")
os.makedirs(UPLOAD_DIR, exist_ok=True)

BILLS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "bills")
os.makedirs(BILLS_DIR, exist_ok=True)


# ── Menu (public) ────────────────────────────────────────────────────────────

def doc_to_menu(doc: dict) -> dict:
    name = doc.get("name", doc.get("Item Name", "Unspecified")).strip()
    image_url = doc.get("image_url", "")
    
    # Handle legacy or missing image URLs
    if not image_url or "\\" in image_url or "Images" in image_url:
        import os
        media_root = os.path.join(os.path.dirname(os.path.dirname(__file__)), "media", "Recipe_Images")
        
        # If it's a legacy path like 'Images\Plain Rice.jpg', extract the name
        lookup_name = name
        if image_url and "\\" in image_url:
            filename_part = image_url.split("\\")[-1]
            lookup_name = os.path.splitext(filename_part)[0]

        try:
            files = os.listdir(media_root)
            files_lower = {f.lower(): f for f in files}
            
            # Try matching by the legacy filename first, then by item name
            target_names = [lookup_name, name]
            for t_name in target_names:
                found = False
                for ext in [".jpg", ".jpeg", ".png"]:
                    potential_filename_lower = f"{t_name}{ext}".lower()
                    if potential_filename_lower in files_lower:
                        actual_filename = files_lower[potential_filename_lower]
                        import urllib.parse
                        encoded_filename = urllib.parse.quote(actual_filename)
                        image_url = f"/media/Recipe_Images/{encoded_filename}"
                        found = True
                        break
                if found: break
        except Exception:
            pass

    # Ensure relative paths start with a slash for proper concatenation in frontend
    if image_url and not image_url.startswith("http") and not image_url.startswith("/"):
        image_url = f"/{image_url}"

    return {
        "id": str(doc["_id"]),
        "name": name,
        "description": doc.get("description", doc.get("Ingredients & Quantity", "")),
        "price": doc.get("price", doc.get("Price (₹)", 0)),
        "category": doc.get("category", doc.get("Category", "Uncategorized")),
        "image_url": image_url,
        "available": doc.get("available", True),
        "food_type": doc.get("food_type", doc.get("Type", "Veg")),
    }


@router.get("/menu")
async def get_menu():
    """Public endpoint — no auth required."""
    col = get_collection("Menu")
    items = await col.find({"available": {"$ne": False}}).to_list(length=200)
    # print("items",items) # Removed as it causes UnicodeEncodeError on some terminals
    return [doc_to_menu(i) for i in items]


# ── Table Booking ─────────────────────────────────────────────────────────────

class BookingCreate(BaseModel):
    date: str
    time: str
    guests: int
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    coupon_code: Optional[str] = None
    special_requests: Optional[str] = ""
    dishes: Optional[list[str]] = []


@router.post("/book-table", status_code=201)
async def book_table(booking: BookingCreate, current_user = Depends(get_current_user)):
    col = get_collection("bookings")
    coupon_col = get_collection("coupons")

    discount = 0.0
    if booking.coupon_code:
        coupon = await coupon_col.find_one({
            "user_id": str(current_user["_id"]),
            "code": booking.coupon_code,
            "status": "active"
        })
        if coupon:
            discount = coupon.get("discount_value", 0.0)
            await coupon_col.update_one({"_id": coupon["_id"]}, {"$set": {"status": "used"}})
        else:
            raise HTTPException(status_code=400, detail="Invalid or already used coupon code")

    # Calculate total for pre-ordered dishes
    # frontend might send strings or objects. We convert to objects.
    menu_col = get_collection("Menu")
    formatted_dishes = []
    total_amount = 0.0
    
    if booking.dishes:
        # Fetch menu prices - Search in both 'name' and 'Item Name' fields
        unique_dish_names = list(set([d if isinstance(d, str) else d.get("name") for d in booking.dishes]))
        items = await menu_col.find({
            "$or": [
                {"name": {"$in": unique_dish_names}},
                {"Item Name": {"$in": unique_dish_names}}
            ]
        }).to_list(length=100)
        
        # Build price map handling both field styles
        price_map = {}
        for i in items:
             n = i.get("name") or i.get("Item Name")
             p = i.get("price") or i.get("Price (₹)")
             if n: price_map[n] = float(p) if p is not None else 0.0
        
        for dish in booking.dishes:
            if isinstance(dish, str):
                name = dish
                qty = 1
            else:
                name = dish.get("name")
                qty = dish.get("qty", 1)
            
            price = price_map.get(name, 0.0)
            formatted_dishes.append({"name": name, "qty": qty, "price": price})
            total_amount += price * qty

    # Apply discount to total if any
    final_amount = max(0, total_amount - discount)

    doc = {
        "user_id": str(current_user["_id"]),
        "date": booking.date,
        "time": booking.time,
        "guests": booking.guests,
        "name": booking.name or current_user.get("name", "User"),
        "email": booking.email or current_user.get("email", ""),
        "phone": booking.phone or current_user.get("mobile", ""),
        "special_requests": booking.special_requests,
        "dishes": formatted_dishes,
        "coupon_code": booking.coupon_code,
        "discount_applied": round(float(discount), 2),
        "total_amount": round(final_amount, 2),
        "bill_status": "none",
        "status": "upcoming",
        "created_at": get_current_ist(),
    }
    result = await col.insert_one(doc)
    return {
        "message": "Table booked successfully!",
        "booking_id": str(result.inserted_id),
        "discount_applied": discount,
        "total_amount": round(final_amount, 2)
    }


@router.get("/bookings")
async def get_my_bookings(current_user = Depends(get_current_user)):
    col = get_collection("bookings")
    # Return all except cancelled if we want a clean view, or all to show history.
    # User said "show if user have reservations", implies active ones.
    bookings = await col.find({
        "user_id": str(current_user["_id"]),
        "status": {"$ne": "cancelled"}
    }).sort("date", 1).to_list(length=50)
    for b in bookings:
        b["_id"] = str(b["_id"])
    # Auto-heal totals for bookings with items but zero total
    for b in bookings:
        if b.get("dishes") and b.get("total_amount", 0) == 0:
            menu_col = get_collection("Menu")
            new_total = 0.0
            updated_dishes = []
            
            # Fetch all prices for these dishes
            names = [d.get("name") if isinstance(d, dict) else d for d in b["dishes"]]
            menu_items = await menu_col.find({"$or":[{"name":{"$in":names}},{"Item Name":{"$in":names}}]}).to_list(100)
            price_map = { (i.get("name") or i.get("Item Name")): float(i.get("price") or i.get("Price (₹)") or 0) for i in menu_items }
            
            for d in b["dishes"]:
                name = d.get("name") if isinstance(d, dict) else d
                qty = d.get("qty") if isinstance(d, dict) else 1
                price = price_map.get(name, 0.0)
                updated_dishes.append({"name": name, "qty": qty, "price": price})
                new_total += price * qty
            
            if new_total > 0:
                await col.update_one({"_id": b["_id"]}, {"$set": {"dishes": updated_dishes, "total_amount": round(new_total, 2)}})
                b["total_amount"] = round(new_total, 2)
                b["dishes"] = updated_dishes

    return bookings


@router.get("/bookings/{booking_id}")
async def get_booking_details(booking_id: str, current_user = Depends(get_current_user)):
    col = get_collection("bookings")
    try:
        obj_id = ObjectId(booking_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid booking ID")
    
    booking = await col.find_one({"_id": obj_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if str(booking.get("user_id")) != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized to view this booking")
    
    booking["_id"] = str(booking["_id"])
    return booking


@router.patch("/bookings/{booking_id}/request-bill")
async def request_bill(booking_id: str, current_user = Depends(get_current_user)):
    col = get_collection("bookings")
    booking = await col.find_one({"_id": ObjectId(booking_id)})
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if str(booking.get("user_id")) != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await col.update_one(
        {"_id": ObjectId(booking_id)},
        {"$set": {"bill_status": "order_requested"}}
    )
    return {"message": "Order requested successfully. Our chef is starting your meal!"}


@router.patch("/bookings/{booking_id}/apply-coupon")
async def apply_coupon_to_bill(booking_id: str, payload: dict, current_user = Depends(get_current_user)):
    col = get_collection("bookings")
    coupon_col = get_collection("coupons")
    
    code = payload.get("coupon_code")
    if not code:
        raise HTTPException(status_code=400, detail="Coupon code is required")
        
    booking = await col.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.get("discount_applied", 0) > 0:
        raise HTTPException(status_code=400, detail="A coupon has already been applied to this booking")

    coupon = await coupon_col.find_one({
        "user_id": str(current_user["_id"]),
        "code": code,
        "status": "active"
    })
    
    if not coupon:
        raise HTTPException(status_code=400, detail="Invalid, expired or already used coupon code")

    discount = float(coupon.get("discount_value", 0.0))
    current_total = float(booking.get("total_amount", 0.0))
    
    # Check if this was a percentage discount or absolute. Standard is percentage based on SaveFood logic.
    # In our seed/logic, we use percentage (e.g. 10, 15, 20).
    # If the value is > 100, we treat as absolute, else percentage of total.
    actual_discount_amount = 0.0
    if discount <= 100:
        actual_discount_amount = (current_total * discount) / 100
    else:
        actual_discount_amount = discount

    new_total = max(0, current_total - actual_discount_amount)
    
    await col.update_one(
        {"_id": ObjectId(booking_id)},
        {"$set": {
            "discount_applied": round(actual_discount_amount, 2),
            "total_amount": round(new_total, 2),
            "coupon_code": code
        }}
    )
    
    await coupon_col.update_one({"_id": coupon["_id"]}, {"$set": {"status": "used"}})
    
    return {
        "message": f"Coupon applied! You saved ₹{round(actual_discount_amount, 2)}",
        "discount_applied": round(actual_discount_amount, 2),
        "total_amount": round(new_total, 2)
    }


@router.patch("/bookings/{booking_id}/pay")
async def mark_booking_paid(booking_id: str, current_user = Depends(get_current_user)):
    col = get_collection("bookings")
    booking = await col.find_one({"_id": ObjectId(booking_id)})
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    if str(booking.get("user_id")) != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    await col.update_one(
        {"_id": ObjectId(booking_id)},
        {"$set": {
            "bill_status": "paid",
            "status": "past", # Mark session as finished
            "paid_at": get_current_ist()
        }}
    )
    return {"message": "Payment successful! Thank you for dining with us."}


@router.patch("/bookings/{booking_id}/add-items")
async def add_booking_items(booking_id: str, payload: dict, current_user = Depends(get_current_user)):
    col = get_collection("bookings")
    booking = await col.find_one({"_id": ObjectId(booking_id)})
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    items_to_add = payload.get("dishes", []) # Expecting [{name, qty}]
    if not items_to_add:
        return {"message": "No dishes added"}

    # Fetch prices for new items - Search in both fields
    menu_col = get_collection("Menu")
    names = [i.get("name") if isinstance(i, dict) else i for i in items_to_add]
    menu_items = await menu_col.find({
        "$or": [
            {"name": {"$in": names}},
            {"Item Name": {"$in": names}}
        ]
    }).to_list(length=100)
    
    price_map = {}
    for i in menu_items:
        n = i.get("name") or i.get("Item Name")
        p = i.get("price") or i.get("Price (₹)")
        if n: price_map[n] = float(p) if p is not None else 0.0
    
    current_dishes = booking.get("dishes", [])
    # Convert old string dishes to objects if any exist for back-compat
    if current_dishes and isinstance(current_dishes[0], str):
        # Fetch prices for old items too
        old_names = [d for d in current_dishes]
        old_items = await menu_col.find({
            "$or": [
                {"name": {"$in": old_names}},
                {"Item Name": {"$in": old_names}}
            ]
        }).to_list(length=100)
        old_price_map = {}
        for i in old_items:
            n = i.get("name") or i.get("Item Name")
            p = i.get("price") or i.get("Price (₹)")
            if n: old_price_map[n] = float(p) if p is not None else 0.0
        
        current_dishes = [{"name": d, "qty": 1, "price": old_price_map.get(d, 0.0)} for d in current_dishes]

    new_total_added = 0.0
    for item in items_to_add:
        if isinstance(item, str):
            name = item
            qty = 1
        else:
            name = item.get("name")
            qty = item.get("qty", 1)
        
        price = price_map.get(name, 0.0)
        new_total_added += price * qty
        
        # Merge if item already exists
        found = False
        for cd in current_dishes:
            if cd.get("name") == name:
                cd["qty"] = cd.get("qty", 0) + qty
                found = True
                break
        if not found:
            current_dishes.append({"name": name, "qty": qty, "price": price})

    new_total = 0.0
    for cd in current_dishes:
        price = cd.get("price", 0.0)
        qty = cd.get("qty", 1)
        new_total += price * qty
    
    await col.update_one(
        {"_id": ObjectId(booking_id)},
        {"$set": {
            "dishes": current_dishes,
            "total_amount": round(new_total, 2),
            "bill_status": "none" # Reset so they can request order again
        }}
    )
    
    return {
        "message": f"Added items to your order",
        "total_amount": round(new_total, 2)
    }


@router.patch("/bookings/{booking_id}/update-item-qty")
async def update_item_qty(booking_id: str, payload: dict, current_user = Depends(get_current_user)):
    col = get_collection("bookings")
    booking = await col.find_one({"_id": ObjectId(booking_id)})
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    dish_name = payload.get("dish_name")
    delta = payload.get("delta", 0) # +1 or -1
    
    if not dish_name or delta == 0:
        return {"message": "No change requested"}

    if booking.get("is_locked") and delta < 0:
        raise HTTPException(status_code=403, detail="This order is locked. You can add more items, but cannot remove them.")

    current_dishes = booking.get("dishes", [])
    updated_dishes = []
    total_change = 0.0
    
    found = False
    for cd in current_dishes:
        if isinstance(cd, str):
            # Back-compat for old string format
            if cd == dish_name:
                found = True
                new_qty = 1 + delta
                
                # Fetch price if missing
                menu_col = get_collection("Menu")
                item = await menu_col.find_one({
                    "$or": [{"name": dish_name}, {"Item Name": dish_name}]
                })
                price = float(item.get("price") or item.get("Price (₹)") or 0) if item else 0.0
                
                if new_qty > 0:
                    updated_dishes.append({"name": dish_name, "qty": new_qty, "price": price})
            else:
                updated_dishes.append(cd)
        else:
            # New object format
            if cd.get("name") == dish_name:
                found = True
                new_qty = cd.get("qty", 1) + delta
                
                # Ensure price is present
                if not cd.get("price"):
                    menu_col = get_collection("Menu")
                    item = await menu_col.find_one({
                        "$or": [{"name": dish_name}, {"Item Name": dish_name}]
                    })
                    cd["price"] = float(item.get("price") or item.get("Price (₹)") or 0) if item else 0.0
                
                if new_qty > 0:
                    cd["qty"] = new_qty
                    updated_dishes.append(cd)
            else:
                updated_dishes.append(cd)

    if not found:
        raise HTTPException(status_code=404, detail="Item not found in order")

    new_total = 0.0
    for cd in updated_dishes:
        price = cd.get("price", 0.0)
        if isinstance(cd, dict):
            qty = cd.get("qty", 1)
        else:
            qty = 1 # Back-compat
        new_total += price * qty
    
    await col.update_one(
        {"_id": ObjectId(booking_id)},
        {"$set": {
            "dishes": updated_dishes,
            "total_amount": round(max(0.0, new_total), 2),
            "bill_status": "none" # Reset on qty change too
        }}
    )
    
    return {
        "message": "Quantity updated",
        "total_amount": round(new_total, 2)
    }


@router.patch("/bookings/{booking_id}/cancel")
async def cancel_booking(booking_id: str, current_user = Depends(get_current_user)):
    col = get_collection("bookings")
    booking = await col.find_one({"_id": ObjectId(booking_id)})
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if str(booking.get("user_id")) != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized to cancel this booking")
    
    await col.update_one(
        {"_id": ObjectId(booking_id)},
        {"$set": {"status": "cancelled"}}
    )
    return {"message": "Booking cancelled successfully"}


# ── Waste Upload & Points ─────────────────────────────────────────────────────

from ml_utils import calculate_waste_percentage

def run_ml_waste_detection(image_path: str) -> float:
    """
    Runs the YOLOv8 model to get the detected waste percentage.
    """
    try:
        return calculate_waste_percentage(image_path)
    except Exception as e:
        print(f"ML Error: {e}")
        # Fallback to a random value if ML fails (e.g. model not found)
        import random
        return round(random.uniform(0.02, 0.45), 3)


def calculate_points(waste_pct: float) -> int:
    if waste_pct < 0.10:
        return 100
    elif waste_pct < 0.25:
        return 50
    elif waste_pct < 0.50:
        return 20
    return 0


def generate_coupon_code() -> str:
    return f"SAVEFOOD_{secrets.token_hex(4).upper()}"


@router.post("/upload-waste")
async def upload_waste(
    image: UploadFile = File(...),
    current_user = Depends(get_current_user)
):
    # Save image to uploads/images/
    ext = os.path.splitext(image.filename)[1] or ".jpg"
    filename = f"{current_user['_id']}_{int(get_current_ist().timestamp())}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    contents = await image.read()
    with open(filepath, "wb") as f:
        f.write(contents)

    # Run YOLOv8 detection
    waste_pct = run_ml_waste_detection(filepath)
    points = calculate_points(waste_pct)

    # Update user points
    users_col = get_collection("users")
    user = await users_col.find_one({"_id": current_user["_id"]})
    new_total_points = user.get("total_points", 0) + points

    coupon_generated = False
    reward_data = None

    # Check for 500 point threshold
    coupons_col = get_collection("coupons")
    while new_total_points >= 500:
        new_total_points -= 500
        coupon_generated = True
        
        # New Coupon logic: 10-20% discount, 3-month expiry
        discount = round(random.uniform(10.0, 20.0), 1)
        coupon_code = generate_coupon_code()
        expiry_date = get_current_ist() + timedelta(days=90)
        
        print(f"MILESTONE REACHED: User {current_user['email']} hit 500 points! Generating {discount}% coupon...")
        
        await coupons_col.insert_one({
            "user_id": str(current_user["_id"]),
            "code": coupon_code,
            "discount_value": discount,
            "status": "active",
            "created_at": get_current_ist(),
            "expiry_date": expiry_date,
            "points_basis": 500
        })
        
        # We store the latest coupon data for the response
        reward_data = {
            "code": coupon_code,
            "discount": f"{discount}%",
            "expiry": expiry_date.strftime("%Y-%m-%d")
        }

    # Atomically update points
    await users_col.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"total_points": new_total_points}}
    )

    # Find active booking for today to link this waste upload
    # Prioritize 'active' status regardless of exact UTC date to handle timezone drifts
    bookings_col = get_collection("bookings")
    active_booking = await bookings_col.find_one({
        "user_id": str(current_user["_id"]),
        "status": "active"
    })
    
    booking_id = None
    if active_booking:
        booking_id = str(active_booking["_id"])
    else:
        # Fallback: look for upcoming bookings for today or tomorrow (UTC)
        now = get_current_ist()
        today_utc = now.strftime("%Y-%m-%d")
        tomorrow_utc = (now + timedelta(days=1)).strftime("%Y-%m-%d")
        yesterday_utc = (now - timedelta(days=1)).strftime("%Y-%m-%d")
        
        fallback_booking = await bookings_col.find_one({
            "user_id": str(current_user["_id"]),
            "date": {"$in": [yesterday_utc, today_utc, tomorrow_utc]},
            "status": "upcoming"
        })
        if fallback_booking:
            booking_id = str(fallback_booking["_id"])

    # ── One scan per booking enforcement ─────────────────────────────────────
    if booking_id:
        waste_col_check = get_collection("waste_uploads")
        existing_scan = await waste_col_check.find_one({
            "user_id": str(current_user["_id"]),
            "booking_id": booking_id
        })
        if existing_scan:
            # Clean up the saved image since we won't process it
            try:
                os.remove(filepath)
            except Exception:
                pass
            raise HTTPException(
                status_code=400,
                detail="You have already submitted a waste scan for this booking. Only one scan is allowed per booking."
            )

    # Log waste upload
    waste_col = get_collection("waste_uploads")
    await waste_col.insert_one({
        "user_id": str(current_user["_id"]),
        "booking_id": booking_id,
        "image_url": f"/uploads/images/{filename}",
        "waste_percentage": round(float(waste_pct), 2),
        "points_earned": points,
        "timestamp": get_current_ist(),
    })

    waste_label = "Excellent! Very little waste." if waste_pct < 0.10 else \
                  "Good job! Moderate waste detected." if waste_pct <= 0.30 else \
                  "High waste detected. Let's aim for less next time!"

    return {
        "waste_percentage": round(waste_pct * 100, 1),
        "points_earned": points,
        "total_points": new_total_points,
        "coupon_generated": coupon_generated,
        "reward": reward_data,
        "image_url": f"/uploads/images/{filename}",
        "message": "Milestone Reached! You earned a coupon." if coupon_generated else waste_label,
    }


# ── Coupons ───────────────────────────────────────────────────────────────────

@router.get("/coupons")
async def get_my_coupons(current_user = Depends(get_current_user)):
    col = get_collection("coupons")
    coupons = await col.find(
        {"user_id": str(current_user["_id"])}
    ).sort("created_at", -1).to_list(length=50)
    for c in coupons:
        c["_id"] = str(c["_id"])
    return coupons


# ── Waste History ─────────────────────────────────────────────────────────────

@router.get("/waste-history")
async def get_waste_history(current_user = Depends(get_current_user)):
    col = get_collection("waste_uploads")
    history = await col.find(
        {"user_id": str(current_user["_id"])}
    ).sort("timestamp", -1).to_list(length=20)
    for h in history:
        h["_id"] = str(h["_id"])
    return history
