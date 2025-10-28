from fastapi import APIRouter, UploadFile, File, HTTPException
import os, uuid
from pydantic import BaseModel

from backend.services.ppt_parser import parse_presentation
from backend.core.db import save_presentation, save_slide, get_presentation, get_slides

router = APIRouter(tags=["Presentation"])

UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


class UploadResponse(BaseModel):
    presentation_id: str
    num_slides: int


@router.post("/upload")
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

    return {"presentation_id": pres_id, "num_slides": len(slides)}


@router.get("/{presentation_id}")
def get_presentation_meta(presentation_id: str):
    pres = get_presentation(presentation_id)
    slides = get_slides(presentation_id)
    if not pres:
        raise HTTPException(status_code=404, detail="Presentation not found")
    return {"presentation": pres, "slides": slides}


@router.post("/regenerate-slides-enhanced/{presentation_id}")
def regenerate_slides_enhanced(presentation_id: str):
    """Regenerate slide images with enhanced quality for an existing presentation"""
    try:
        from backend.services.ppt_parser import parse_presentation
        
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


@router.post("/regenerate-slides/{presentation_id}")
def regenerate_slides(presentation_id: str):
    """Regenerate slide images for an existing presentation"""
    try:
        from backend.services.ppt_parser import parse_presentation
        
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


@router.get("/debug/slides/{presentation_id}")
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
