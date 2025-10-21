from typing import List, Dict, Tuple

def build_corpus(slides: List[Dict], qa_logs: List[Dict]) -> List[str]:
    docs: List[str] = []
    for s in slides:
        title = s.get("title") or ""
        content = s.get("content") or ""
        docs.append(f"{title}\n{content}")
    for qa in qa_logs:
        docs.append(f"Q: {qa.get('question','')}\nA: {qa.get('answer','')}")
    return docs


def top_k_contexts(query: str, docs: List[str], k: int = 3) -> List[Tuple[int, float, str]]:
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
    except Exception:
        # If sklearn not installed, return first few docs
        return [(i, 0.0, d) for i, d in list(enumerate(docs))[:k]]

    # Use multilingual stop words or no stop words for better Hindi support
    try:
        vectorizer = TfidfVectorizer(stop_words='english', ngram_range=(1, 2))
    except:
        # Fallback without stop words for better multilingual support
        vectorizer = TfidfVectorizer(ngram_range=(1, 2))
    
    mat = vectorizer.fit_transform(docs + [query])
    sims = cosine_similarity(mat[-1], mat[:-1]).flatten()
    ranked = sorted(list(enumerate(sims)), key=lambda x: x[1], reverse=True)[:k]
    return [(i, float(score), docs[i]) for i, score in ranked]


