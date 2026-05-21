from fastapi import APIRouter, HTTPException, Depends, status, BackgroundTasks
from database import get_collection
from auth import get_current_admin
from bson import ObjectId
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import random
from ml_service import run_forecast_pipeline
import urllib.parse

from utils import get_current_ist

router = APIRouter(prefix="/api/admin", tags=["Admin"])


# ── Menu Management ──────────────────────────────────────────────────────────

class MenuItemCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    price: float
    category: str
    image_url: Optional[str] = ""
    available: bool = True
    food_type: Optional[str] = "Veg"


def normalize_qty(qty: float, from_unit: str, to_unit: str) -> float:
    if not from_unit or not to_unit: return qty
    f, t = str(from_unit).lower(), str(to_unit).lower()
    if f == t: return qty
    # Weight: g to kg
    if f == "g" and t == "kg": return qty / 1000.0
    if f == "kg" and t == "g": return qty * 1000.0
    # Volume: ml to l
    if f == "ml" and t == "l": return qty / 1000.0
    if f == "l" and t == "ml": return qty * 1000.0
    return qty


def doc_to_menu(doc: dict) -> dict:
    name = doc.get("name", doc.get("Item Name", "Unspecified")).strip()
    image_url = doc.get("image_url", "")
    
    # Handle legacy or missing image URLs
    if not image_url or "\\" in image_url or "Images" in image_url:
        import os
        media_root = os.path.join(os.path.dirname(os.path.dirname(__file__)), "media", "Recipe_Images")
        
        lookup_name = name
        if image_url and "\\" in image_url:
            filename_part = image_url.split("\\")[-1]
            lookup_name = os.path.splitext(filename_part)[0]

        try:
            files = os.listdir(media_root)
            files_lower = {f.lower(): f for f in files}
            
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

    # Ensure relative paths start with a slash
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
async def get_menu(current_admin = Depends(get_current_admin)):
    col = get_collection("Menu")
    items = await col.find({}).to_list(length=200)
    return [doc_to_menu(i) for i in items]


@router.post("/menu", status_code=201)
async def add_menu_item(item: MenuItemCreate, current_admin = Depends(get_current_admin)):
    col = get_collection("Menu")
    doc = item.model_dump()
    doc["price"] = round(doc["price"], 2)
    doc["created_at"] = get_current_ist()
    result = await col.insert_one(doc)
    return {"message": "Menu item added", "id": str(result.inserted_id)}


@router.delete("/menu/{item_id}")
async def delete_menu_item(item_id: str, current_admin = Depends(get_current_admin)):
    col = get_collection("Menu")
    result = await col.delete_one({"_id": ObjectId(item_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item deleted"}


@router.patch("/menu/{item_id}")
async def update_menu_item(item_id: str, updates: Dict[str, Any], current_admin = Depends(get_current_admin)):
    col = get_collection("Menu")
    updates.pop("_id", None)
    if "price" in updates:
        updates["price"] = round(float(updates["price"]), 2)
    result = await col.update_one({"_id": ObjectId(item_id)}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item updated"}


# ── Dashboard ─────────────────────────────────────────────────────────────────

@router.get("/dashboard")
async def get_dashboard(
    background_tasks: BackgroundTasks,
    filter_type: str = "today",
    custom_start: Optional[str] = None,
    custom_end: Optional[str] = None,
    current_admin = Depends(get_current_admin)
):
    sales_col = get_collection("Sales")
    users_col = get_collection("users")
    bookings_col = get_collection("bookings")
    waste_col = get_collection("waste_uploads")

    # Time frame logic
    today_dt = get_current_ist()
    # Normalize today to start of day
    today_dt = datetime(today_dt.year, today_dt.month, today_dt.day)

    if filter_type == "today":
        start_date = today_dt
        end_date = today_dt
    elif filter_type == "7days":
        start_date = today_dt - timedelta(days=6)
        end_date = today_dt
    elif filter_type == "month":
        start_date = today_dt - timedelta(days=29)
        end_date = today_dt
    elif filter_type == "year":
        start_date = today_dt - timedelta(days=364)
        end_date = today_dt
    elif filter_type == "custom" and custom_start and custom_end:
        try:
            start_date = datetime.strptime(custom_start, "%Y-%m-%d")
            end_date = datetime.strptime(custom_end, "%Y-%m-%d")
        except ValueError:
            start_date = today_dt
            end_date = today_dt
    else:
        start_date = today_dt
        end_date = today_dt

    # Generate lists and matches
    delta = end_date - start_date
    sales_dates_in = []
    for i in range(delta.days + 1):
        d = start_date + timedelta(days=i)
        sales_dates_in.append(d.strftime("%d-%m-%Y"))
    
    start_str_ymd = start_date.strftime("%Y-%m-%d")
    end_str_ymd = end_date.strftime("%Y-%m-%d")

    sales_match = {"Date": {"$in": sales_dates_in}}
    bookings_match = {"date": {"$gte": start_str_ymd, "$lte": end_str_ymd}}
    waste_match = {"timestamp": {"$gte": start_date, "$lt": end_date + timedelta(days=1)}}

    # Aggregated stats
    total_bookings = await bookings_col.count_documents(bookings_match)
    total_waste_submissions = await waste_col.count_documents(waste_match)

    # Customers (Sum of guests from matched bookings)
    pipeline_cust = [
        {"$match": bookings_match},
        {"$group": {"_id": None, "total": {"$sum": "$guests"}}}
    ]
    cust_res = await bookings_col.aggregate(pipeline_cust).to_list(length=1)
    total_users_count = cust_res[0]["total"] if cust_res else 0

    # Revenue
    pipeline_revenue = [
        {"$match": sales_match},
        {"$group": {"_id": None, "total": {"$sum": "$total_bill"}}}
    ]
    rev_result = await sales_col.aggregate(pipeline_revenue).to_list(length=1)
    total_revenue = rev_result[0]["total"] if rev_result else 0

    chart_start = start_date if delta.days >= 6 else (end_date - timedelta(days=6))
    chart_delta = end_date - chart_start
    chart_sales_dates_in = [(chart_start + timedelta(days=i)).strftime("%d-%m-%Y") for i in range(chart_delta.days + 1)]
    chart_sales_match = {"Date": {"$in": chart_sales_dates_in}}

    # Sales per day
    pipeline_daily = [
        {"$match": chart_sales_match},
        {"$group": {
            "_id": "$Date",
            "revenue": {"$sum": "$total_bill"},
            "orders": {"$sum": 1}
        }}
    ]
    daily_sales_raw = await sales_col.aggregate(pipeline_daily).to_list(length=400)

    daily_sales = []
    if daily_sales_raw:
        def convert_date(d):
            try:
                parts = d.split("-")
                if len(parts) == 3 and len(parts[0]) == 2:
                    return f"{parts[2]}-{parts[1]}-{parts[0]}"
            except Exception:
                pass
            return d
        daily_sales = []
        for r in daily_sales_raw:
            date_val = convert_date(r["_id"])
            revenue = r["revenue"]
            # Mock prediction: 1.15x actual revenue with 10% random jitter for demo
            import random
            predicted = round(revenue * random.uniform(1.05, 1.25), 2) if revenue > 0 else random.randint(500, 1500)
            daily_sales.append({
                "date": date_val, 
                "revenue": revenue, 
                "predicted_revenue": predicted,
                "orders": r["orders"]
            })
        daily_sales.sort(key=lambda x: x["date"])

    # --- Aggregation for long ranges (Month-wise) ---
    is_monthwise = delta.days > 30
    if is_monthwise and daily_sales:
        monthly_dict = {}
        for s in daily_sales:
            # s["date"] is YYYY-MM-DD
            month_key = "-".join(s["date"].split("-")[:2]) # YYYY-MM
            if month_key not in monthly_dict:
                monthly_dict[month_key] = {
                    "date": f"{month_key}-01",
                    "revenue": 0,
                    "predicted_revenue": 0,
                    "orders": 0
                }
            monthly_dict[month_key]["revenue"] += s["revenue"]
            monthly_dict[month_key]["predicted_revenue"] += s["predicted_revenue"]
            monthly_dict[month_key]["orders"] += s["orders"]
        
        # Replace daily_sales with monthly totals and sort
        daily_sales = sorted(monthly_dict.values(), key=lambda x: x["date"])

    # Categories
    pipeline_cat = [
        {"$match": sales_match},
        {"$group": {"_id": "$payment_method", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5}
    ]
    cat_raw = await sales_col.aggregate(pipeline_cat).to_list(length=5)
    category_sales = [{"name": r["_id"] or "Unknown", "count": r["count"]} for r in cat_raw]

    # Waste trend
    waste_trend = []
    try:
        waste_pipeline = [
            {"$match": waste_match},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
                "avg_waste": {"$avg": "$waste_percentage"},
                "submissions": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}}
        ]
        waste_raw = await waste_col.aggregate(waste_pipeline).to_list(length=400)
        waste_trend = [{"date": r["_id"], "avg_waste": round(r["avg_waste"], 2), "submissions": r["submissions"]} for r in waste_raw]
    except Exception:
        waste_trend = []

    # --- Fixed 9-Day Window Logic (Yesterday to Next 7 Days) ---
    forecast_sales = []
    
    # 1. Define the 9-day date window
    forecast_dates = [(today_dt - timedelta(days=1)) + timedelta(days=i) for i in range(9)]
    
    # 2. Fetch all predictions from DB once
    forecast_col = get_collection("sales_forecast")
    stored_list = await forecast_col.find({}).to_list(length=20)
    predictions_map = {f["date"]: f["revenue"] for f in stored_list}
    
    # 3. Find actual sales from daily_sales_raw (format: list of {'_id': 'DD-MM-YYYY', 'revenue': ...})
    def find_actual(dt):
        d_str = dt.strftime("%d-%m-%Y")
        for s in daily_sales_raw:
            if s["_id"] == d_str:
                return round(s["revenue"], 2)
        return 0

    # 4. Assemble Exactly 9 Days
    for dt in forecast_dates:
        date_str = dt.strftime("%Y-%m-%d")
        actual_rev = find_actual(dt)
        # Use stored prediction, or calculate a mock one if missing (fallback)
        pred_rev = predictions_map.get(date_str)
        if pred_rev is None:
            # Simple fallback for missing prediction data
            is_weekend = dt.weekday() >= 5
            pred_rev = 1800 if is_weekend else 1200
            
        forecast_sales.append({
            "date": date_str,
            "revenue": actual_rev,
            "predicted_revenue": round(float(pred_rev), 2)
        })
    
    # Trigger background task for ML forecast (only runs once a day internally)
    background_tasks.add_task(run_forecast_pipeline)

    return {
        "stats": {
            "total_users": total_users_count,
            "total_bookings": total_bookings,
            "total_revenue": round(total_revenue, 2),
            "waste_submissions": total_waste_submissions,
        },
        "daily_sales": daily_sales,
        "is_monthwise": is_monthwise,
        "forecast_sales": forecast_sales,
        "category_sales": category_sales,
        "waste_trend": waste_trend,
        "filter": {"start": start_str_ymd, "end": end_str_ymd, "type": filter_type}
    }


# ── Inventory ─────────────────────────────────────────────────────────────────

class InventoryItemCreate(BaseModel):
    ingredient: str
    stock: float
    unit: str
    threshold: float
    used: Optional[float] = 0

@router.get("/inventory")
async def get_inventory(
    filter_type: str = "today",
    custom_start: Optional[str] = None,
    custom_end: Optional[str] = None,
    current_admin = Depends(get_current_admin)
):
    col = get_collection("Inventory")
    forecast_col = get_collection("inventory_forecast")
    
    # Time frame logic
    today_dt = get_current_ist()
    # Normalize today to start of day
    today_dt = datetime(today_dt.year, today_dt.month, today_dt.day)

    # 1. Fetch Forecasts for merging
    all_forecasts = await forecast_col.find({}).to_list(length=500)
    today_str = today_dt.strftime("%Y-%m-%d")
    
    # 2. Get all distinct ingredients and their latest stock
    pipeline_latest = [
        {"$group": {
            "_id": {"$ifNull": ["$ingredient", "$Ingredient"]},
            "total_stock": {"$sum": {"$ifNull": ["$stock", "$Stock", 0]}},
            "total_used": {"$sum": {"$ifNull": ["$used", "$Used", 0]}},
            "unit": {"$first": {"$ifNull": ["$unit", "$Unit", "units"]}},
            "threshold": {"$first": {"$ifNull": ["$threshold", "$Threshold", 10]}}
        }},
        {"$project": {
            "latest_stock": {"$round": [{"$subtract": ["$total_stock", "$total_used"]}, 2]},
            "unit": 1,
            "threshold": 1
        }}
    ]
    latest_inventory_raw = await col.aggregate(pipeline_latest).to_list(length=100)
    latest_map = {r["_id"]: r for r in latest_inventory_raw if r["_id"]}

    # 3. Build Planning Table (3-Day Aggregation)
    planning_data = []
    for ing, data in latest_map.items():
        ls = data.get("latest_stock") or 0
        th = data.get("threshold") or 10
        
        # Sum next 3 days (starting tomorrow)
        next_3_days = [(today_dt + timedelta(days=i)).strftime("%Y-%m-%d") for i in [1, 2, 3]]
        three_day_req = sum([f["predicted_requirement"] for f in all_forecasts if f["ingredient"] == ing and f["date"] in next_3_days])
        
        is_pcs = data.get("unit", "").lower() in ["pcs", "units"]
        
        status = "sufficient"
        if ls < th:
            status = "critical"
        elif ls < three_day_req:
            status = "shortage"

        planning_data.append({
            "key": ing,
            "ingredient": ing,
            "stock": int(ls) if is_pcs else round(float(ls), 2),
            "unit": data["unit"],
            "required_3d": int(three_day_req) if is_pcs else round(three_day_req, 2),
            "status": status
        })

    # 4. Build Daily Tables (Aggregated by Ingredient for Today)
    start_date = today_dt
    end_date = today_dt + timedelta(days=1)
    
    logs = await col.find({}).sort("_id", -1).to_list(length=2000)
    
    # Track totals for today per ingredient
    today_totals = {} 
    
    for item in logs:
        raw_date = item.get("Date", item.get("date"))
        if not raw_date: continue
        item_date = datetime.min
        if isinstance(raw_date, datetime): item_date = raw_date
        elif isinstance(raw_date, str):
            try:
                p = raw_date.split("-")
                item_date = datetime(int(p[2]), int(p[1]), int(p[0]))
            except: continue
        
        if start_date <= item_date < end_date:
            ing = item.get("ingredient", "Unknown")
            unit = item.get("unit", "units")
            
            used_val = float(item.get("used", 0))
            added_val = float(item.get("stock", 0))
            
            if ing not in today_totals:
                today_totals[ing] = {
                    "added": 0,
                    "used": 0,
                    "unit": unit,
                    "date": item_date.strftime("%d-%m-%Y")
                }
            
            today_totals[ing]["added"] += added_val
            today_totals[ing]["used"] += used_val

    usage_data = []
    additions_data = []

    for ing, totals in today_totals.items():
        unit = totals["unit"]
        is_pcs = unit.lower() in ["pcs", "units"]
        
        # Calculate stock states
        # current_balance = start_day + added - used
        # start_day = current_balance - added + used
        current_balance = float(latest_map.get(ing, {}).get("latest_stock", 0))
        added_today = totals["added"]
        used_today = totals["used"]
        
        start_day_stock = current_balance - added_today + used_today
        after_addition_stock = start_day_stock + added_today
        
        if added_today > 0:
            additions_data.append({
                "key": ing,
                "date": totals["date"],
                "ingredient": ing,
                "existing": int(start_day_stock) if is_pcs else round(start_day_stock, 2),
                "added": int(added_today) if is_pcs else round(added_today, 2),
                "total": int(after_addition_stock) if is_pcs else round(after_addition_stock, 2),
                "unit": unit
            })
            
        if used_today > 0:
            usage_data.append({
                "key": ing,
                "date": totals["date"],
                "ingredient": ing,
                "stock": int(after_addition_stock) if is_pcs else round(after_addition_stock, 2), # Stock available after additions
                "used": int(used_today) if is_pcs else round(used_today, 2),
                "balance_stock": int(current_balance) if is_pcs else round(current_balance, 2),
                "unit": unit
            })

    def status_priority(s):
        return {"critical": 0, "shortage": 1, "sufficient": 2}.get(s, 3)

    planning_data = sorted(planning_data, key=lambda x: (status_priority(x["status"]), x["ingredient"]))
    usage_data = sorted(usage_data, key=lambda x: x["ingredient"])
    additions_data = sorted(additions_data, key=lambda x: x["ingredient"])

    return {
        "usage": usage_data,
        "additions": additions_data,
        "planning": planning_data
    }

@router.post("/inventory", status_code=201)
async def add_inventory_item(item: InventoryItemCreate, current_admin = Depends(get_current_admin)):
    col = get_collection("Inventory")
    doc = item.model_dump()
    doc["stock"] = round(doc["stock"], 2)
    doc["threshold"] = round(doc["threshold"], 2)
    doc["used"] = round(doc.get("used", 0), 2)
    
    now = get_current_ist()
    doc["Date"] = now.strftime("%d-%m-%Y")
    doc["date_obj"] = now
    
    result = await col.insert_one(doc)
    return {"message": "Inventory recorded", "id": str(result.inserted_id)}


# ── Sales ─────────────────────────────────────────────────────────────────────

@router.get("/inventory/forecast")
async def get_inventory_forecast(current_admin = Depends(get_current_admin)):
    col = get_collection("inventory_forecast")
    # Fetch all future forecasts
    forecasts = await col.find({}).sort("date", 1).to_list(length=100)
    for f in forecasts:
        f["_id"] = str(f["_id"])
    return forecasts

@router.get("/sales")
async def get_sales(
    date: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    payment_method: Optional[str] = None,
    current_admin = Depends(get_current_admin)
):
    """
    Get sales data with optional filters.
    - date: specific date in DD-MM-YYYY format (matches Sales.Date field)
    - from_date / to_date: range in DD-MM-YYYY format
    - payment_method: UPI, Cash, Card, etc.
    Default: today's sales.
    """
    col = get_collection("Sales")

    query = {}
    
    if not any([date, from_date, to_date]):
        # Default to today
        date = get_current_ist().strftime("%d-%m-%Y")

    if date:
        query["Date"] = date
    elif from_date and to_date:
        from datetime import datetime as dt
        try:
            fd_str = dt.strptime(from_date, "%d-%m-%Y").strftime("%Y-%m-%dT00:00:00Z")
            td_str = dt.strptime(to_date, "%d-%m-%Y").strftime("%Y-%m-%dT23:59:59Z")
        except ValueError:
            raise HTTPException(status_code=400, detail="Date format must be DD-MM-YYYY")

        query["$expr"] = {
            "$and": [
                {
                    "$gte": [
                        {"$dateFromString": {"dateString": "$Date", "format": "%d-%m-%Y", "onError": None, "onNull": None}},
                        {"$dateFromString": {"dateString": fd_str}}
                    ]
                },
                {
                    "$lte": [
                        {"$dateFromString": {"dateString": "$Date", "format": "%d-%m-%Y", "onError": None, "onNull": None}},
                        {"$dateFromString": {"dateString": td_str}}
                    ]
                }
            ]
        }

    if payment_method:
        query["payment_method"] = payment_method

    # Fetch sorted by natural _id desc to get latest
    items = await col.find(query).sort("_id", -1).to_list(length=5000)
    for item in items:
        item["_id"] = str(item["_id"])
    return {"sales": items, "count": len(items)}


# ── All Bookings (with status/date filters) ───────────────────────────────────

@router.get("/bookings")
async def get_all_bookings(
    status: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_admin = Depends(get_current_admin)
):
    """
    Get bookings with optional filters.
    - status: 'future', 'active', 'past'
    - from_date / to_date: range in YYYY-MM-DD format (bookings.date is YYYY-MM-DD)
    """
    col = get_collection("bookings")
    query = {}

    today_str = get_current_ist().strftime("%Y-%m-%d")

    if status == "future":
        # Reservations / Upcoming: NOT active, NOT completed, NOT cancelled, NOT past, date >= today
        query["date"] = {"$gte": today_str}
        query["status"] = {"$nin": ["cancelled", "completed", "active", "past"]}
    elif status == "active":
        # Active Bookings: records checked-in (status='active') OR
        # past bookings where customer paid but order was never marked complete
        query["$or"] = [
            {"status": "active"},
            {"status": "past", "bill_status": "paid"}
        ]
    elif status == "past":
        # Sales history: only completed bookings
        query["status"] = {"$in": ["completed", "past"]}

    if from_date or to_date:
        # If we have a range, it shouldn't overwrite 'today' if status was 'active'
        # but usually range is used instead of status.
        # To be safe, we merge them if date is already in query.
        date_query = {}
        if from_date: date_query["$gte"] = from_date
        if to_date: date_query["$lte"] = to_date
        
        if "date" in query:
            if isinstance(query["date"], str):
                 # Merge status='active' (string) with the range (dict)
                 today_str = query["date"]
                 query["date"] = {
                     "$eq": today_str,
                     **date_query
                 }
            else:
                 query["date"].update(date_query)
        else:
            query["date"] = date_query

    # Only apply global cancelled-exclusion if no specific status filter was set
    if "status" not in query and "$or" not in query:
        query["status"] = {"$nin": ["cancelled"]}
    
    bookings = await col.find(query).sort("created_at", -1).to_list(length=500)
    for b in bookings:
        b["_id"] = str(b["_id"])
    
    # For active bookings, deduplicate by email — keep the record with the most dishes
    if status == "active":
        seen = {}
        for b in bookings:
            key = b.get("email", "")
            dishes = b.get("dishes") or []
            dish_count = len(dishes) if isinstance(dishes, list) else 0
            
            if key not in seen:
                seen[key] = b
            else:
                existing_dishes = seen[key].get("dishes") or []
                existing_count = len(existing_dishes) if isinstance(existing_dishes, list) else 0
                # Prioritise: paid>past bookings remain visible; otherwise keep most dishes
                b_is_paid_past = b.get("status") == "past" and b.get("bill_status") == "paid"
                ex_is_paid_past = seen[key].get("status") == "past" and seen[key].get("bill_status") == "paid"
                if b_is_paid_past and not ex_is_paid_past:
                    seen[key] = b
                elif not ex_is_paid_past and dish_count > existing_count:
                    seen[key] = b
        bookings = list(seen.values())
    
    return bookings

@router.get("/bookings/{booking_id}")
async def get_single_booking(booking_id: str, current_admin = Depends(get_current_admin)):
    col = get_collection("bookings")
    try:
        obj_id = ObjectId(booking_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid booking ID")
    
    booking = await col.find_one({"_id": obj_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking["_id"] = str(booking["_id"])
    return booking

@router.patch("/bookings/{booking_id}")
async def update_booking(booking_id: str, payload: dict, current_admin = Depends(get_current_admin)):
    col = get_collection("bookings")
    if "_id" in payload: del payload["_id"]
    try:
        from bson import ObjectId
        obj_id = ObjectId(booking_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid booking ID")
        
    result = await col.update_one({"_id": obj_id}, {"$set": payload})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    return {"message": "Booking updated successfully"}

@router.patch("/bookings/{booking_id}/lock")
async def toggle_booking_lock(booking_id: str, current_admin = Depends(get_current_admin)):
    col = get_collection("bookings")
    try:
        obj_id = ObjectId(booking_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid booking ID")
    
    booking = await col.find_one({"_id": obj_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    current_status = booking.get("is_locked", False)
    new_status = not current_status
    
    await col.update_one({"_id": obj_id}, {"$set": {"is_locked": new_status}})
    return {"message": f"Order {'locked' if new_status else 'unlocked'} successfully", "is_locked": new_status}

@router.post("/bookings/check-in")
async def check_in_booking(payload: dict, current_admin = Depends(get_current_admin)):
    """
    Finds a booking by email, phone, date, and time, then marks it as 'Active'
    by updating its date to today.
    """
    col = get_collection("bookings")
    
    email = payload.get("email")
    phone = payload.get("phone")
    date = payload.get("date") # Original scheduled date
    time = payload.get("time")
    
    if not all([email, phone, date, time]):
        raise HTTPException(status_code=400, detail="Missing required search fields")
        
    # Find the booking
    is_walkin = payload.get("is_walkin", False)
    name = payload.get("name", "Walk-in Guest")
    guests = payload.get("guests", 2)
    
    # 1. First, check if there's ALREADY an active booking for this guest today
    # to avoid creating duplicates if they check in twice.
    today_str = get_current_ist().strftime("%Y-%m-%d")
    existing_active = await col.find_one({
        "email": email,
        "phone": phone,
        "date": today_str,
        "status": {"$ne": "cancelled"}
    })
    
    if existing_active:
        return {"message": "Guest is already checked-in and active.", "booking_id": str(existing_active["_id"])}

    # 2. Search for the scheduled booking
    booking = await col.find_one({
        "email": email,
        "phone": phone,
        "date": date,
        "time": time
    })
    
    if not booking:
        if is_walkin:
            new_booking = {
                "email": email,
                "phone": phone,
                "name": name,
                "date": today_str,
                "time": time,
                "guests": guests,
                "status": "active",
                "bill_status": "none",
                "dishes": [],
                "total_amount": 0,
                "created_at": get_current_ist()
            }
            result = await col.insert_one(new_booking)
            return {"message": "Instant Walk-in Check-in Successful!", "booking_id": str(result.inserted_id)}
        raise HTTPException(status_code=404, detail="No matching reservation found")
        
    # 3. Mark as active by moving to today's date
    today_str = get_current_ist().strftime("%Y-%m-%d")
    await col.update_one(
        {"_id": booking["_id"]},
        {"$set": {"date": today_str, "status": "active", "bill_status": "none"}}
    )
    
    return {"message": "Booking activated successfully", "booking_id": str(booking["_id"])}
@router.patch("/bookings/{booking_id}/complete")
async def complete_booking(booking_id: str, current_admin = Depends(get_current_admin)):
    col = get_collection("bookings")
    try:
        obj_id = ObjectId(booking_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid booking ID")
        
    booking = await col.find_one({"_id": obj_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Allow completing both 'active' bookings and 'past'+'paid' bookings
    allowed_statuses = ["active", "past"]
    if booking.get("status") not in allowed_statuses:
        raise HTTPException(status_code=400, detail="Booking cannot be completed from its current state")
        
    await col.update_one(
        {"_id": obj_id},
        {"$set": {
            "status": "completed",
            "completed_at": get_current_ist()
        }}
    )

    # ── Record in Sales Collection ──
    sales_col = get_collection("Sales")
    now = get_current_ist()
    
    # Format dishes for the sales record
    dishes = booking.get("dishes", [])
    
    await sales_col.insert_one({
        "id": str(obj_id).upper()[-6:], # Short visible ID
        "booking_id": str(obj_id),
        "customer_id": booking.get("name", "Guest"), # Matching frontend field name
        "Date": now.strftime("%d-%m-%Y"),
        "Time": now.strftime("%H:%M:%S"),
        "items": dishes,
        "total_bill": float(booking.get("total_amount", 0.0)),
        "payment_method": "Online",
        "created_at": now
    })

    # ── Automatic Inventory Deduction ──
    try:
        inventory_col = get_collection("Inventory")
        recipes_col = get_collection("Recipes")
        
        for dish_entry in dishes:
            # Frontend might send string or object. backend/routers/user_router handles this conversion, 
            # so we check if dishes are already objects.
            if isinstance(dish_entry, str):
                dish_name = dish_entry
                dish_qty = 1
            else:
                dish_name = dish_entry.get("name")
                dish_qty = dish_entry.get("qty", 1)
            
            # Find all ingredients for this dish from the Recipes collection
            recipe_items = await recipes_col.find({"Item": dish_name}).to_list(length=100)
            
            for r in recipe_items:
                ingredient_name = r.get("Ingredient")
                r_qty = float(r.get("Qty", 0))
                r_unit = r.get("Unit", "")
                
                # Get the typical unit and threshold from the latest record of this ingredient
                last_inv = await inventory_col.find_one({"ingredient": ingredient_name}, sort=[("date_obj", -1)])
                if not last_inv:
                    # Fallback to older field name if date_obj is missing
                    last_inv = await inventory_col.find_one({"ingredient": ingredient_name}, sort=[("Date", -1)])
                
                inv_unit = last_inv.get("unit") if last_inv else r_unit
                threshold = last_inv.get("threshold") if last_inv else 0.0
                
                # Normalize qty for inventory deduction
                used_qty_final = normalize_qty(r_qty * dish_qty, r_unit, inv_unit)
                
                # Record the usage. stock is 0 because this is a usage-only record.
                await inventory_col.insert_one({
                    "ingredient": ingredient_name,
                    "stock": 0.0,
                    "used": round(used_qty_final, 3),
                    "unit": inv_unit,
                    "threshold": threshold,
                    "Date": now.strftime("%d-%m-%Y"),
                    "date_obj": now
                })
    except Exception as e:
        print(f"AUTOMATIC INVENTORY DEDUCTION ERROR: {e}")

    return {"message": "Order marked as completed and recorded in sales. Inventory updated."}
