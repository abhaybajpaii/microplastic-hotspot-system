from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd

from services.dbscan_service import detect_hotspots


app = FastAPI(
    title="Coastal Microplastic Hotspot Detection API",
    description="Backend API for detecting coastal microplastic contamination hotspots using DBSCAN.",
    version="2.0.0"
)


# Allow the React frontend to communicate with the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://microplastic-hotspot-system-f.onrender.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Get the absolute path of the backend folder
BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "data" / "sample_microplastic_data.csv"


@app.get("/")
def home():
    return {
        "message": "Coastal Microplastic Hotspot Detection API is running successfully!",
        "coverage": "India Coastal Monitoring Network"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "system": "online"
    }


@app.get("/analyze")
def analyze_data():

    # Load sensor data
    data = pd.read_csv(DATA_FILE)

    # Run DBSCAN hotspot detection
    result, hotspot_count, noise_count = detect_hotspots(
        data,
        eps_km=50.0,
        min_samples=3
    )

    # Convert results into JSON format
    return {
        "total_sensor_readings": len(result),
        "hotspots_detected": hotspot_count,
        "noise_points": noise_count,
        "data": result.to_dict(orient="records")
    }