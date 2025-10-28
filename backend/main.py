from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from backend.core.db import init_db

from backend.routes import presentation, narration, qa, translation, summary, root

app = FastAPI(title="GenAI Presentation Agent")

init_db()

# Path to your frontend folder
FRONTEND_DIR = os.path.join(os.getcwd(), "frontend")

# ✅ Serve frontend static assets
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

# ✅ Serve the main frontend app (index.html)
@app.get("/app")
async def serve_frontend():
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if not os.path.exists(index_path):
        return {"error": "Frontend index.html not found"}
    return FileResponse(index_path)

# ✅ Enable CORS for frontend-backend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Include all route modules
app.include_router(presentation.router,prefix="/presentation")
app.include_router(narration.router)
app.include_router(qa.router)
app.include_router(translation.router)
app.include_router(summary.router)
app.include_router(root.router)
