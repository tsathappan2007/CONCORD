import logging
import asyncio
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from app.services.supabase_client import verify_token, get_supabase_admin
from app.services.negotiator import NegotiationEngine
from app.services.exporter import ContractExporter

logger = logging.getLogger("concord")
router = APIRouter(prefix="/sessions", tags=["sessions"])

class SessionCreate(BaseModel):
    title: str

class ConstraintsSubmit(BaseModel):
    role: str
    raw_text: str
    structured_constraints: Dict[str, Any]

async def run_negotiation_loop(session_id: str):
    """Background task to run the turn-taking loop with visual delay."""
    engine = NegotiationEngine()
    logger.info(f"Starting background negotiation loop for session: {session_id}")
    
    # Let users watch it unfold turn-by-turn with a 4 second pause between steps
    while True:
        try:
            # Check state first to prevent overwriting
            supabase = get_supabase_admin()
            session = supabase.table("negotiation_sessions").select("status").eq("id", session_id).execute().data[0]
            if session["status"] != "negotiating":
                logger.info(f"Session {session_id} state changed to {session['status']}. Ending loop.")
                break
                
            res = engine.run_step(session_id)
            if res.get("status") != "negotiating":
                logger.info(f"Session {session_id} finished negotiating. State: {res.get('status')}")
                break
                
            await asyncio.sleep(4) # Visual delay for live watchers
        except Exception as e:
            logger.error(f"Error in background negotiation loop: {e}")
            break

@router.get("")
async def list_sessions(user: dict = Depends(verify_token)) -> List[Dict[str, Any]]:
    """Lists all negotiation sessions where user is a participant."""
    supabase = get_supabase_admin()
    try:
        res = supabase.table("negotiation_sessions")\
            .select("*")\
            .or_(f"creator_id.eq.{user['id']},party_a_id.eq.{user['id']},party_b_id.eq.{user['id']}")\
            .order("created_at", desc=True)\
            .execute()
        return res.data
    except Exception as e:
        logger.error(f"Failed to list sessions: {e}")
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")

@router.post("")
async def create_session(session: SessionCreate, user: dict = Depends(verify_token)) -> Dict[str, Any]:
    """Creates a new negotiation session."""
    supabase = get_supabase_admin()
    
    session_data = {
        "title": session.title,
        "status": "draft",
        "creator_id": user["id"],
        "party_a_id": user["id"], # Creator defaults to Party A
        "current_turn": "party_a",
        "round_count": 0,
        "max_rounds": 12
    }
    
    try:
        res = supabase.table("negotiation_sessions").insert(session_data).execute()
        return res.data[0]
    except Exception as e:
        logger.error(f"Failed to create session: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")

@router.get("/{session_id}")
async def get_session(session_id: str, user: dict = Depends(verify_token)) -> Dict[str, Any]:
    """Retrieves session details, checking access rights."""
    supabase = get_supabase_admin()
    
    res = supabase.table("negotiation_sessions").select("*").eq("id", session_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Session not found")
        
    session = res.data[0]
    
    # Verify access
    if user["id"] not in [session["creator_id"], session["party_a_id"], session["party_b_id"]]:
        raise HTTPException(status_code=403, detail="Access denied to this session")
        
    return session

@router.post("/{session_id}/join")
async def join_session(session_id: str, user: dict = Depends(verify_token)) -> Dict[str, Any]:
    """Allows a counterparty to join an invited session as Party B."""
    supabase = get_supabase_admin()
    
    res = supabase.table("negotiation_sessions").select("*").eq("id", session_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Session not found")
        
    session = res.data[0]
    
    if session["party_b_id"] is not None:
        if session["party_b_id"] == user["id"]:
            return session
        raise HTTPException(status_code=400, detail="Session already has a counterparty joined")
        
    if session["party_a_id"] == user["id"]:
        raise HTTPException(status_code=400, detail="You cannot join your own session as counterparty")
        
    try:
        update_res = supabase.table("negotiation_sessions").update({
            "party_b_id": user["id"],
            "status": "awaiting_second_party" # transition state
        }).eq("id", session_id).execute()
        
        return update_res.data[0]
    except Exception as e:
        logger.error(f"Failed to join session: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to join session: {str(e)}")

@router.post("/{session_id}/constraints")
async def submit_constraints(
    session_id: str,
    payload: ConstraintsSubmit,
    user: dict = Depends(verify_token)
) -> Dict[str, Any]:
    """Saves party constraints. Verifies access role to maintain privacy."""
    supabase = get_supabase_admin()
    
    # Load session to verify role matching user
    sess_res = supabase.table("negotiation_sessions").select("*").eq("id", session_id).execute()
    if not sess_res.data:
        raise HTTPException(status_code=404, detail="Session not found")
    session = sess_res.data[0]
    
    # Enforce role matching user ID
    if payload.role == "party_a" and session["party_a_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You are not authorized as Party A")
    if payload.role == "party_b" and session["party_b_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You are not authorized as Party B")

    constraint_data = {
        "session_id": session_id,
        "party_id": user["id"],
        "role": payload.role,
        "raw_text": payload.raw_text,
        "structured_constraints": payload.structured_constraints,
        "is_ready": False
    }
    
    try:
        # Upsert constraints
        res = supabase.table("party_constraints").upsert(
            constraint_data, 
            on_conflict="session_id,role"
        ).execute()
        return {"success": True, "data": res.data[0]}
    except Exception as e:
        logger.error(f"Failed to save constraints: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save constraints: {str(e)}")

@router.post("/{session_id}/ready")
async def mark_ready(
    session_id: str,
    role: str,
    background_tasks: BackgroundTasks,
    user: dict = Depends(verify_token)
) -> Dict[str, Any]:
    """Marks a party ready. If both are ready, starts the background negotiator."""
    supabase = get_supabase_admin()
    
    # Check session
    sess_res = supabase.table("negotiation_sessions").select("*").eq("id", session_id).execute()
    if not sess_res.data:
        raise HTTPException(status_code=404, detail="Session not found")
    session = sess_res.data[0]
    
    # Verify user owns the role
    if role == "party_a" and session["party_a_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if role == "party_b" and session["party_b_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
        
    try:
        # Update ready status
        supabase.table("party_constraints").update({
            "is_ready": True
        }).eq("session_id", session_id).eq("role", role).execute()
        
        # Check if BOTH are ready
        constraints = supabase.table("party_constraints").select("*").eq("session_id", session_id).execute().data
        
        ready_count = sum(1 for c in constraints if c["is_ready"])
        
        if ready_count == 2:
            # Change status to negotiating, turn to party_a
            supabase.table("negotiation_sessions").update({
                "status": "negotiating",
                "current_turn": "party_a",
                "round_count": 1
            }).eq("id", session_id).execute()
            
            # Log negotiation initiation
            supabase.table("negotiation_logs").insert({
                "session_id": session_id,
                "round": 1,
                "sender": "system",
                "tool_called": "system_start",
                "reasoning": "Both parties are ready. Autonomous negotiation has started."
            }).execute()

            # Trigger background loop
            background_tasks.add_task(run_negotiation_loop, session_id)
            
            return {"status": "negotiating", "ready": True, "message": "Negotiation started."}
            
        return {"status": session["status"], "ready": False, "message": "Marked ready, waiting for counterparty."}
        
    except Exception as e:
        logger.error(f"Failed to set ready: {e}")
        raise HTTPException(status_code=500, detail=f"Action failed: {str(e)}")

@router.post("/{session_id}/approve")
async def approve_session(session_id: str, user: dict = Depends(verify_token)) -> Dict[str, Any]:
    """Closes the negotiation session, generating final PDF and DOCX documents."""
    supabase = get_supabase_admin()
    
    sess_res = supabase.table("negotiation_sessions").select("*").eq("id", session_id).execute()
    if not sess_res.data:
        raise HTTPException(status_code=404, detail="Session not found")
    session = sess_res.data[0]
    
    if session["status"] != "awaiting_approval":
        raise HTTPException(status_code=400, detail="Session is not awaiting approval")

    # Complete session status
    try:
        supabase.table("negotiation_sessions").update({
            "status": "completed",
            "current_turn": "none"
        }).eq("id", session_id).execute()
        
        # Trigger Document exports to Supabase storage bucket
        pdf_url = ContractExporter.export_and_upload(session_id, "pdf")
        docx_url = ContractExporter.export_and_upload(session_id, "docx")
        
        # Insert as signed version in versions
        supabase.table("agreement_versions").insert({
            "session_id": session_id,
            "version": 999, # Final code
            "terms_snapshot": {},
            "created_by": user["id"],
            "status": "signed",
            "pdf_url": pdf_url,
            "docx_url": docx_url
        }).execute()
        
        return {"status": "completed", "pdf_url": pdf_url, "docx_url": docx_url}
    except Exception as e:
        logger.error(f"Failed to approve session: {e}")
        raise HTTPException(status_code=500, detail=f"Approval failed: {str(e)}")

@router.post("/{session_id}/reject")
async def reject_session(session_id: str, user: dict = Depends(verify_token)) -> Dict[str, Any]:
    """Marks session status as rejected."""
    supabase = get_supabase_admin()
    
    try:
        res = supabase.table("negotiation_sessions").update({
            "status": "rejected",
            "current_turn": "none"
        }).eq("id", session_id).execute()
        return res.data[0]
    except Exception as e:
        logger.error(f"Failed to reject session: {e}")
        raise HTTPException(status_code=500, detail=f"Rejection failed: {str(e)}")

@router.get("/{session_id}/export")
async def get_export_urls(session_id: str, user: dict = Depends(verify_token)) -> Dict[str, Any]:
    """Retrieves PDF/DOCX urls for completed negotiations."""
    supabase = get_supabase_admin()
    
    res = supabase.table("agreement_versions")\
        .select("pdf_url,docx_url")\
        .eq("session_id", session_id)\
        .eq("status", "signed")\
        .execute()
        
    if not res.data:
        # If not generated yet, try to generate
        try:
            pdf_url = ContractExporter.export_and_upload(session_id, "pdf")
            docx_url = ContractExporter.export_and_upload(session_id, "docx")
            return {"pdf_url": pdf_url, "docx_url": docx_url}
        except Exception as e:
            raise HTTPException(status_code=404, detail="Export files not found or session not completed")
            
    return res.data[0]
