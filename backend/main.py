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
from .services.ai import generate_slide_narration, answer_question, generate_summary_report
from .services.tts import synthesize_speech
from .services.translation import translation_service
from .db import init_db, save_presentation, save_slide, get_presentation, get_slides, save_qa_log, get_qa_logs, update_slide_audio


UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
AUDIO_DIR = os.path.join(os.getcwd(), "audio")
SLIDES_DIR = os.path.join(os.getcwd(), "slides")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(AUDIO_DIR, exist_ok=True)
os.makedirs(SLIDES_DIR, exist_ok=True)


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


class LanguageDetectionRequest(BaseModel):
    text: str


class TranslationRequest(BaseModel):
    text: str
    target_language: str
    source_language: Optional[str] = "auto"


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
    print(f"Narrate request: presentation_id={req.presentation_id}, slide_index={req.slide_index}, tone={req.tone}, language={req.language}")
    
    slides = get_slides(req.presentation_id)
    if req.slide_index < 0 or req.slide_index >= len(slides):
        raise HTTPException(status_code=404, detail="Slide not found")

    slide = slides[req.slide_index]
    print(f"Processing slide: {slide.get('title', 'Untitled')}")
    
    narration_data = generate_slide_narration(slide, slides, tone=req.tone, language=req.language)
    narration_text = narration_data["full_text"]
    print(f"Generated narration text: '{narration_text[:100]}...'")
    
    audio_path = synthesize_speech(narration_text, AUDIO_DIR, voice=req.voice, language=req.language)
    print(f"Audio path: {audio_path}")
    
    update_slide_audio(req.presentation_id, req.slide_index, narration_text, audio_path)
    
    audio_url = f"/audio/{os.path.basename(audio_path)}"
    print(f"Returning audio_url: {audio_url}")
    
    return {
        "text": narration_text, 
        "audio_url": audio_url,
        "segments": narration_data["segments"]
    }


@app.get("/audio/{filename}")
def get_audio(filename: str):
    path = os.path.join(AUDIO_DIR, filename)
    print(f"Audio request: {filename} -> {path}")
    
    if not os.path.exists(path):
        print(f"Audio file not found: {path}")
        raise HTTPException(status_code=404, detail="Audio not found")
    
    file_size = os.path.getsize(path)
    print(f"Audio file found: {path} (size: {file_size} bytes)")
    
    return FileResponse(path, media_type="audio/mpeg")


@app.get("/slides/{filename}")
def get_slide_image(filename: str):
    path = os.path.join(SLIDES_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Slide image not found")
    
    # Determine media type based on file extension
    if filename.endswith('.html'):
        return FileResponse(path, media_type="text/html")
    elif filename.endswith('.txt'):
        return FileResponse(path, media_type="text/plain")
    else:
        return FileResponse(path, media_type="image/png")


@app.get("/debug/slides/{presentation_id}")
def debug_slides(presentation_id: str):
    """Debug endpoint to check slide data"""
    try:
        pres = get_presentation(presentation_id)
        slides = get_slides(presentation_id)
        
        if not pres:
            raise HTTPException(status_code=404, detail="Presentation not found")
        
        # Check if slides directory exists and list files
        slides_dir = os.path.join(os.getcwd(), "slides")
        slide_files = []
        if os.path.exists(slides_dir):
            slide_files = os.listdir(slides_dir)
        
        # Check if slide files exist
        slide_file_status = []
        for slide in slides:
            if slide.get('image_path'):
                file_path = os.path.join(slides_dir, slide['image_path'].split('/')[-1])
                slide_file_status.append({
                    'slide_index': slide.get('slide_number', 'unknown'),
                    'image_path': slide['image_path'],
                    'file_exists': os.path.exists(file_path),
                    'file_size': os.path.getsize(file_path) if os.path.exists(file_path) else 0
                })
        
        return {
            "presentation": pres,
            "slides": slides,
            "slides_directory": slides_dir,
            "slide_files": slide_files,
            "slides_dir_exists": os.path.exists(slides_dir),
            "slide_file_status": slide_file_status
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Debug failed: {str(e)}")


@app.post("/regenerate-slides-enhanced/{presentation_id}")
def regenerate_slides_enhanced(presentation_id: str):
    """Regenerate slide images with enhanced quality for an existing presentation"""
    try:
        from .services.ppt_parser import parse_presentation
        
        # Get presentation info
        pres = get_presentation(presentation_id)
        if not pres:
            raise HTTPException(status_code=404, detail="Presentation not found")
        
        # Find the original file
        upload_dir = os.path.join(os.getcwd(), "uploads")
        original_files = [f for f in os.listdir(upload_dir) if f.startswith(presentation_id)]
        
        if not original_files:
            raise HTTPException(status_code=404, detail="Original presentation file not found")
        
        original_file = os.path.join(upload_dir, original_files[0])
        
        # Re-parse the presentation to regenerate slide images with enhanced quality
        slides_data = parse_presentation(original_file)
        
        # Update database with new slide data
        for idx, slide in enumerate(slides_data):
            save_slide(presentation_id, idx, slide)
        
        return {
            "message": "Slides regenerated with enhanced quality successfully",
            "slides_count": len(slides_data),
            "slides": slides_data
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Enhanced regeneration failed: {str(e)}")


@app.post("/regenerate-slides/{presentation_id}")
def regenerate_slides(presentation_id: str):
    """Regenerate slide images for an existing presentation"""
    try:
        from .services.ppt_parser import parse_presentation
        
        # Get presentation info
        pres = get_presentation(presentation_id)
        if not pres:
            raise HTTPException(status_code=404, detail="Presentation not found")
        
        # Find the original file
        upload_dir = os.path.join(os.getcwd(), "uploads")
        original_files = [f for f in os.listdir(upload_dir) if f.startswith(presentation_id)]
        
        if not original_files:
            raise HTTPException(status_code=404, detail="Original presentation file not found")
        
        original_file = os.path.join(upload_dir, original_files[0])
        
        # Re-parse the presentation to regenerate slide images
        slides_data = parse_presentation(original_file)
        
        # Update database with new slide data
        for idx, slide in enumerate(slides_data):
            save_slide(presentation_id, idx, slide)
        
        return {
            "message": "Slides regenerated successfully",
            "slides_count": len(slides_data),
            "slides": slides_data
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Regeneration failed: {str(e)}")


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


@app.get("/ai-summary/{presentation_id}")
def ai_summary_report(presentation_id: str, language: str = "en"):
    """Generate comprehensive AI summary report with key topics, Q&A analysis, and insights"""
    try:
        pres = get_presentation(presentation_id)
        slides = get_slides(presentation_id)
        qa_logs = get_qa_logs(presentation_id)
        
        if not pres:
            raise HTTPException(status_code=404, detail="Presentation not found")
        
        # Generate AI summary report
        summary_report = generate_summary_report(pres, slides, qa_logs, language)
        
        return summary_report
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate summary report: {str(e)}")


@app.get("/languages")
def get_supported_languages():
    """Get list of supported languages for translation"""
    return {
        "languages": translation_service.get_supported_languages(),
        "default": "en"
    }


@app.post("/detect-language")
def detect_language(req: LanguageDetectionRequest):
    """Detect the language of input text"""
    detected_lang = translation_service.detect_language(req.text)
    return {
        "language": detected_lang,
        "language_name": translation_service.get_supported_languages().get(detected_lang, "Unknown"),
        "confidence": "medium"  # Placeholder for future confidence scoring
    }


@app.post("/translate")
def translate_text(req: TranslationRequest):
    """Translate text to target language"""
    try:
        translated_text = translation_service.translate_text(
            req.text, 
            req.target_language, 
            req.source_language
        )
        return {
            "original_text": req.text,
            "translated_text": translated_text,
            "source_language": req.source_language,
            "target_language": req.target_language
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")


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
