from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from backend.core.db import get_slides, get_qa_logs, save_qa_log
from backend.services.ai import answer_question

router = APIRouter(tags=["Q&A"])


class QARequest(BaseModel):
    presentation_id: str
    slide_index: int
    question: str
    language: Optional[str] = "en"
    tone: Optional[str] = "formal"


@router.post("/qa")
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
