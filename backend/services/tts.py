import os
import uuid
from typing import Optional


def synthesize_speech(text: str, out_dir: str, voice: Optional[str] = None, language: str = "en") -> str:
    os.makedirs(out_dir, exist_ok=True)
    filename = f"tts_{uuid.uuid4().hex}.mp3"
    out_path = os.path.join(out_dir, filename)
    try:
        # Prefer gTTS for simplicity
        from gtts import gTTS
        
        # Map language codes to gTTS supported codes
        lang_map = {
            "en": "en",
            "hi": "hi",  # Hindi
            "es": "es"   # Spanish
        }
        
        gtts_lang = lang_map.get(language, "en")
        tts = gTTS(text=text, lang=gtts_lang)
        tts.save(out_path)
        return out_path
    except Exception as e:
        # Fallback: write a tiny silent mp3-like placeholder to avoid runtime errors
        print(f"TTS Error: {e}")
        with open(out_path, "wb") as f:
            f.write(b"ID3")
        return out_path


