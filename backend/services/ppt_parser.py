from typing import List, Dict

def parse_presentation(path: str) -> List[Dict]:
    try:
        from pptx import Presentation
    except Exception:
        # Fallback if python-pptx not installed: return a single dummy slide
        return [{"title": "Slide 1", "content": "(python-pptx not installed)"}]

    prs = Presentation(path)
    slides_data: List[Dict] = []
    for slide in prs.slides:
        title = None
        texts: List[str] = []
        for shape in slide.shapes:
            if hasattr(shape, "has_text_frame") and shape.has_text_frame:
                content = []
                for paragraph in shape.text_frame.paragraphs:
                    content.append(paragraph.text.strip())
                full = "\n".join([t for t in content if t])
                if full:
                    texts.append(full)
            if getattr(shape, "name", "").lower().startswith("title") and hasattr(shape, "text"):
                if shape.text:
                    title = shape.text.strip()
        # Heuristic title selection
        if not title and texts:
            title = texts[0].split("\n")[0][:120]
        body = "\n".join(texts[1:] if title and texts and texts[0].startswith(title) else texts)
        slides_data.append({
            "title": title or "",
            "content": body,
        })
    return slides_data


