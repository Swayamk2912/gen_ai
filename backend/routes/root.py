from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, RedirectResponse, StreamingResponse
import os, io

router = APIRouter(tags=["Root"])

@router.get("/")
def root():
    return RedirectResponse(url="/app")

@router.get("/app")
def serve_app():
    index = os.path.join(os.getcwd(), "frontend", "index.html")
    if not os.path.exists(index):
        raise HTTPException(status_code=404, detail="Frontend not found")
    return FileResponse(index, media_type="text/html")

@router.get("/sample-pdf")
def sample_pdf():
    try:
        from reportlab.lib.pagesizes import LETTER
        from reportlab.pdfgen import canvas
        from reportlab.lib.units import inch
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ReportLab not available: {e}")

    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=LETTER)
    width, height = LETTER

    # Page 1
    c.setTitle("GenAI Sample PDF")
    c.setFont("Helvetica-Bold", 20)
    c.drawString(1 * inch, height - 1.5 * inch, "GenAI Presentation Agent")
    c.setFont("Helvetica", 12)
    body = (
        "This is a generated sample PDF to verify PDF delivery from the backend.\n"
        "Use this as a template to render your own content, summaries, or Q&A logs."
    )
    for i, line in enumerate(body.split("\n")):
        c.drawString(1 * inch, height - (2.0 + i * 0.3) * inch, line)

    c.setFont("Helvetica-Oblique", 10)
    c.drawString(1 * inch, 0.75 * inch, "Page 1")
    c.showPage()

    # Page 2
    c.setFont("Helvetica-Bold", 16)
    c.drawString(1 * inch, height - 1.25 * inch, "Details")
    c.setFont("Helvetica", 12)
    lines = [
        "- Generated with ReportLab",
        "- Served by FastAPI",
        "- Suited for exporting presentation summaries",
        "- Customize fonts, tables, charts as needed",
    ]
    for i, line in enumerate(lines):
        c.drawString(1 * inch, height - (1.75 + i * 0.3) * inch, line)

    c.setFont("Helvetica-Oblique", 10)
    c.drawString(1 * inch, 0.75 * inch, "Page 2")
    c.showPage()

    c.save()
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/pdf", headers={
        "Content-Disposition": "inline; filename=sample.pdf"
    })
