import io
import logging
from datetime import datetime
from typing import List, Dict, Any, Tuple
from docx import Document
from docx.shared import Pt, Inches
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from app.services.supabase_client import get_supabase_admin

logger = logging.getLogger("concord")

class ContractExporter:
    @staticmethod
    def generate_docx(session_title: str, agreed_terms: List[Dict[str, Any]], logs: List[Dict[str, Any]]) -> bytes:
        """Generates a professional DOCX file of the agreement."""
        doc = Document()
        
        # Style layout
        for section in doc.sections:
            section.top_margin = Inches(1)
            section.bottom_margin = Inches(1)
            section.left_margin = Inches(1)
            section.right_margin = Inches(1)

        # Title
        p_title = doc.add_paragraph()
        p_title.alignment = 1 # Center
        r_title = p_title.add_run("CONCORD AGREEMENT")
        r_title.font.name = "Arial"
        r_title.font.size = Pt(22)
        r_title.bold = True
        
        # Meta info
        doc.add_paragraph(f"Session Title: {session_title}")
        doc.add_paragraph(f"Export Date: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
        
        p_desc = doc.add_paragraph()
        p_desc.add_run(
            "This document constitutes a binding agreement mediated and negotiated autonomously "
            "using the CONCORD AI negotiation platform. The parties confirm that the terms listed below "
            "represent their mutual agreement."
        ).italic = True
        
        # Section 1: Agreed Terms
        doc.add_heading("1. Agreed Terms", level=1)
        table = doc.add_table(rows=1, cols=2)
        table.style = "Light Shading Accent 1"
        hdr_cells = table.rows[0].cells
        hdr_cells[0].text = "Term"
        hdr_cells[1].text = "Agreed Value"
        
        for item in agreed_terms:
            row_cells = table.add_row().cells
            row_cells[0].text = str(item["term"]).replace("_", " ").title()
            row_cells[1].text = str(item["value"])

        doc.add_paragraph() # Spacer
        
        # Section 2: Audit Trail
        doc.add_heading("2. Audit Log & Negotiation Trail (Appendix)", level=1)
        p_trail_intro = doc.add_paragraph()
        p_trail_intro.add_run(
            "The following audit log lists the autonomous negotiation steps and justifications "
            "exchanged between the parties' AI agents during the agreement creation process."
        ).italic = True
        
        for entry in logs:
            sender = str(entry["sender"]).upper()
            tool = str(entry["tool_called"]).replace("_", " ").title()
            term_suffix = f" on '{entry['term']}'" if entry["term"] else ""
            
            p_log = doc.add_paragraph()
            r_header = p_log.add_run(f"[{sender} - {tool}{term_suffix}]: ")
            r_header.bold = True
            p_log.add_run(str(entry["reasoning"]))
            
        file_stream = io.BytesIO()
        doc.save(file_stream)
        file_stream.seek(0)
        return file_stream.getvalue()

    @staticmethod
    def generate_pdf(session_title: str, agreed_terms: List[Dict[str, Any]], logs: List[Dict[str, Any]]) -> bytes:
        """Generates a highly structured PDF file of the agreement."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer, 
            pagesize=letter, 
            rightMargin=54, 
            leftMargin=54, 
            topMargin=54, 
            bottomMargin=54
        )
        
        styles = getSampleStyleSheet()
        
        title_style = ParagraphStyle(
            "DocTitle",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=26,
            alignment=1, # Center
            spaceAfter=20
        )
        h1_style = ParagraphStyle(
            "DocH1",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            spaceBefore=15,
            spaceAfter=10,
            textColor=colors.HexColor("#0f172a") # Slate-900
        )
        body_style = ParagraphStyle(
            "DocBody",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            spaceAfter=8
        )
        meta_style = ParagraphStyle(
            "DocMeta",
            parent=styles["Normal"],
            fontName="Helvetica-Oblique",
            fontSize=9,
            leading=12,
            spaceAfter=10,
            textColor=colors.HexColor("#475569") # Slate-600
        )
        log_style = ParagraphStyle(
            "DocLog",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            spaceAfter=6
        )
        
        story = []
        
        # Header title
        story.append(Paragraph("CONCORD FINAL AGREEMENT", title_style))
        
        # Meta info
        story.append(Paragraph(f"<b>Session Title:</b> {session_title}", body_style))
        story.append(Paragraph(f"<b>Date Concluded:</b> {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}", body_style))
        story.append(Spacer(1, 10))
        
        intro_text = (
            "This document constitutes a binding agreement negotiated autonomously through the CONCORD AI platform. "
            "Both parties have reviewed the terms below and granted their electronic approvals."
        )
        story.append(Paragraph(intro_text, meta_style))
        story.append(Spacer(1, 10))
        
        # Agreed Terms Table
        story.append(Paragraph("1. Agreed Terms", h1_style))
        
        table_data = [["Term Name", "Agreed Contract Value"]]
        for item in agreed_terms:
            t_name = str(item["term"]).replace("_", " ").title()
            val = str(item["value"])
            table_data.append([t_name, val])
            
        t = Table(table_data, colWidths=[200, 300])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")), # Slate-800
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 10),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
            ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#f8fafc")), # Slate-50
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")), # Slate-300
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 1), (-1, -1), 9),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        
        story.append(t)
        story.append(Spacer(1, 20))
        
        # Appendix: Audit Trail
        story.append(Paragraph("2. Negotiation Audit Log (Appendix)", h1_style))
        story.append(Paragraph(
            "The section below lists the turns, tools, and commercial justifications evaluated "
            "by both parties' agents to reach the final compromise.",
            meta_style
        ))
        
        for entry in logs:
            sender = str(entry["sender"]).upper()
            tool = str(entry["tool_called"]).replace("_", " ").title()
            term = f" on '{entry['term']}'" if entry["term"] else ""
            reasoning = str(entry["reasoning"])
            
            story.append(Paragraph(
                f"<b>{sender}</b> called <i>{tool}{term}</i>:<br/>{reasoning}", 
                log_style
            ))
            story.append(Spacer(1, 4))
            
        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()

    @classmethod
    def export_and_upload(cls, session_id: str, format_type: str = "pdf") -> str:
        """
        Generates the contract, uploads it to Supabase Storage, 
        and returns the public/signed URL of the file.
        """
        supabase = get_supabase_admin()
        
        # Fetch Session title
        session = supabase.table("negotiation_sessions").select("title").eq("id", session_id).execute().data[0]
        title = session["title"]
        
        # Fetch agreed terms
        terms = supabase.table("agreed_terms").select("*").eq("session_id", session_id).order("term").execute().data
        
        # Fetch logs
        logs = supabase.table("negotiation_logs").select("*").eq("session_id", session_id).order("created_at").execute().data

        if format_type == "docx":
            file_bytes = cls.generate_docx(title, terms, logs)
            file_name = f"concord_agreement_{session_id}.docx"
            mime_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        else:
            file_bytes = cls.generate_pdf(title, terms, logs)
            file_name = f"concord_agreement_{session_id}.pdf"
            mime_type = "application/pdf"

        # Upload to Supabase Storage bucket 'contracts'
        # Check bucket existence first or just try to upload
        try:
            # Check if bucket exists, if not create it
            buckets = supabase.storage.list_buckets()
            if not any(b.name == "contracts" for b in buckets):
                supabase.storage.create_bucket("contracts", options={"public": True})
        except Exception as e:
            logger.warning(f"Error handling bucket check: {e}")

        # Upload
        path_in_bucket = f"{session_id}/{file_name}"
        try:
            supabase.storage.from_("contracts").upload(
                path=path_in_bucket,
                file=file_bytes,
                file_options={"content-type": mime_type, "x-upsert": "true"}
            )
        except Exception as e:
            # If already exists, we overwrite it (upsert true handles it, but log errors)
            logger.debug(f"Bucket upload notice: {e}")

        # Get public url
        url = supabase.storage.from_("contracts").get_public_url(path_in_bucket)
        return url
