# Coastal Microplastic Hotspot Detection System

An interactive data-driven system for analyzing coastal regions and identifying potential microplastic hotspot patterns using satellite-derived data, spatial analysis, and clustering.

## 🌊 Overview

The **Coastal Microplastic Hotspot Detection System** aims to support coastal environmental monitoring by analyzing satellite-derived datasets and identifying spatial patterns that may indicate potential microplastic hotspot regions.

The project integrates a Python-based analysis backend with an interactive web dashboard, allowing users to explore coastal monitoring data, visualize spatial patterns, and inspect hotspot analysis results.

## 🚀 Live Demo

- **Frontend Dashboard:** https://microplastic-hotspot-system-f.onrender.com
- **Backend API:** https://microplastic-hotspot-system.onrender.com

## ✨ Features

- Interactive coastal monitoring dashboard
- Satellite-derived dataset analysis
- Coastal hotspot identification
- DBSCAN-based spatial clustering
- Interactive map-based visualization
- Analysis results and statistical summaries
- Frontend and backend deployed on Render
- API-based communication between dashboard and analysis engine

## 🛰️ Data & Methodology

The system uses NASA/CYGNSS-related processed data for coastal monitoring and analysis.

The analysis workflow involves:

1. Loading and preparing the processed dataset.
2. Extracting relevant geographic and analysis variables.
3. Processing the data for spatial analysis.
4. Applying DBSCAN clustering to identify spatial groupings.
5. Identifying potential hotspot regions based on the analysis.
6. Displaying results through the interactive dashboard.

### Clustering

The system uses **DBSCAN (Density-Based Spatial Clustering of Applications with Noise)** to group spatially related data points based on density.

DBSCAN can identify clusters without requiring the number of clusters to be specified beforehand and can classify isolated observations as noise.

## 🛠️ Tech Stack

| Component | Technology |
|---|---|
| Frontend | React.js |
| Frontend Build Tool | Vite |
| Backend | Python |
| API Framework | FastAPI |
| API Server | Uvicorn |
| Data Analysis | NumPy, Pandas |
| Clustering | Scikit-learn / DBSCAN |
| Geospatial Visualization | Interactive map visualization |
| Dataset | NASA/CYGNSS-derived processed data |
| Version Control | Git & GitHub |
| Deployment | Render |

## 🏗️ Architecture

```text
             ┌────────────────────────────┐
             │       User / Browser      │
             └─────────────┬──────────────┘
                           │
                           ▼
             ┌────────────────────────────┐
             │     React + Vite UI        │
             │   Interactive Dashboard     │
             └─────────────┬──────────────┘
                           │ API Requests
                           ▼
             ┌────────────────────────────┐
             │       FastAPI Backend      │
             │      Analysis Endpoint     │
             └─────────────┬──────────────┘
                           │
                           ▼
             ┌────────────────────────────┐
             │ Data Processing & Analysis │
             │    DBSCAN Clustering       │
             └─────────────┬──────────────┘
                           │
                           ▼
             ┌────────────────────────────┐
             │ Hotspot Results & Spatial  │
             │      Visualization         │
             └────────────────────────────┘
```

## 📁 Project Structure

```text
microplastic-hotspot-system/
│
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── ...analysis modules and data files
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

## ⚙️ Local Installation & Setup

### Prerequisites

- Python 3.10+ (use a version compatible with the backend dependencies)
- Node.js and npm
- Git

### 1. Clone the repository

```bash
git clone https://github.com/abhaybajpaii/microplastic-hotspot-system.git
cd microplastic-hotspot-system
```

### 2. Run the Backend

Open a terminal:

```bash
cd backend
```

Create and activate a virtual environment.

**Windows:**

```powershell
python -m venv venv
venv\Scripts\activate
```

Install the dependencies:

```bash
pip install -r requirements.txt
```

Start the FastAPI server:

```bash
uvicorn main:app --reload --port 8000
```

Backend runs locally at:

```text
http://localhost:8000
```

API documentation:

```text
http://localhost:8000/docs
```

### 3. Run the Frontend

Open a separate terminal:

```bash
cd frontend
npm install
```

Create a `.env` file inside the frontend directory and configure:

```env
VITE_API_URL=http://localhost:8000
```

Start the frontend:

```bash
npm run dev
```

The Vite development server will provide a local URL, usually:

```text
http://localhost:5173
```

Open the URL shown in your terminal.

## 🌐 Deployment

The project is deployed using Render.

| Service | Hosting | Purpose |
|---|---|---|
| Frontend | Render Static Site | Dashboard and user interface |
| Backend | Render Web Service | API and data analysis |

The frontend communicates with the backend through the configured API URL. The backend CORS configuration allows requests from the deployed frontend origin.

## 🔮 Future Improvements

- Integrate additional coastal datasets
- Improve hotspot analysis and validation
- Add temporal analysis to monitor changes over time
- Improve spatial resolution and data coverage
- Add more analytical and statistical visualizations
- Enhance performance for larger datasets

## ⚠️ Disclaimer

This project is intended for research, educational, and environmental data-analysis purposes. The identified regions represent potential hotspot patterns derived from the available dataset and analysis methodology. They should not be interpreted as direct confirmation of microplastic concentrations without independent field measurements and validation.

## 👨‍💻 Author

**Abhay Bajpai**

- GitHub: [@abhaybajpaii](https://github.com/abhaybajpaii)

---

If you find this project interesting, feel free to explore the repository or provide feedback.
