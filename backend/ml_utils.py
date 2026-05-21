import os
import numpy as np

MODEL_PATH = os.path.join(os.path.dirname(__file__), "final_model", "yolov8m_seg_model.pt")


# Load model globally to avoid repeated loading
_model = None

def get_model():
    global _model
    if _model is None:
        if os.path.exists(MODEL_PATH):
            from ultralytics import YOLO
            _model = YOLO(MODEL_PATH)
        else:
            print(f"Warning: YOLOv8 model not found at {MODEL_PATH}")
    return _model

def calculate_waste_percentage(image_path: str) -> float:
    """
    Uses YOLOv8 segmentation to calculate food waste percentage.
    Formula: Area(Food) / Area(Plate)
    If no plate is detected, falls back to Area(Food) / Total Area with a scaling factor.
    """
    model = get_model()
    if not model:
        return 0.0

    results = model.predict(image_path, task='segment', conf=0.25, verbose=False)
    if not results:
        return 0.0

    res = results[0]
    total_food_area = 0
    total_plate_area = 0
    img_area = res.orig_shape[0] * res.orig_shape[1]

    if res.masks is not None:
        masks = res.masks.data.cpu().numpy() # [N, H, W]
        classes = res.boxes.cls.cpu().numpy() # [N]
        names = model.names
        
        print(f"\n--- YOLOv8 Inference Results for {os.path.basename(image_path)} ---")
        print(f"Detected {len(classes)} objects.")

        for i, cls_id in enumerate(classes):
            cls_name = names.get(int(cls_id), f"Class {cls_id}")
            mask_area = np.sum(masks[i] > 0)
            print(f"  - [{i}] {cls_name}: Area {mask_area} pixels")
            
            # Class 0: food, Class 1: plate
            if cls_id == 0:
                total_food_area += mask_area
            elif cls_id == 1:
                total_plate_area += mask_area

    if total_plate_area > 0 or total_food_area > 0:
        # User defined: (Food Area) / (Food Area + Plate Area)
        # This assumes Plate Area detected is the "visible" plate, and Food is covering the rest.
        denominator = total_food_area + total_plate_area
        waste_pct = total_food_area / denominator
        print(f"Result: Food {total_food_area} / (Food {total_food_area} + Plate {total_plate_area}) = {waste_pct:.4f}")
    else:
        # Fallback: Food relative to image size (e.g. assuming plate is 60% of image)
        waste_pct = total_food_area / (img_area * 0.6)
        print(f"Result: No plate detected. Food / (Estimated Plate Area) = {total_food_area} / {img_area * 0.6}")

    print(f"Final Waste Percentage: {waste_pct:.2%}")
    print("------------------------------------------------------------------\n")

    # Cap at 1.0
    return min(float(waste_pct), 1.0)
