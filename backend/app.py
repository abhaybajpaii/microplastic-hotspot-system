from flask import Flask, jsonify
from flask_cors import CORS
import os
import pandas as pd


# ----------------------------------------
# APP SETUP
# ----------------------------------------

app = Flask(__name__)

# Allow the React frontend to access this API
CORS(app)


# ----------------------------------------
# FILE PATH
# ----------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

HOTSPOT_FILE = os.path.join(
    BASE_DIR,
    "data",
    "microplastic_hotspots.csv"
)


# ----------------------------------------
# LOAD HOTSPOT DATA
# ----------------------------------------

def load_hotspot_data():

    if not os.path.exists(HOTSPOT_FILE):
        return None

    return pd.read_csv(HOTSPOT_FILE)


# ----------------------------------------
# HOME ROUTE
# ----------------------------------------

@app.route("/")
def home():

    return jsonify({
        "message": "Microplastic Hotspot API is running!",
        "status": "success"
    })


# ----------------------------------------
# ALL HOTSPOTS
# ----------------------------------------

@app.route("/api/hotspots")
def get_hotspots():

    df = load_hotspot_data()

    if df is None:

        return jsonify({
            "error": "Hotspot data file not found."
        }), 404

    # Convert DataFrame into JSON-compatible records
    hotspots = df.to_dict(
        orient="records"
    )

    return jsonify({
        "total": len(hotspots),
        "data": hotspots
    })


# ----------------------------------------
# TOP HOTSPOTS
# ----------------------------------------

@app.route("/api/hotspots/top")
def get_top_hotspots():

    df = load_hotspot_data()

    if df is None:

        return jsonify({
            "error": "Hotspot data file not found."
        }), 404

    top_hotspots = (
        df.sort_values(
            by="mp_concentration",
            ascending=False
        )
        .head(20)
    )

    return jsonify({
        "total": len(top_hotspots),
        "data": top_hotspots.to_dict(
            orient="records"
        )
    })


# ----------------------------------------
# HOTSPOT STATISTICS
# ----------------------------------------

@app.route("/api/hotspots/statistics")
def get_statistics():

    df = load_hotspot_data()

    if df is None:

        return jsonify({
            "error": "Hotspot data file not found."
        }), 404

    level_counts = (
        df["hotspot_level"]
        .value_counts()
        .to_dict()
    )

    return jsonify({
        "total_data_points": len(df),

        "maximum_concentration": float(
            df["mp_concentration"].max()
        ),

        "average_concentration": float(
            df["mp_concentration"].mean()
        ),

        "hotspot_distribution": level_counts
    })


# ----------------------------------------
# RUN SERVER
# ----------------------------------------

if __name__ == "__main__":

    print("\nMicroplastic Hotspot API starting...")
    print("API URL: http://127.0.0.1:5000")

    app.run(
        debug=True,
        host="127.0.0.1",
        port=5000
    )