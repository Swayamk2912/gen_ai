import os
from typing import List, Dict, Optional
from .translation import translation_service


def _format_slide_context(slide: Dict, slides: List[Dict]) -> str:
    title = slide.get("title") or "Untitled"
    content = slide.get("content") or ""
    outline = "\n".join([f"- {s.get('title','Untitled')}" for s in slides])
    return f"Presentation Outline:\n{outline}\n\nCurrent Slide: {title}\nContent:\n{content}"


def generate_slide_narration(slide: Dict, slides: List[Dict], tone: str = "formal", language: str = "en") -> Dict:
    """Generate slide narration with proper page-by-page synchronization"""
    
    # Extract structured slide content
    slide_structure = _analyze_slide_structure(slide, language)
    
    # Generate structured narration based on slide elements
    narration_parts = _generate_structured_narration(slide_structure, tone, language)
    
    # Create segments with proper timing for each slide element
    segments = _create_synchronized_segments(narration_parts, slide_structure, language)
    
    # Combine all narration parts
    full_narration = " ".join([part["text"] for part in narration_parts])
    
    return {
        "full_text": full_narration[:3000],
        "segments": segments,
        "language": language,
        "tone": tone,
        "slide_structure": slide_structure
    }


def _analyze_slide_structure(slide: Dict, language: str = "en") -> Dict:
    """Analyze slide content and extract structured elements for narration"""
    import re
    
    title = slide.get("title", "").strip()
    content = slide.get("content", "").strip()
    
    # If target language is not English, translate the content
    if language != "en":
        title = translation_service.translate_text(title, language) if title else ""
        content = translation_service.translate_text(content, language) if content else ""
    
    # Extract different types of content
    lines = [line.strip() for line in content.split('\n') if line.strip()]
    
    # Categorize content elements
    elements = {
        "title": title,
        "bullet_points": [],
        "paragraphs": [],
        "headings": [],
        "lists": []
    }
    
    for line in lines:
        # Check for bullet points
        if any(line.startswith(prefix) for prefix in ['•', '-', '*', '◦', '▪', '▫']):
            clean_text = re.sub(r'^[•\-*◦▪▫\s]+', '', line).strip()
            if clean_text:
                elements["bullet_points"].append(clean_text)
        # Check for headings (short lines, often in caps or title case)
        elif len(line) < 80 and (line.isupper() or line.istitle()):
            elements["headings"].append(line)
        # Check for numbered lists
        elif re.match(r'^\d+[\.\)]\s+', line):
            clean_text = re.sub(r'^\d+[\.\)]\s+', '', line).strip()
            if clean_text:
                elements["lists"].append(clean_text)
        # Check for short lines that should be treated as bullet points even without symbols
        elif len(line.split()) <= 8 and not line.endswith('.') and not line.endswith(':'):
            elements["bullet_points"].append(line)
        # Regular paragraphs (longer content)
        else:
            elements["paragraphs"].append(line)
    
    return elements

def _generate_structured_narration(slide_structure: Dict, tone: str, language: str) -> List[Dict]:
    """Generate structured narration parts based on slide elements"""
    
    narration_parts = []
    
    # Generate title narration
    if slide_structure["title"]:
        title_narration = _generate_title_narration(slide_structure["title"], tone, language)
        narration_parts.append({
            "type": "title",
            "text": title_narration,
            "element": slide_structure["title"]
        })
    
    # Generate heading narrations
    for heading in slide_structure["headings"]:
        heading_narration = _generate_heading_narration(heading, tone, language)
        narration_parts.append({
            "type": "heading",
            "text": heading_narration,
            "element": heading
        })
    
    # Generate bullet point narrations
    for i, bullet in enumerate(slide_structure["bullet_points"]):
        bullet_narration = _generate_bullet_narration(bullet, i + 1, len(slide_structure["bullet_points"]), tone, language)
        narration_parts.append({
            "type": "bullet",
            "text": bullet_narration,
            "element": bullet,
            "index": i + 1
        })
    
    # Generate list narrations
    for i, list_item in enumerate(slide_structure["lists"]):
        list_narration = _generate_list_narration(list_item, i + 1, len(slide_structure["lists"]), tone, language)
        narration_parts.append({
            "type": "list",
            "text": list_narration,
            "element": list_item,
            "index": i + 1
        })
    
    # Generate paragraph narrations
    for paragraph in slide_structure["paragraphs"]:
        paragraph_narration = _generate_paragraph_narration(paragraph, tone, language)
        narration_parts.append({
            "type": "paragraph",
            "text": paragraph_narration,
            "element": paragraph
        })
    
    return narration_parts

def _generate_title_narration(title: str, tone: str, language: str) -> str:
    """Generate narration for slide title"""
    templates = {
        'en': {
            'formal': f"{title}.",
            'friendly': f"{title}.",
            'academic': f"{title}.",
            'humorous': f"{title}!"
        },
        'hi': {
            'formal': f"{title}।",
            'friendly': f"{title}।",
            'academic': f"{title}।",
            'humorous': f"{title}!"
        },
        'es': {
            'formal': f"{title}.",
            'friendly': f"{title}.",
            'academic': f"{title}.",
            'humorous': f"{title}!"
        }
    }
    
    if language in templates:
        return templates[language].get(tone, templates[language]['formal'])
    else:
        english_template = templates['en'].get(tone, templates['en']['formal'])
        return translation_service.translate_text(english_template, language)

def _generate_heading_narration(heading: str, tone: str, language: str) -> str:
    """Generate narration for slide headings"""
    templates = {
        'en': {
            'formal': f"{heading}.",
            'friendly': f"{heading}.",
            'academic': f"{heading}.",
            'humorous': f"{heading}!"
        }
    }
    
    if language in templates:
        return templates[language].get(tone, templates[language]['formal'])
    else:
        english_template = templates['en'].get(tone, templates['en']['formal'])
        return translation_service.translate_text(english_template, language)

def _generate_bullet_narration(bullet: str, index: int, total: int, tone: str, language: str) -> str:
    """Generate narration for bullet points with proper sequencing"""
    templates = {
        'en': {
            'formal': f"Point {index}: {bullet}.",
            'friendly': f"Here's point {index}: {bullet}.",
            'academic': f"Item {index} states: {bullet}.",
            'humorous': f"Bullet {index} says: {bullet}!"
        }
    }
    
    if language in templates:
        base_template = templates[language].get(tone, templates[language]['formal'])
    else:
        english_template = templates['en'].get(tone, templates['en']['formal'])
        base_template = translation_service.translate_text(english_template, language)
    
    return base_template.format(index=index, bullet=bullet)

def _generate_list_narration(list_item: str, index: int, total: int, tone: str, language: str) -> str:
    """Generate narration for numbered list items"""
    templates = {
        'en': {
            'formal': f"Number {index}: {list_item}.",
            'friendly': f"Here's number {index}: {list_item}.",
            'academic': f"Step {index}: {list_item}.",
            'humorous': f"Item {index} is: {list_item}!"
        }
    }
    
    if language in templates:
        base_template = templates[language].get(tone, templates[language]['formal'])
    else:
        english_template = templates['en'].get(tone, templates['en']['formal'])
        base_template = translation_service.translate_text(english_template, language)
    
    return base_template.format(index=index, item=list_item)

def _generate_paragraph_narration(paragraph: str, tone: str, language: str) -> str:
    """Generate narration for paragraph content"""
    
    # For all paragraphs, just state them directly without "let me explain"
    templates = {
        'en': {
            'formal': f"{paragraph}.",
            'friendly': f"{paragraph}.",
            'academic': f"{paragraph}.",
            'humorous': f"{paragraph}!"
        }
    }
    
    if language in templates:
        return templates[language].get(tone, templates[language]['formal'])
    else:
        english_template = templates['en'].get(tone, templates['en']['formal'])
        return translation_service.translate_text(english_template, language)

def _create_synchronized_segments(narration_parts: List[Dict], slide_structure: Dict, language: str) -> List[Dict]:
    """Create synchronized segments with proper timing for each slide element"""
    
    segments = []
    current_time = 0
    
    # Language-specific timing adjustments
    words_per_minute = {
        'en': 150, 'hi': 140, 'es': 160, 'fr': 155, 'de': 145, 
        'it': 160, 'pt': 155, 'ru': 140, 'ja': 130, 'ko': 140,
        'zh': 130, 'ar': 135, 'nl': 150, 'sv': 150, 'no': 150,
        'da': 150, 'fi': 140, 'pl': 140, 'tr': 145, 'th': 130, 'vi': 140
    }
    
    wpm = words_per_minute.get(language, 150)
    seconds_per_word = 60 / wpm
    
    for part in narration_parts:
        text = part["text"]
        word_count = len(text.split())
        
        # Adjust duration based on content type
        base_duration = max(1, word_count * seconds_per_word)
        
        # Add extra time for different content types
        if part["type"] == "title":
            duration = base_duration + 1.0  # Pause after title
        elif part["type"] == "heading":
            duration = base_duration + 0.5  # Brief pause after heading
        elif part["type"] == "bullet":
            duration = base_duration + 0.3  # Short pause between bullets
        elif part["type"] == "list":
            duration = base_duration + 0.4  # Medium pause between list items
        else:
            duration = base_duration
        
        segments.append({
            "text": text,
            "start_time": current_time,
            "duration": duration,
            "end_time": current_time + duration,
            "highlight_text": part["element"],
            "type": part["type"],
            "language": language
        })
        
        current_time += duration
    
    return segments

def _split_narration_into_segments(narration: str, slide_content: str, language: str = "en") -> List[Dict]:
    """Split narration into segments with timing estimates for synchronization"""
    import re
    
    # Split by sentences and bullet points
    sentences = re.split(r'[.!?]+', narration)
    sentences = [s.strip() for s in sentences if s.strip()]
    
    # Extract bullet points from slide content for better sync
    bullet_points = []
    if slide_content:
        lines = slide_content.split('\n')
        for line in lines:
            line = line.strip()
            if line and (line.startswith('-') or line.startswith('•') or line.startswith('*')):
                bullet_points.append(line[1:].strip())
    
    segments = []
    current_time = 0
    
    # Adjust timing based on language (some languages speak faster/slower)
    words_per_minute = {
        'en': 150, 'hi': 140, 'es': 160, 'fr': 155, 'de': 145, 
        'it': 160, 'pt': 155, 'ru': 140, 'ja': 130, 'ko': 140,
        'zh': 130, 'ar': 135, 'nl': 150, 'sv': 150, 'no': 150,
        'da': 150, 'fi': 140, 'pl': 140, 'tr': 145, 'th': 130, 'vi': 140
    }
    
    wpm = words_per_minute.get(language, 150)
    seconds_per_word = 60 / wpm
    
    for i, sentence in enumerate(sentences):
        if not sentence:
            continue
            
        # Estimate duration based on word count
        word_count = len(sentence.split())
        duration = max(1, word_count * seconds_per_word)
        
        # Try to match with slide content for highlighting
        highlight_text = ""
        if bullet_points and i < len(bullet_points):
            highlight_text = bullet_points[i]
        elif slide_content:
            # Find the most relevant part of slide content for this sentence
            words_in_sentence = set(sentence.lower().split())
            slide_lines = slide_content.split('\n')
            best_match = ""
            best_score = 0
            
            for line in slide_lines:
                line_words = set(line.lower().split())
                common_words = words_in_sentence.intersection(line_words)
                if len(common_words) > best_score:
                    best_score = len(common_words)
                    best_match = line.strip()
            
            if best_match:
                highlight_text = best_match
        
        segments.append({
            "text": sentence,
            "start_time": current_time,
            "duration": duration,
            "highlight_text": highlight_text,
            "end_time": current_time + duration,
            "language": language
        })
        
        current_time += duration
    
    return segments


def answer_question(question: str, slide: Dict, slides: List[Dict], language: str = "en", tone: str = "formal", qa_logs: Optional[List[Dict]] = None) -> str:
    """Answer questions with proper multi-language support"""
    
    # Detect question language if not specified
    detected_lang = translation_service.detect_language(question)
    
    # Translate question to English for processing if needed
    if detected_lang != "en":
        question_en = translation_service.translate_text(question, "en", detected_lang)
    else:
        question_en = question
    
    try:
        import sys
        import os
        sys.path.append(os.path.dirname(os.path.dirname(__file__)))
        from rag import build_corpus, top_k_contexts
        qa_logs = qa_logs or []
        docs = build_corpus(slides, qa_logs)
        contexts = top_k_contexts(question_en, docs, k=3)
        ctx_text = "\n---\n".join([c[2] for c in contexts])
        title = slide.get("title") or "this slide"
        
        # Generate answer templates based on language and question type
        answer_templates = _get_answer_templates(language, tone)
        
        # Determine question type
        question_type = _classify_question_type(question_en.lower())
        
        # Generate base answer
        if question_type == "what":
            base_answer = answer_templates["what"].format(title=title, content=ctx_text[:600])
        elif question_type == "how":
            base_answer = answer_templates["how"].format(title=title, content=ctx_text[:600])
        elif question_type == "why":
            base_answer = answer_templates["why"].format(title=title, content=ctx_text[:600])
        elif question_type == "explain":
            base_answer = answer_templates["explain"].format(title=title, content=ctx_text[:600])
        else:
            base_answer = answer_templates["general"].format(title=title, content=ctx_text[:600])
        
        # If question was in different language, ensure answer is in target language
        if detected_lang != language:
            base_answer = translation_service.translate_text(base_answer, language, "en")
        
        return base_answer[:3000]
                
    except Exception as e:
        # Fallback when RAG fails
        print(f"RAG Error: {e}")
        title = slide.get("title") or "this slide"
        content = slide.get("content") or ""
        
        # Generate fallback answer
        fallback_answer = _generate_fallback_answer(title, content, language, tone)
        return fallback_answer[:3000]


def _get_answer_templates(language: str, tone: str) -> Dict[str, str]:
    """Get answer templates for different languages and tones"""
    
    templates = {
        'en': {
            'what': "Based on slide '{title}': {content}",
            'how': "According to slide '{title}', here's how it works: {content}",
            'why': "Slide '{title}' explains why: {content}",
            'explain': "This slide '{title}' explains:\n{content}",
            'general': "From slide '{title}':\n{content}"
        },
        'hi': {
            'what': "स्लाइड '{title}' के अनुसार: {content}",
            'how': "स्लाइड '{title}' के अनुसार, यह कैसे काम करता है: {content}",
            'why': "स्लाइड '{title}' बताती है कि क्यों: {content}",
            'explain': "यह स्लाइड '{title}' समझाती है:\n{content}",
            'general': "स्लाइड '{title}' से:\n{content}"
        },
        'es': {
            'what': "Según la diapositiva '{title}': {content}",
            'how': "Según la diapositiva '{title}', así es como funciona: {content}",
            'why': "La diapositiva '{title}' explica por qué: {content}",
            'explain': "Esta diapositiva '{title}' explica:\n{content}",
            'general': "De la diapositiva '{title}':\n{content}"
        },
        'fr': {
            'what': "Selon la diapositive '{title}': {content}",
            'how': "Selon la diapositive '{title}', voici comment cela fonctionne: {content}",
            'why': "La diapositive '{title}' explique pourquoi: {content}",
            'explain': "Cette diapositive '{title}' explique:\n{content}",
            'general': "De la diapositive '{title}':\n{content}"
        },
        'de': {
            'what': "Basierend auf Folie '{title}': {content}",
            'how': "Laut Folie '{title}' funktioniert es so: {content}",
            'why': "Folie '{title}' erklärt warum: {content}",
            'explain': "Diese Folie '{title}' erklärt:\n{content}",
            'general': "Von Folie '{title}':\n{content}"
        }
    }
    
    # If language not in templates, translate English templates
    if language not in templates:
        english_templates = templates['en']
        translated_templates = {}
        for key, template in english_templates.items():
            translated_templates[key] = translation_service.translate_text(template, language)
        return translated_templates
    
    return templates[language]


def _classify_question_type(question: str) -> str:
    """Classify question type based on keywords"""
    question_lower = question.lower()
    
    if any(word in question_lower for word in ['what', 'क्या', 'qué', 'que', 'was', 'qu\'est-ce']):
        return "what"
    elif any(word in question_lower for word in ['how', 'कैसे', 'cómo', 'comment', 'wie']):
        return "how"
    elif any(word in question_lower for word in ['why', 'क्यों', 'por qué', 'pourquoi', 'warum']):
        return "why"
    elif any(word in question_lower for word in ['explain', 'describe', 'समझाएं', 'वर्णन', 'explicar', 'décrire', 'erklären']):
        return "explain"
    else:
        return "general"


def _generate_fallback_answer(title: str, content: str, language: str, tone: str) -> str:
    """Generate fallback answer when RAG fails"""
    
    fallback_templates = {
        'en': f"About '{title}': {content[:400]}",
        'hi': f"'{title}' के बारे में: {content[:400]}",
        'es': f"Acerca de '{title}': {content[:400]}",
        'fr': f"À propos de '{title}': {content[:400]}",
        'de': f"Über '{title}': {content[:400]}"
    }
    
    if language in fallback_templates:
        return fallback_templates[language]
    else:
        # Translate English template to target language
        english_template = fallback_templates['en']
        return translation_service.translate_text(english_template, language)


def generate_summary_report(presentation: Dict, slides: List[Dict], qa_logs: List[Dict], language: str = "en") -> Dict:
    """Generate comprehensive AI summary report with key topics, Q&A analysis, and insights"""
    
    # Extract key topics from slides
    key_topics = _extract_key_topics(slides, language)
    
    # Analyze Q&A patterns
    qa_analysis = _analyze_qa_patterns(qa_logs, language)
    
    # Generate overall insights
    insights = _generate_insights(presentation, slides, qa_logs, language)
    
    # Create executive summary
    executive_summary = _create_executive_summary(presentation, key_topics, qa_analysis, insights, language)
    
    return {
        "executive_summary": executive_summary,
        "key_topics": key_topics,
        "qa_analysis": qa_analysis,
        "insights": insights,
        "presentation_metadata": {
            "title": presentation.get("filename", "Untitled"),
            "total_slides": len(slides),
            "total_questions": len(qa_logs),
            "language": language
        }
    }


def _extract_key_topics(slides: List[Dict], language: str) -> List[Dict]:
    """Extract and categorize key topics from slides"""
    
    # Extract titles and content for topic analysis
    slide_titles = [slide.get("title", f"Slide {i+1}") for i, slide in enumerate(slides)]
    slide_contents = [slide.get("content", "") for slide in slides]
    
    # Group similar topics
    topics = []
    for i, (title, content) in enumerate(zip(slide_titles, slide_contents)):
        if title and title != f"Slide {i+1}":
            # Extract keywords from content
            keywords = _extract_keywords(content)
            topics.append({
                "title": title,
                "slide_index": i,
                "keywords": keywords,
                "content_preview": content[:200] + "..." if len(content) > 200 else content,
                "importance": _calculate_topic_importance(title, content, keywords)
            })
    
    # Sort by importance
    topics.sort(key=lambda x: x["importance"], reverse=True)
    
    return topics[:10]  # Return top 10 topics


def _extract_keywords(content: str) -> List[str]:
    """Extract important keywords from content"""
    import re
    
    # Remove common stop words
    stop_words = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
        'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
        'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'
    }
    
    # Extract words (3+ characters, alphanumeric)
    words = re.findall(r'\b[a-zA-Z]{3,}\b', content.lower())
    
    # Filter out stop words and count frequency
    word_freq = {}
    for word in words:
        if word not in stop_words:
            word_freq[word] = word_freq.get(word, 0) + 1
    
    # Return top 5 keywords
    sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
    return [word for word, freq in sorted_words[:5]]


def _calculate_topic_importance(title: str, content: str, keywords: List[str]) -> float:
    """Calculate importance score for a topic"""
    score = 0
    
    # Title importance (longer, more descriptive titles are more important)
    score += len(title.split()) * 0.5
    
    # Content length (more content = more important)
    score += min(len(content.split()) * 0.1, 10)
    
    # Keyword density
    score += len(keywords) * 0.3
    
    # Special indicators
    if any(word in title.lower() for word in ['introduction', 'overview', 'summary', 'conclusion']):
        score += 2
    if any(word in title.lower() for word in ['key', 'important', 'main', 'primary']):
        score += 1.5
    
    return score


def _analyze_qa_patterns(qa_logs: List[Dict], language: str) -> Dict:
    """Analyze Q&A patterns and generate insights"""
    
    if not qa_logs:
        return {
            "total_questions": 0,
            "question_types": {},
            "common_themes": [],
            "engagement_level": "No questions asked",
            "insights": []
        }
    
    # Analyze question types
    question_types = {}
    themes = []
    
    for qa in qa_logs:
        question = qa.get("question", "").lower()
        
        # Classify question type
        if any(word in question for word in ['what', 'क्या', 'qué', 'que', 'was']):
            question_types['what'] = question_types.get('what', 0) + 1
        elif any(word in question for word in ['how', 'कैसे', 'cómo', 'comment', 'wie']):
            question_types['how'] = question_types.get('how', 0) + 1
        elif any(word in question for word in ['why', 'क्यों', 'por qué', 'pourquoi', 'warum']):
            question_types['why'] = question_types.get('why', 0) + 1
        elif any(word in question for word in ['explain', 'describe', 'समझाएं', 'explicar', 'décrire']):
            question_types['explain'] = question_types.get('explain', 0) + 1
        else:
            question_types['other'] = question_types.get('other', 0) + 1
        
        # Extract themes from questions
        words = question.split()
        themes.extend([word for word in words if len(word) > 4])
    
    # Find common themes
    theme_freq = {}
    for theme in themes:
        theme_freq[theme] = theme_freq.get(theme, 0) + 1
    
    common_themes = sorted(theme_freq.items(), key=lambda x: x[1], reverse=True)[:5]
    
    # Determine engagement level
    total_questions = len(qa_logs)
    if total_questions == 0:
        engagement_level = "No questions asked"
    elif total_questions < 3:
        engagement_level = "Low engagement"
    elif total_questions < 8:
        engagement_level = "Moderate engagement"
    else:
        engagement_level = "High engagement"
    
    # Generate insights
    insights = []
    if question_types.get('what', 0) > question_types.get('how', 0):
        insights.append("Audience focused on understanding concepts rather than processes")
    if question_types.get('why', 0) > 0:
        insights.append("Audience showed interest in reasoning and explanations")
    if total_questions > 5:
        insights.append("High audience engagement indicates strong interest in the topic")
    
    return {
        "total_questions": total_questions,
        "question_types": question_types,
        "common_themes": [theme for theme, freq in common_themes],
        "engagement_level": engagement_level,
        "insights": insights
    }


def _generate_insights(presentation: Dict, slides: List[Dict], qa_logs: List[Dict], language: str) -> List[Dict]:
    """Generate overall insights about the presentation"""
    
    insights = []
    
    # Content analysis
    total_content_length = sum(len(slide.get("content", "")) for slide in slides)
    avg_content_per_slide = total_content_length / len(slides) if slides else 0
    
    if avg_content_per_slide > 200:
        insights.append({
            "type": "content",
            "title": "Content Density",
            "description": "Presentation has high content density per slide",
            "recommendation": "Consider breaking complex slides into multiple simpler ones"
        })
    elif avg_content_per_slide < 50:
        insights.append({
            "type": "content",
            "title": "Content Density",
            "description": "Presentation has low content density per slide",
            "recommendation": "Consider adding more detailed information to slides"
        })
    
    # Structure analysis
    if len(slides) > 15:
        insights.append({
            "type": "structure",
            "title": "Presentation Length",
            "description": f"Long presentation with {len(slides)} slides",
            "recommendation": "Consider splitting into multiple sessions or creating a summary version"
        })
    elif len(slides) < 5:
        insights.append({
            "type": "structure",
            "title": "Presentation Length",
            "description": f"Short presentation with {len(slides)} slides",
            "recommendation": "Consider adding more supporting slides or examples"
        })
    
    # Q&A analysis
    if qa_logs:
        avg_questions_per_slide = len(qa_logs) / len(slides)
        if avg_questions_per_slide > 1:
            insights.append({
                "type": "engagement",
                "title": "High Engagement",
                "description": f"Average of {avg_questions_per_slide:.1f} questions per slide",
                "recommendation": "Audience is highly engaged - consider extending Q&A time"
            })
        elif avg_questions_per_slide < 0.2:
            insights.append({
                "type": "engagement",
                "title": "Low Engagement",
                "description": f"Average of {avg_questions_per_slide:.1f} questions per slide",
                "recommendation": "Consider adding interactive elements or discussion prompts"
            })
    else:
        insights.append({
            "type": "engagement",
            "title": "No Questions",
            "description": "No questions were asked during the presentation",
            "recommendation": "Consider adding interactive elements or discussion prompts"
        })
    
    # Topic coverage analysis
    topics_with_content = sum(1 for slide in slides if slide.get("content", "").strip())
    if topics_with_content < len(slides) * 0.8:
        insights.append({
            "type": "content",
            "title": "Content Coverage",
            "description": f"Only {topics_with_content}/{len(slides)} slides have substantial content",
            "recommendation": "Review slides for content completeness"
        })
    
    return insights


def _create_executive_summary(presentation: Dict, key_topics: List[Dict], qa_analysis: Dict, insights: List[Dict], language: str) -> str:
    """Create executive summary of the presentation"""
    
    title = presentation.get("filename", "Untitled")
    total_slides = len(key_topics)
    total_questions = qa_analysis.get("total_questions", 0)
    engagement_level = qa_analysis.get("engagement_level", "No questions asked")
    
    # Create summary templates based on language
    summary_templates = {
        'en': f"""Executive Summary: {title}

This presentation consists of {total_slides} slides covering {len(key_topics)} key topics. The audience engagement level was {engagement_level.lower()} with {total_questions} questions asked.

Key Topics Covered:
{chr(10).join([f"• {topic['title']}" for topic in key_topics[:5]])}

Audience Engagement:
{engagement_level} - {total_questions} questions asked
{chr(10).join([f"• {insight}" for insight in qa_analysis.get('insights', [])])}

Recommendations:
{chr(10).join([f"• {insight['recommendation']}" for insight in insights[:3]])}""",
        
        'hi': f"""कार्यकारी सारांश: {title}

इस प्रस्तुति में {total_slides} स्लाइड्स हैं जो {len(key_topics)} मुख्य विषयों को कवर करती हैं। दर्शकों की भागीदारी का स्तर {engagement_level.lower()} था और {total_questions} प्रश्न पूछे गए।

मुख्य विषय:
{chr(10).join([f"• {topic['title']}" for topic in key_topics[:5]])}

दर्शक भागीदारी:
{engagement_level} - {total_questions} प्रश्न पूछे गए
{chr(10).join([f"• {insight}" for insight in qa_analysis.get('insights', [])])}

सुझाव:
{chr(10).join([f"• {insight['recommendation']}" for insight in insights[:3]])}""",
        
        'es': f"""Resumen Ejecutivo: {title}

Esta presentación consta de {total_slides} diapositivas que cubren {len(key_topics)} temas clave. El nivel de participación de la audiencia fue {engagement_level.lower()} con {total_questions} preguntas realizadas.

Temas Clave Cubiertos:
{chr(10).join([f"• {topic['title']}" for topic in key_topics[:5]])}

Participación de la Audiencia:
{engagement_level} - {total_questions} preguntas realizadas
{chr(10).join([f"• {insight}" for insight in qa_analysis.get('insights', [])])}

Recomendaciones:
{chr(10).join([f"• {insight['recommendation']}" for insight in insights[:3]])}"""
    }
    
    if language in summary_templates:
        return summary_templates[language]
    else:
        # Translate English template to target language
        english_template = summary_templates['en']
        return translation_service.translate_text(english_template, language)


