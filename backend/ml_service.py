import os
import pickle
import pandas as pd
import xgboost as xgb
from datetime import datetime, timedelta
from database import get_collection

MODEL_PATH = os.path.join(os.path.dirname(__file__), "final_model", "sales_model.pkl")
FEATURES_PATH = os.path.join(os.path.dirname(__file__), "final_model", "features.pkl")

from utils import get_current_ist

async def run_forecast_pipeline():
    """
    Generate forecasts for the next 7 days with advanced feature engineering (Lags, Rolling Means).
    """
    if not os.path.exists(MODEL_PATH):
        print(f"[ML Service] Model not found at {MODEL_PATH}")
        return []

    try:
        # 1. Daily Throttling
        meta_col = get_collection("system_metadata")
        today_dt = get_current_ist()
        today_str = today_dt.strftime("%Y-%m-%d")
        
        last_run = await meta_col.find_one({"key": "last_ml_run"})
        if last_run and last_run.get("date") == today_str:
            print(f"[ML Service] Already run for today. Skipping.")
            return []

        # 2. Fetch Historical Sales for Lags (Last 14 days)
        sales_col = get_collection("Sales")
        history_cursor = sales_col.find({}).sort("_id", -1).limit(60) # Get enough to be sure
        history_raw = await history_cursor.to_list(length=60)
        
        # Parse into a daily revenue dictionary
        history_dict = {}
        for s in history_raw:
            try:
                # 'Date' is DD-MM-YYYY
                d_parts = s["Date"].split("-")
                iso_date = f"{d_parts[2]}-{d_parts[1]}-{d_parts[0]}"
                history_dict[iso_date] = s.get("total_bill", 0)
            except:
                continue
        
        # 3. Model Loading
        with open(MODEL_PATH, 'rb') as f:
            model = pickle.load(f)
            
        forecast_results = []
        
        # Load feature names dynamically from features.pkl
        if os.path.exists(FEATURES_PATH):
            import joblib
            try:
                feature_names = list(joblib.load(FEATURES_PATH))
            except Exception as e:
                print(f"[ML Service] Error loading features.pkl: {e}. Falling back to hardcoded list.")
                feature_names = [
                    'is_holiday', 'day', 'month', 'day_of_week_num', 'lag_1', 'lag_2', 'lag_7', 
                    'rolling_mean_3', 'rolling_mean_7', 'is_weekend', 
                    'day_of_week_Monday', 'day_of_week_Saturday', 'day_of_week_Sunday', 
                    'day_of_week_Thursday', 'day_of_week_Tuesday', 'day_of_week_Wednesday', 
                    'weather_Rainy', 'weather_Sunny', 'temperature_27.5', 'temperature_32.5'
                ]
        else:
            feature_names = [
                'is_holiday', 'day', 'month', 'day_of_week_num', 'lag_1', 'lag_2', 'lag_7', 
                'rolling_mean_3', 'rolling_mean_7', 'is_weekend', 
                'day_of_week_Monday', 'day_of_week_Saturday', 'day_of_week_Sunday', 
                'day_of_week_Thursday', 'day_of_week_Tuesday', 'day_of_week_Wednesday', 
                'weather_Rainy', 'weather_Sunny', 'temperature_27.5', 'temperature_32.5'
            ]

        # We'll build a rolling window of recent revenue
        # Start with historical values up to today
        recent_revenue = []
        for i in range(14, -1, -1): # Last 15 days including today
            d = (today_dt - timedelta(days=i)).strftime("%Y-%m-%d")
            recent_revenue.append(history_dict.get(d, 1200)) # Default to 1200 if no data
            
        for i in range(1, 8): # Predict next 7 days
            forecast_date = today_dt + timedelta(days=i)
            
            # Basic Features
            is_holiday = 1 if forecast_date.weekday() >= 5 else 0
            day = forecast_date.day
            month = forecast_date.month
            dow_num = forecast_date.weekday() # 0=Monday, 6=Sunday
            is_weekend = 1 if dow_num >= 5 else 0
            
            # Time-Series Features (using recent_revenue window)
            # recent_revenue[-1] is "today" (relative to forecast loop)
            lag_1 = recent_revenue[-1]
            lag_2 = recent_revenue[-2] if len(recent_revenue) >= 2 else lag_1
            lag_7 = recent_revenue[-7] if len(recent_revenue) >= 7 else lag_1
            
            rolling_3 = sum(recent_revenue[-3:]) / 3
            rolling_7 = sum(recent_revenue[-7:]) / 7
            
            # One-Hot Encoding Day of Week
            day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            current_day_name = day_names[dow_num]
            
            input_row = {
                'is_holiday': int(is_holiday),
                'day': int(day),
                'month': int(month),
                'day_of_week_num': int(dow_num),
                'lag_1': float(lag_1),
                'lag_2': float(lag_2),
                'lag_7': float(lag_7),
                'rolling_mean_3': float(rolling_3),
                'rolling_mean_7': float(rolling_7),
                'is_weekend': int(is_weekend),
                'day_of_week_Monday': 1 if current_day_name == "Monday" else 0,
                'day_of_week_Saturday': 1 if current_day_name == "Saturday" else 0,
                'day_of_week_Sunday': 1 if current_day_name == "Sunday" else 0,
                'day_of_week_Thursday': 1 if current_day_name == "Thursday" else 0,
                'day_of_week_Tuesday': 1 if current_day_name == "Tuesday" else 0,
                'day_of_week_Wednesday': 1 if current_day_name == "Wednesday" else 0,
                'weather_Rainy': 0,
                'weather_Sunny': 1,
                'temperature_27.5': 0,
                'temperature_32.5': 1
            }
            
            # Create DF and predict
            features_df = pd.DataFrame([input_row])[feature_names]
            prediction = model.predict(features_df)[0]
            
            # Add prediction to our rolling window for the next iteration's lags
            recent_revenue.append(float(prediction))
            
            forecast_results.append({
                "date": forecast_date.strftime("%Y-%m-%d"),
                "predicted_revenue": round(float(prediction), 2),
                "predicted_inventory": round(float(prediction) / 400, 2)
            })
            
        # 4. Save to MongoDB
        col_sales = get_collection("sales_forecast")
        col_inv = get_collection("inventory_forecast")
        
        await col_sales.delete_many({})
        await col_inv.delete_many({})
        
        if forecast_results:
            await col_sales.insert_many([{"date": r["date"], "revenue": r["predicted_revenue"]} for r in forecast_results])
            
            inv_items = ["Tomato", "Chicken", "Olive Oil", "Pasta", "Cheese"]
            inv_docs = []
            for r in forecast_results:
                for item in inv_items:
                    item_factor = 1.0 if item == "Tomato" else 0.8 if item == "Chicken" else 0.4
                    unit = "L" if item == "Olive Oil" else "ml" if "Sauce" in item else "kg"
                    inv_docs.append({
                        "date": r["date"],
                        "ingredient": item,
                        "predicted_requirement": round(r["predicted_inventory"] * item_factor, 2),
                        "unit": unit
                    })
            if inv_docs:
                await col_inv.insert_many(inv_docs)
                    
        # 5. Update Metadata
        await meta_col.update_one(
            {"key": "last_ml_run"},
            {"$set": {"date": today_str, "timestamp": get_current_ist()}},
            upsert=True
        )
        
        print(f"[ML Service] Successfully generated ML forecast with full feature context for {today_str}.")
        return forecast_results
    except Exception as e:
        print(f"[ML Service] Critical Error in ML Pipeline: {e}")
        import traceback
        traceback.print_exc()
        return []
