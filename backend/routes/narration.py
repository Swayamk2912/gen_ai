from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from backend.core.db import get_slides, update_slide_audio
from backend.services.ai import generate_slide_narration
from backend.services.tts import synthesize_speech
from pydantic import BaseModel
import os

router = APIRouter(tags=["Narration"])

AUDIO_DIR = os.path.join(os.getcwd(), "audio")
SLIDES_DIR = os.path.join(os.getcwd(), "slides") # Added SLIDES_DIR
os.makedirs(AUDIO_DIR, exist_ok=True)
os.makedirs(SLIDES_DIR, exist_ok=True) # Ensure SLIDES_DIR exists

class NarrationRequest(BaseModel):
    presentation_id: str
    slide_index: int
    voice: str | None = None
    language: str = "en"
    tone: str = "formal"

@router.post("/narrate")
def narrate_slide(req: NarrationRequest):
    slides = get_slides(req.presentation_id)
    if req.slide_index >= len(slides):
        raise HTTPException(status_code=404, detail="Slide not found")

    slide = slides[req.slide_index]
    narration_data = generate_slide_narration(slide, slides, tone=req.tone, language=req.language)
    narration_text = narration_data["full_text"]
    audio_path = synthesize_speech(narration_text, AUDIO_DIR, voice=req.voice, language=req.language)

    update_slide_audio(req.presentation_id, req.slide_index, narration_text, audio_path)
    
    audio_url = f"/audio/{os.path.basename(audio_path)}"
    print(f"Returning audio_url: {audio_url}")
    
    return {
        "text": narration_text, 
        "audio_url": audio_url,
        "segments": narration_data["segments"]
    }


@router.get("/audio/{filename}")
def get_audio(filename: str):
    path = os.path.join(AUDIO_DIR, filename)
    print(f"Audio request: {filename} -> {path}")
    
    if not os.path.exists(path):
        print(f"Audio file not found: {path}")
        raise HTTPException(status_code=404, detail="Audio not found")
    
    file_size = os.path.getsize(path)
    print(f"Audio file found: {path} (size: {file_size} bytes)")
    
    return FileResponse(path, media_type="audio/mpeg")


@router.get("/slides/{filename}")
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
