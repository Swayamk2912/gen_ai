import os
import requests
import json
from typing import Dict, List, Optional, Tuple
import time
import hashlib


class TranslationService:
    """Multi-language translation service with multiple providers and fallbacks"""
        
    def __init__(self):
        self.providers = {
            'libretranslate': {
                'url': 'https://libretranslate.de/translate',
                'detect_url': 'https://libretranslate.de/detect',
                'languages_url': 'https://libretranslate.de/languages',
                'free': True,
                'rate_limit': 1000  # requests per hour
            },
            'google': {
                'url': 'https://translate.googleapis.com/translate_a/single',
                'free': True,
                'rate_limit': 100000  # requests per day
            },
            'mymemory': {
                'url': 'https://api.mymemory.translated.net/get',
                'free': True,
                'rate_limit': 1000  # requests per day
            }
        }
        
        # Language mappings
        self.language_codes = {
            'en': 'English',
            'hi': 'Hindi', 
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'it': 'Italian',
            'pt': 'Portuguese',
            'ru': 'Russian',
            'ja': 'Japanese',
            'ko': 'Korean',
            'zh': 'Chinese',
            'ar': 'Arabic',
            'nl': 'Dutch',
            'sv': 'Swedish',
            'no': 'Norwegian',
            'da': 'Danish',
            'fi': 'Finnish',
            'pl': 'Polish',
            'tr': 'Turkish',
            'th': 'Thai',
            'vi': 'Vietnamese'
        }
        
        # Cache for translations to avoid repeated API calls
        self.translation_cache = {}
        
    def detect_language(self, text: str) -> str:
        """Detect the language of the input text"""
        if not text or len(text.strip()) < 3:
            return 'en'
            
        # Simple heuristic detection for common languages
        text_lower = text.lower()
        
        # Hindi detection
        if any(char in text for char in 'अआइईउऊऋएऐओऔकखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह'):
            return 'hi'
            
        # Spanish detection
        spanish_words = ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'al', 'del', 'los', 'las']
        if any(word in text_lower for word in spanish_words):
            return 'es'
            
        # French detection
        french_words = ['le', 'la', 'de', 'et', 'à', 'un', 'une', 'est', 'que', 'pour', 'dans', 'ce', 'il', 'une', 'sur', 'avec', 'ne', 'se', 'pas', 'tout', 'mais', 'son', 'ses']
        if any(word in text_lower for word in french_words):
            return 'fr'
            
        # German detection
        german_words = ['der', 'die', 'das', 'und', 'in', 'den', 'von', 'zu', 'dem', 'mit', 'sich', 'des', 'auf', 'für', 'ist', 'im', 'an', 'als', 'auch', 'eine', 'ein', 'nach', 'wie', 'oder', 'aber', 'vor', 'aus', 'bei', 'nur', 'durch', 'um', 'am', 'zur', 'noch', 'mehr', 'wenn', 'über', 'so', 'sie', 'kann', 'alle', 'wird', 'sind', 'hat', 'haben', 'können', 'müssen', 'soll', 'will']
        if any(word in text_lower for word in german_words):
            return 'de'
            
        return 'en'  # Default to English
    
    def translate_text(self, text: str, target_lang: str, source_lang: str = 'auto') -> str:
        """Translate text to target language using available providers"""
        if not text or not text.strip():
            return text
            
        # Check cache first
        cache_key = hashlib.md5(f"{text}_{source_lang}_{target_lang}".encode()).hexdigest()
        if cache_key in self.translation_cache:
            return self.translation_cache[cache_key]
        
        # Auto-detect source language if needed
        if source_lang == 'auto':
            source_lang = self.detect_language(text)
            
        # If source and target are the same, return original text
        if source_lang == target_lang:
            return text
        
        # Try providers in order of preference
        translation = None
        
        # Try LibreTranslate first (free and reliable)
        try:
            translation = self._translate_libretranslate(text, source_lang, target_lang)
        except Exception as e:
            print(f"LibreTranslate failed: {e}")
        
        # Try Google Translate as fallback
        if not translation:
            try:
                translation = self._translate_google(text, source_lang, target_lang)
            except Exception as e:
                print(f"Google Translate failed: {e}")
        
        # Try MyMemory as last resort
        if not translation:
            try:
                translation = self._translate_mymemory(text, source_lang, target_lang)
            except Exception as e:
                print(f"MyMemory failed: {e}")
        
        # If all providers fail, return original text with language prefix
        if not translation:
            translation = f"[{target_lang}] {text}"
        
        # Cache the result
        self.translation_cache[cache_key] = translation
        return translation
    
    def _translate_libretranslate(self, text: str, source_lang: str, target_lang: str) -> str:
        """Translate using LibreTranslate API"""
        url = self.providers['libretranslate']['url']
        
        payload = {
            'q': text,
            'source': source_lang,
            'target': target_lang,
            'format': 'text'
        }
        
        response = requests.post(url, data=payload, timeout=10)
        response.raise_for_status()
        
        result = response.json()
        return result['translatedText']
    
    def _translate_google(self, text: str, source_lang: str, target_lang: str) -> str:
        """Translate using Google Translate API"""
        url = self.providers['google']['url']
        
        params = {
            'client': 'gtx',
            'sl': source_lang,
            'tl': target_lang,
            'dt': 't',
            'q': text
        }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        result = response.json()
        if result and len(result) > 0 and len(result[0]) > 0:
            return ''.join([item[0] for item in result[0] if item[0]])
        
        raise Exception("Invalid response from Google Translate")
    
    def _translate_mymemory(self, text: str, source_lang: str, target_lang: str) -> str:
        """Translate using MyMemory API"""
        url = self.providers['mymemory']['url']
        
        params = {
            'q': text,
            'langpair': f"{source_lang}|{target_lang}"
        }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        result = response.json()
        if result['responseStatus'] == 200:
            return result['responseData']['translatedText']
        
        raise Exception(f"MyMemory error: {result.get('responseDetails', 'Unknown error')}")
    
    def translate_slide_content(self, slide: Dict, target_lang: str) -> Dict:
        """Translate slide content while preserving structure"""
        translated_slide = slide.copy()
        
        # Translate title
        if slide.get('title'):
            translated_slide['title'] = self.translate_text(slide['title'], target_lang)
        
        # Translate content
        if slide.get('content'):
            translated_slide['content'] = self.translate_text(slide['content'], target_lang)
        
        return translated_slide
    
    def translate_narration_template(self, template: str, tone: str, target_lang: str) -> str:
        """Translate narration templates based on language and tone"""
        templates = {
            'en': {
                'formal': 'Here is a formal explanation of this slide.',
                'friendly': 'Let me explain this slide in a friendly way.',
                'academic': 'This slide presents the following academic content.',
                'humorous': 'Let me tell you about this slide with a bit of humor.'
            },
            'hi': {
                'formal': 'यह स्लाइड की औपचारिक व्याख्या यहाँ है।',
                'friendly': 'मैं इस स्लाइड को मित्रतापूर्ण तरीके से समझाता हूँ।',
                'academic': 'यह स्लाइड निम्नलिखित शैक्षणिक सामग्री प्रस्तुत करती है।',
                'humorous': 'मैं इस स्लाइड के बारे में थोड़े हास्य के साथ बताता हूँ।'
            },
            'es': {
                'formal': 'Aquí está una explicación formal de esta diapositiva.',
                'friendly': 'Déjame explicar esta diapositiva de manera amigable.',
                'academic': 'Esta diapositiva presenta el siguiente contenido académico.',
                'humorous': 'Déjame contarte sobre esta diapositiva con un poco de humor.'
            },
            'fr': {
                'formal': 'Voici une explication formelle de cette diapositive.',
                'friendly': 'Laissez-moi expliquer cette diapositive de manière amicale.',
                'academic': 'Cette diapositive présente le contenu académique suivant.',
                'humorous': 'Laissez-moi vous parler de cette diapositive avec un peu d\'humour.'
            },
            'de': {
                'formal': 'Hier ist eine formelle Erklärung dieser Folie.',
                'friendly': 'Lassen Sie mich diese Folie auf freundliche Weise erklären.',
                'academic': 'Diese Folie präsentiert den folgenden akademischen Inhalt.',
                'humorous': 'Lassen Sie mich Ihnen mit etwas Humor über diese Folie erzählen.'
            }
        }
        
        # Get template for target language
        if target_lang in templates:
            return templates[target_lang].get(tone, templates[target_lang]['formal'])
        else:
            # Translate English template to target language
            english_template = templates['en'].get(tone, templates['en']['formal'])
            return self.translate_text(english_template, target_lang)
    
    def get_supported_languages(self) -> Dict[str, str]:
        """Get list of supported languages"""
        return self.language_codes.copy()
    
    def is_language_supported(self, lang_code: str) -> bool:
        """Check if language is supported"""
        return lang_code in self.language_codes


# Global translation service instance
translation_service = TranslationService()
