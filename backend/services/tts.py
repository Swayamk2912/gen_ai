import os
import uuid
from typing import Optional


def synthesize_speech(text: str, out_dir: str, voice: Optional[str] = None, language: str = "en") -> str:
    os.makedirs(out_dir, exist_ok=True)
    filename = f"tts_{uuid.uuid4().hex}.mp3"
    out_path = os.path.join(out_dir, filename)
    
    print(f"TTS: Generating speech for text: '{text[:100]}...' in language: {language}")
    
    try:
        # Prefer gTTS for simplicity
        from gtts import gTTS
        
        # Map language codes to gTTS supported codes
        lang_map = {
            "en": "en",
            "hi": "hi",  # Hindi
            "es": "es",  # Spanish
            "fr": "fr",  # French
            "de": "de",  # German
            "it": "it",  # Italian
            "pt": "pt",  # Portuguese
            "ru": "ru",  # Russian
            "ja": "ja",  # Japanese
            "ko": "ko",  # Korean
            "zh": "zh",  # Chinese
            "ar": "ar",  # Arabic
            "nl": "nl",  # Dutch
            "sv": "sv",  # Swedish
            "no": "no",  # Norwegian
            "da": "da",  # Danish
            "fi": "fi",  # Finnish
            "pl": "pl",  # Polish
            "tr": "tr",  # Turkish
            "th": "th",  # Thai
            "vi": "vi"   # Vietnamese
        }
        
        gtts_lang = lang_map.get(language, "en")
        print(f"TTS: Using language code: {gtts_lang}")
        
        tts = gTTS(text=text, lang=gtts_lang)
        tts.save(out_path)
        
        # Check if file was created and has content
        if os.path.exists(out_path):
            file_size = os.path.getsize(out_path)
            print(f"TTS: Audio file created successfully: {out_path} (size: {file_size} bytes)")
            if file_size < 100:  # Very small file might be corrupted
                print(f"TTS: Warning - Audio file is very small ({file_size} bytes), might be corrupted")
        else:
            print(f"TTS: Error - Audio file was not created: {out_path}")
            
        return out_path
    except Exception as e:
        # Fallback: write a tiny silent mp3-like placeholder to avoid runtime errors
        print(f"TTS Error: {e}")
        print(f"TTS: Creating fallback audio file: {out_path}")
        with open(out_path, "wb") as f:
            f.write(b"ID3")
        return out_path


