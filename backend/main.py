from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
import uuid
import os
import io

from .services.ppt_parser import parse_presentation
from .services.ai import generate_slide_narration, answer_question
from .services.tts import synthesize_speech
from .db import init_db, save_presentation, save_slide, get_presentation, get_slides, save_qa_log, get_qa_logs, update_slide_audio


UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
AUDIO_DIR = os.path.join(os.getcwd(), "audio")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(AUDIO_DIR, exist_ok=True)


class UploadResponse(BaseModel):
    presentation_id: str
    num_slides: int


class NarrationRequest(BaseModel):
    presentation_id: str
    slide_index: int
    voice: Optional[str] = None
    language: Optional[str] = "en"
    tone: Optional[str] = "formal"


class QARequest(BaseModel):
    presentation_id: str
    slide_index: int
    question: str
    language: Optional[str] = "en"
    tone: Optional[str] = "formal"


app = FastAPI(title="GenAI Presentation Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="frontend"), name="static")


@app.on_event("startup")
def on_startup():
    init_db()


@app.post("/upload", response_model=UploadResponse)
async def upload_presentation(file: UploadFile = File(...)):
    if not file.filename.lower().endswith((".pptx", ".ppt")):
        raise HTTPException(status_code=400, detail="Only .pptx or .ppt files are supported")

    pres_id = str(uuid.uuid4())
    dest_path = os.path.join(UPLOAD_DIR, f"{pres_id}_{file.filename}")
    with open(dest_path, "wb") as f:
        f.write(await file.read())

    slides = parse_presentation(dest_path)
    save_presentation(pres_id, file.filename)
    for idx, slide in enumerate(slides):
        save_slide(pres_id, idx, slide)

    return UploadResponse(presentation_id=pres_id, num_slides=len(slides))


@app.get("/presentation/{presentation_id}")
def get_presentation_meta(presentation_id: str):
    pres = get_presentation(presentation_id)
    slides = get_slides(presentation_id)
    return {"presentation": pres, "slides": slides}


@app.post("/narrate")
def narrate_slide(req: NarrationRequest):
    slides = get_slides(req.presentation_id)
    if req.slide_index < 0 or req.slide_index >= len(slides):
        raise HTTPException(status_code=404, detail="Slide not found")

    slide = slides[req.slide_index]
    narration_text = generate_slide_narration(slide, slides, tone=req.tone, language=req.language)
    audio_path = synthesize_speech(narration_text, AUDIO_DIR, voice=req.voice, language=req.language)
    update_slide_audio(req.presentation_id, req.slide_index, narration_text, audio_path)
    return {"text": narration_text, "audio_url": f"/audio/{os.path.basename(audio_path)}"}


@app.get("/audio/{filename}")
def get_audio(filename: str):
    path = os.path.join(AUDIO_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Audio not found")
    return FileResponse(path, media_type="audio/mpeg")


@app.post("/qa")
def qa(req: QARequest):
    slides = get_slides(req.presentation_id)
    if req.slide_index < 0 or req.slide_index >= len(slides):
        raise HTTPException(status_code=404, detail="Slide not found")

    slide = slides[req.slide_index]
    qa_logs = get_qa_logs(req.presentation_id)
    answer = answer_question(
        req.question,
        slide,
        slides,
        language=req.language,
        tone=req.tone,
        qa_logs=qa_logs,
    )
    save_qa_log(req.presentation_id, req.slide_index, req.question, answer)
    return {"answer": answer}


@app.get("/summary/{presentation_id}")
def summary(presentation_id: str):
    pres = get_presentation(presentation_id)
    slides = get_slides(presentation_id)
    qas = get_qa_logs(presentation_id)
    # Simple summary baseline
    topics = [s["title"] for s in slides if s.get("title")]
    return {"title": pres["filename"], "num_slides": len(slides), "topics": topics, "qa_count": len(qas)}


@app.get("/")
def root():
    return RedirectResponse(url="/app")


@app.get("/app")
def serve_app():
    index_path = os.path.join(os.getcwd(), "frontend", "index.html")
    if not os.path.exists(index_path):
        raise HTTPException(status_code=404, detail="Frontend not found")
    return FileResponse(index_path, media_type="text/html")


@app.get("/sample-pdf")
def sample_pdf():
    try:
        # Lazy import so reportlab remains optional until endpoint is called
        from reportlab.lib.pagesizes import LETTER
        from reportlab.pdfgen import canvas
        from reportlab.lib.units import inch
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ReportLab not available: {e}")

    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=LETTER)
    width, height = LETTER

    # Page 1
    c.setTitle("GenAI Sample PDF")
    c.setFont("Helvetica-Bold", 20)
    c.drawString(1 * inch, height - 1.5 * inch, "GenAI Presentation Agent")
    c.setFont("Helvetica", 12)
    body = (
        "This is a generated sample PDF to verify PDF delivery from the backend.\n"
        "Use this as a template to render your own content, summaries, or Q&A logs."
    )
    for i, line in enumerate(body.split("\n")):
        c.drawString(1 * inch, height - (2.0 + i * 0.3) * inch, line)

    c.setFont("Helvetica-Oblique", 10)
    c.drawString(1 * inch, 0.75 * inch, "Page 1")
    c.showPage()

    # Page 2
    c.setFont("Helvetica-Bold", 16)
    c.drawString(1 * inch, height - 1.25 * inch, "Details")
    c.setFont("Helvetica", 12)
    lines = [
        "- Generated with ReportLab",
        "- Served by FastAPI",
        "- Suited for exporting presentation summaries",
        "- Customize fonts, tables, charts as needed",
    ]
    for i, line in enumerate(lines):
        c.drawString(1 * inch, height - (1.75 + i * 0.3) * inch, line)

    c.setFont("Helvetica-Oblique", 10)
    c.drawString(1 * inch, 0.75 * inch, "Page 2")
    c.showPage()

    c.save()
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/pdf", headers={
        "Content-Disposition": "inline; filename=sample.pdf"
    })
