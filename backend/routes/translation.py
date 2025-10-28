from fastapi import APIRouter, HTTPException
from backend.services.translation import translation_service
from pydantic import BaseModel

router = APIRouter(tags=["Translation"])

class LanguageDetectionRequest(BaseModel):
    text: str

class TranslationRequest(BaseModel):
    text: str
    target_language: str
    source_language: str = "auto"

@router.get("/languages")
def get_languages():
    return {"languages": translation_service.get_supported_languages(), "default": "en"}

@router.post("/detect-language")
def detect_language(req: LanguageDetectionRequest):
    """Detect the language of input text"""
    detected_lang = translation_service.detect_language(req.text)
    return {
        "language": detected_lang,
        "language_name": translation_service.get_supported_languages().get(detected_lang, "Unknown"),
        "confidence": "medium"  # Placeholder for future confidence scoring
    }


@router.post("/translate")
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
