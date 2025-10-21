import os
from typing import List, Dict, Optional


def _format_slide_context(slide: Dict, slides: List[Dict]) -> str:
    title = slide.get("title") or "Untitled"
    content = slide.get("content") or ""
    outline = "\n".join([f"- {s.get('title','Untitled')}" for s in slides])
    return f"Presentation Outline:\n{outline}\n\nCurrent Slide: {title}\nContent:\n{content}"


def generate_slide_narration(slide: Dict, slides: List[Dict], tone: str = "formal", language: str = "en") -> str:
    # Placeholder offline narration; can be replaced by OpenAI/Ollama
    context = _format_slide_context(slide, slides)
    base = f"Here is a {tone} explanation of this slide. "
    body = slide.get("content") or "This slide contains bullet points that I will explain succinctly."
    narration = base + body
    
    # For Hindi, provide actual Hindi translation instead of just prefixing
    if language == "hi":
        narration = f"यह स्लाइड की {tone} व्याख्या है। " + (slide.get("content") or "इस स्लाइड में बुलेट पॉइंट्स हैं जिन्हें मैं संक्षेप में समझाऊंगा।")
    elif language != "en":
        narration = f"[{language}] " + narration
    return narration[:3000]


def answer_question(question: str, slide: Dict, slides: List[Dict], language: str = "en", tone: str = "formal", qa_logs: Optional[List[Dict]] = None) -> str:
    # Lightweight RAG: select top contexts from slides + prior Q&A
    try:
        import sys
        import os
        sys.path.append(os.path.dirname(os.path.dirname(__file__)))
        from rag import build_corpus, top_k_contexts
        qa_logs = qa_logs or []
        docs = build_corpus(slides, qa_logs)
        contexts = top_k_contexts(question, docs, k=3)
        ctx_text = "\n---\n".join([c[2] for c in contexts])
        title = slide.get("title") or "this slide"
        
        # Generate more intelligent answers based on question type
        question_lower = question.lower()
        
        if language == "hi":
            if any(word in question_lower for word in ['क्या', 'what', 'how', 'कैसे', 'why', 'क्यों']):
                answer = f"स्लाइड '{title}' के अनुसार: {ctx_text[:600]}"
            elif any(word in question_lower for word in ['explain', 'समझाएं', 'describe', 'वर्णन']):
                answer = f"यह स्लाइड '{title}' में विस्तार से समझाया गया है:\n{ctx_text[:600]}"
            else:
                answer = f"आपके प्रश्न के लिए स्लाइड '{title}' से जानकारी:\n{ctx_text[:600]}"
        else:
            if any(word in question_lower for word in ['what', 'how', 'why', 'when', 'where']):
                answer = f"Based on slide '{title}': {ctx_text[:600]}"
            elif any(word in question_lower for word in ['explain', 'describe', 'tell me about']):
                answer = f"This slide '{title}' explains:\n{ctx_text[:600]}"
            else:
                answer = f"From slide '{title}':\n{ctx_text[:600]}"
                
    except Exception as e:
        # Fallback when RAG fails
        print(f"RAG Error: {e}")
        title = slide.get("title") or "this slide"
        content = slide.get("content") or ""
        
        if language == "hi":
            answer = f"'{title}' के बारे में: {content[:400]}"
        else:
            answer = f"About '{title}': {content[:400]}"
    
    return answer[:3000]


