"""
SPA static file server for EMS frontend (Windows container).
Serves the pre-built Vite dist/ directory with client-side routing fallback.
"""
import os
import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

DIST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")

app = FastAPI()

# html=True: serves index.html for unknown paths (SPA routing)
app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="static")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5173)
