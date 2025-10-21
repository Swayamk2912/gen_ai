import os
import sqlite3
from typing import Any, Dict, List


DB_PATH = os.path.join(os.getcwd(), "data", "app.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS presentations (
            id TEXT PRIMARY KEY,
            filename TEXT
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS slides (
            presentation_id TEXT,
            slide_index INTEGER,
            title TEXT,
            content TEXT,
            narration TEXT,
            audio_path TEXT,
            PRIMARY KEY (presentation_id, slide_index)
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS qa_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            presentation_id TEXT,
            slide_index INTEGER,
            question TEXT,
            answer TEXT
        )
        """
    )
    conn.commit()
    conn.close()


def save_presentation(pres_id: str, filename: str) -> None:
    conn = get_conn()
    conn.execute("INSERT OR REPLACE INTO presentations (id, filename) VALUES (?, ?)", (pres_id, filename))
    conn.commit()
    conn.close()


def save_slide(pres_id: str, index: int, slide: Dict[str, Any]) -> None:
    conn = get_conn()
    conn.execute(
        "INSERT OR REPLACE INTO slides (presentation_id, slide_index, title, content) VALUES (?, ?, ?, ?)",
        (pres_id, index, slide.get("title", ""), slide.get("content", "")),
    )
    conn.commit()
    conn.close()


def update_slide_audio(pres_id: str, index: int, narration: str, audio_path: str) -> None:
    conn = get_conn()
    conn.execute(
        "UPDATE slides SET narration = ?, audio_path = ? WHERE presentation_id = ? AND slide_index = ?",
        (narration, audio_path, pres_id, index),
    )
    conn.commit()
    conn.close()


def get_presentation(pres_id: str) -> Dict[str, Any]:
    conn = get_conn()
    row = conn.execute("SELECT id, filename FROM presentations WHERE id = ?", (pres_id,)).fetchone()
    conn.close()
    if not row:
        return {"id": pres_id, "filename": "unknown"}
    return {"id": row["id"], "filename": row["filename"]}


def get_slides(pres_id: str) -> List[Dict[str, Any]]:
    conn = get_conn()
    rows = conn.execute(
        "SELECT slide_index, title, content, narration, audio_path FROM slides WHERE presentation_id = ? ORDER BY slide_index",
        (pres_id,),
    ).fetchall()
    conn.close()
    return [
        {
            "index": r["slide_index"],
            "title": r["title"],
            "content": r["content"],
            "narration": r["narration"],
            "audio_path": r["audio_path"],
        }
        for r in rows
    ]


def save_qa_log(pres_id: str, index: int, question: str, answer: str) -> None:
    conn = get_conn()
    conn.execute(
        "INSERT INTO qa_logs (presentation_id, slide_index, question, answer) VALUES (?, ?, ?, ?)",
        (pres_id, index, question, answer),
    )
    conn.commit()
    conn.close()


def get_qa_logs(pres_id: str) -> List[Dict[str, Any]]:
    conn = get_conn()
    rows = conn.execute(
        "SELECT slide_index, question, answer FROM qa_logs WHERE presentation_id = ? ORDER BY id",
        (pres_id,),
    ).fetchall()
    conn.close()
    return [
        {"slide_index": r["slide_index"], "question": r["question"], "answer": r["answer"]}
        for r in rows
    ]


