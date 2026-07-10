import logging
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from app.services.supabase_client import verify_token
from app.services.doc_parser import DocParser
from app.services.llm_orchestrator import LLMOrchestrator

logger = logging.getLogger("concord")
router = APIRouter(prefix="/documents", tags=["documents"])

@router.post("/validate")
async def validate_document(
    file: UploadFile = File(...),
    force_ocr: bool = Form(False),
    user: dict = Depends(verify_token)
) -> Dict[str, Any]:
    """
    Uploads, parses, and validates a document (PDF, DOCX, TXT).
    Implements file format, signature, size, corruption, word count, and relevance checks.
    """
    logger.info(f"Validating upload for user {user['email']}: {file.filename}")
    
    # Read bytes
    try:
        content = await file.read()
    except Exception as e:
        logger.error(f"Failed to read file upload: {e}")
        raise HTTPException(status_code=400, detail="Failed to read the uploaded file.")

    parser = DocParser()
    
    # Executing the full validation pipeline
    result = parser.validate_and_extract(
        file_content=content,
        filename=file.filename,
        force_ocr=force_ocr
    )
    
    return {
        "success": True,
        "filename": file.filename,
        "word_count": result["word_count"],
        "char_count": result["char_count"],
        "text": result["text"],
        "warning": result["warning"]
    }

class TermConstraintSchema(BaseModel):
    type: str = Field(..., description="Type of constraint: 'numeric', 'date', or 'select'")
    preferred: str = Field(..., description="Target/preferred value, e.g. '120' or '2026-12-31' or 'client'")
    walkaway_min: Optional[str] = Field(None, description="Minimum acceptable value for numeric terms")
    walkaway_max: Optional[str] = Field(None, description="Maximum acceptable value for numeric terms")
    walkaway_earliest: Optional[str] = Field(None, description="Earliest acceptable date for date terms")
    walkaway_latest: Optional[str] = Field(None, description="Latest acceptable date for date terms")
    walkaway_exclude: Optional[List[str]] = Field(None, description="List of unacceptable options for select terms")
    priority: str = Field("medium", description="Priority: 'high', 'medium', or 'low'")

class StructuredConstraintsSchema(BaseModel):
    terms: Dict[str, TermConstraintSchema] = Field(..., description="Dictionary of terms extracted from the contract text.")

class TextPayload(BaseModel):
    text: str

@router.post("/structure")
async def extract_structured_constraints(
    payload: TextPayload,
    user: dict = Depends(verify_token)
) -> Dict[str, Any]:
    """
    Extracts candidate terms and boundaries from raw text to pre-fill constraint forms.
    """
    logger.info(f"Extracting candidate constraints for user: {user['email']}")
    sample = payload.text[:3000] # Take first 3000 chars for analysis
    
    system_prompt = (
        "You are an assistant that extracts commercial negotiation parameters from contract text. "
        "Your task is to identify 3 to 5 key negotiable terms (e.g. rate, payment terms, delivery date, IP) "
        "and suggest preferred and walk-away constraint boundaries based on the text. If not clear, suggest logical ones."
    )
    user_prompt = f"Extract parameters from this text:\n\n{sample}"
    
    orchestrator = LLMOrchestrator()
    try:
        res = orchestrator.generate_structured(system_prompt, user_prompt, StructuredConstraintsSchema)
        return {"success": True, "terms": res.terms}
    except Exception as e:
        logger.error(f"Structure extraction failed: {e}")
        return {"success": False, "terms": {}, "error": str(e)}
