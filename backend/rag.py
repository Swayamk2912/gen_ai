from typing import List, Dict, Tuple
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np


def build_corpus(slides: List[Dict], qa_logs: List[Dict]) -> List[str]:
    """
    Combine slide content and QA logs into a text corpus.
    Each entry becomes a single text document for embedding.
    """
    docs: List[str] = []

    for s in slides:
        title = s.get("title", "")
        content = s.get("content", "")
        text = f"{title.strip()}\n{content.strip()}"
        if text.strip():
            docs.append(text)

    for qa in qa_logs:
        q = qa.get("question", "").strip()
        a = qa.get("answer", "").strip()
        if q or a:
            docs.append(f"Q: {q}\nA: {a}")

    return docs


def top_k_contexts(query: str, docs: List[str], k: int = 3) -> List[Tuple[int, float, str]]:
    """
    Compute semantic similarity between query and documents using Google Embeddings.
    Returns top-k most similar documents with their scores.
    """
    if not docs:
        return []

    try:
        # Initialize Google Generative AI Embeddings
        embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")

        # Embed all documents
        doc_embeddings = embeddings.embed_documents(docs)
        query_embedding = embeddings.embed_query(query)

        # Compute cosine similarity
        sims = cosine_similarity([query_embedding], doc_embeddings).flatten()

        # Rank and return top k
        ranked_indices = np.argsort(sims)[::-1][:k]
        return [(int(i), float(sims[i]), docs[i]) for i in ranked_indices]

    except Exception as e:
        print(f"[ERROR] Embedding or similarity failed: {e}")
        # Fallback: return first few docs if embeddings fail
        return [(i, 0.0, d) for i, d in list(enumerate(docs))[:k]]
