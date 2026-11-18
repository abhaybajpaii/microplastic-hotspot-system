import os
import pandas as pd


# ----------------------------------------
# FILE PATHS
# ----------------------------------------

BASE_DIR = os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))
)

INPUT_FILE = os.path.join(
    BASE_DIR,
    "data",
    "processed_microplastic_data.csv"
)

OUTPUT_FILE = os.path.join(
    BASE_DIR,
    "data",
    "microplastic_hotspots.csv"
)


# ----------------------------------------
# LOAD PROCESSED NASA DATA
# ----------------------------------------

print("Loading processed NASA microplastic data...")

df = pd.read_csv(INPUT_FILE)

print(f"Total data points loaded: {len(df)}")


# ----------------------------------------
# DATA CLEANING
# ----------------------------------------

df = df.dropna(
    subset=[
        "latitude",
        "longitude",
        "mp_concentration"
    ]
)

print(f"Valid data points: {len(df)}")


# ----------------------------------------
# CALCULATE HOTSPOT THRESHOLDS
# ----------------------------------------

# Instead of using arbitrary concentration values,
# we calculate thresholds based on the actual dataset.

moderate_threshold = df["mp_concentration"].quantile(0.50)
high_threshold = df["mp_concentration"].quantile(0.75)
severe_threshold = df["mp_concentration"].quantile(0.90)

print("\nHOTSPOT THRESHOLDS:")
print(f"Moderate: {moderate_threshold}")
print(f"High: {high_threshold}")
print(f"Severe: {severe_threshold}")


# ----------------------------------------
# CLASSIFY HOTSPOTS
# ----------------------------------------

def classify_hotspot(concentration):

    if concentration >= severe_threshold:
        return "Severe"

    elif concentration >= high_threshold:
        return "High"

    elif concentration >= moderate_threshold:
        return "Moderate"

    else:
        return "Low"


df["hotspot_level"] = df[
    "mp_concentration"
].apply(classify_hotspot)


# ----------------------------------------
# CREATE HOTSPOT SCORE
# ----------------------------------------

max_concentration = df[
    "mp_concentration"
].max()

if max_concentration > 0:

    df["hotspot_score"] = (
        df["mp_concentration"]
        / max_concentration
        * 100
    ).round(2)

else:

    df["hotspot_score"] = 0


# ----------------------------------------
# DISPLAY RESULTS
# ----------------------------------------

print("\nHOTSPOT DISTRIBUTION:")

print(
    df["hotspot_level"]
    .value_counts()
)


print("\nTOP 10 MICROPLASTIC HOTSPOTS:")

top_hotspots = df.sort_values(
    by="mp_concentration",
    ascending=False
).head(10)

print(
    top_hotspots[
        [
            "latitude",
            "longitude",
            "mp_concentration",
            "hotspot_level",
            "hotspot_score"
        ]
    ]
)


# ----------------------------------------
# SAVE RESULTS
# ----------------------------------------

df.to_csv(
    OUTPUT_FILE,
    index=False
)

print(
    f"\nHOTSPOT DATA SUCCESSFULLY SAVED TO:\n"
    f"{OUTPUT_FILE}"
)