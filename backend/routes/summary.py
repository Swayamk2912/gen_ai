from fastapi import APIRouter, HTTPException
from backend.core.db import get_presentation, get_slides, get_qa_logs
from backend.services.ai import generate_summary_report

router = APIRouter(tags=["Summary"])

@router.get("/summary/{presentation_id}")
def summary(presentation_id: str):
    pres = get_presentation(presentation_id)
    slides = get_slides(presentation_id)
    qas = get_qa_logs(presentation_id)
    topics = [s["title"] for s in slides if s.get("title")]
    return {"title": pres["filename"], "num_slides": len(slides), "topics": topics, "qa_count": len(qas)}

@router.get("/ai-summary/{presentation_id}")
def ai_summary(presentation_id: str, language: str = "en"):
    try:
        pres = get_presentation(presentation_id)
        slides = get_slides(presentation_id)
        qas = get_qa_logs(presentation_id)
        if not pres:
            raise HTTPException(status_code=404, detail="Presentation not found")
        return generate_summary_report(pres, slides, qas, language)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summary failed: {str(e)}")
