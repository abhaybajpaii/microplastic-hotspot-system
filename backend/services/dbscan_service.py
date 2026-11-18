import numpy as np
from sklearn.cluster import DBSCAN


def detect_hotspots(data, eps_km=2.0, min_samples=3):
    """
    Detect geographical contamination hotspots using DBSCAN.

    Parameters:
        data: A pandas DataFrame containing latitude and longitude columns.
        eps_km: Maximum distance between nearby points in kilometres.
        min_samples: Minimum number of points required to form a hotspot.
    """

    coordinates = data[["latitude", "longitude"]].to_numpy()

    # Convert latitude and longitude from degrees to radians
    coordinates_rad = np.radians(coordinates)

    # Earth's approximate radius in kilometres
    earth_radius_km = 6371.0088

    # Convert the distance from kilometres to radians
    eps_rad = eps_km / earth_radius_km

    # Create and train the DBSCAN model
    model = DBSCAN(
        eps=eps_rad,
        min_samples=min_samples,
        metric="haversine"
    )

    # Generate a cluster label for every location
    labels = model.fit_predict(coordinates_rad)

    # Create a copy so the original data is not modified
    result = data.copy()

    # Add the detected cluster labels
    result["cluster"] = labels

    # Count unique hotspots, excluding -1 because -1 means noise
    unique_clusters = set(labels)
    hotspot_count = len(unique_clusters - {-1})

    # Count noise points
    noise_count = list(labels).count(-1)

    return result, hotspot_count, noise_count