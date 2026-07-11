import logging
import asyncio
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
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

class ReadySubmit(BaseModel):
    role: str

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
            error_msg = str(e)
            logger.error(f"Error in background negotiation loop: {error_msg}")
            try:
                supabase = get_supabase_admin()
                session_data = supabase.table("negotiation_sessions").select("round_count").eq("id", session_id).execute().data
                round_num = session_data[0]["round_count"] if session_data else 1
                
                supabase.table("negotiation_logs").insert({
                    "session_id": session_id,
                    "round": round_num,
                    "sender": "system",
                    "tool_called": "system_end",
                    "reasoning": f"Negotiation interrupted: {error_msg}. Please check your LLM API keys in .env."
                }).execute()
                
                supabase.table("negotiation_sessions").update({
                    "status": "draft"
                }).eq("id", session_id).execute()
            except Exception as db_err:
                logger.error(f"Failed to log background loop error to database: {db_err}")
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
    payload: ReadySubmit,
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
    if payload.role == "party_a" and session["party_a_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if payload.role == "party_b" and session["party_b_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
        
    try:
        # Update ready status
        supabase.table("party_constraints").update({
            "is_ready": True
        }).eq("session_id", session_id).eq("role", payload.role).execute()
        
        # Check if BOTH are ready
        constraints = supabase.table("party_constraints").select("*").eq("session_id", session_id).execute().data
        
        ready_count = sum(1 for c in constraints if c["is_ready"])
        
        if ready_count == 2:
            # Clear any residual logs or agreed terms from previous runs on this session
            supabase.table("agreed_terms").delete().eq("session_id", session_id).execute()
            supabase.table("negotiation_logs").delete().eq("session_id", session_id).execute()
            
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

    # Check if this user has already approved
    existing = supabase.table("agreement_versions").select("*")\
        .eq("session_id", session_id)\
        .eq("created_by", user["id"])\
        .eq("status", "draft")\
        .eq("version", 888)\
        .execute()
        
    if existing.data:
        return {
            "status": "awaiting_approval",
            "message": "You have already approved this agreement. Awaiting counterparty approval."
        }

    # Check if the other party has manually approved (version=888)
    other_approvals = supabase.table("agreement_versions").select("*")\
        .eq("session_id", session_id)\
        .neq("created_by", user["id"])\
        .eq("status", "draft")\
        .eq("version", 888)\
        .execute()

    try:
        if other_approvals.data:
            # Both parties have approved! Complete the session
            supabase.table("negotiation_sessions").update({
                "status": "completed",
                "current_turn": "none"
            }).eq("id", session_id).execute()
            
            # Generate the final PDF and docx
            pdf_url = ContractExporter.export_and_upload(session_id, "pdf")
            docx_url = ContractExporter.export_and_upload(session_id, "docx")
            
            # Insert final signed version
            supabase.table("agreement_versions").insert({
                "session_id": session_id,
                "version": 999,
                "terms_snapshot": {},
                "created_by": user["id"],
                "status": "signed",
                "pdf_url": pdf_url,
                "docx_url": docx_url
            }).execute()
            
            return {
                "status": "completed",
                "message": "Agreement approved by both parties. Final files generated.",
                "pdf_url": pdf_url,
                "docx_url": docx_url
            }
        else:
            # First party approval
            # Generate docx talks of negotiation immediately so it can be downloaded
            docx_url = ContractExporter.export_and_upload(session_id, "docx")
            
            # Insert a draft version to record this user's approval
            supabase.table("agreement_versions").insert({
                "session_id": session_id,
                "version": 888,
                "terms_snapshot": {},
                "created_by": user["id"],
                "status": "draft",
                "docx_url": docx_url
            }).execute()
            
            return {
                "status": "awaiting_approval",
                "message": "Your approval has been recorded. Awaiting counterparty approval."
            }
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

@router.post("/{session_id}/supporting")
async def upload_supporting_document(
    session_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(verify_token)
) -> Dict[str, Any]:
    """Uploads a supporting document for the session using admin privileges to bypass RLS."""
    supabase = get_supabase_admin()
    
    # Check if session exists
    sess_res = supabase.table("negotiation_sessions").select("*").eq("id", session_id).execute()
    if not sess_res.data:
        raise HTTPException(status_code=404, detail="Session not found")
        
    try:
        content = await file.read()
        path = f"supporting/{session_id}/{file.filename}"
        supabase.storage.from_("contracts").upload(
            path=path,
            file=content,
            file_options={"cache-control": "3600", "upsert": "true"}
        )
        return {"success": True, "filename": file.filename}
    except Exception as e:
        logger.error(f"Failed to upload supporting document: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload document: {str(e)}")

@router.get("/{session_id}/supporting")
async def list_supporting_documents(
    session_id: str,
    user: dict = Depends(verify_token)
) -> List[Dict[str, Any]]:
    """Lists supporting documents for the session."""
    supabase = get_supabase_admin()
    try:
        res = supabase.storage.from_("contracts").list(f"supporting/{session_id}")
        return [{"name": item["name"], "id": item.get("id"), "metadata": item.get("metadata")} for item in res]
    except Exception as e:
        logger.error(f"Failed to list supporting documents: {e}")
        return []

@router.get("/{session_id}/supporting/{filename}")
async def get_supporting_document(
    session_id: str,
    filename: str,
    user: dict = Depends(verify_token)
) -> Dict[str, Any]:
    """Generates a temporary signed URL to view/download the supporting document."""
    supabase = get_supabase_admin()
    try:
        path = f"supporting/{session_id}/{filename}"
        res = supabase.storage.from_("contracts").create_signed_url(path, 3600)
        if not res or "signedURL" not in res:
            public_url = supabase.storage.from_("contracts").get_public_url(path)
            return {"url": public_url}
        return {"url": res["signedURL"]}
    except Exception as e:
        logger.error(f"Failed to generate signed URL for document: {e}")
        try:
            path = f"supporting/{session_id}/{filename}"
            public_url = supabase.storage.from_("contracts").get_public_url(path)
            return {"url": public_url}
        except Exception:
            raise HTTPException(status_code=500, detail="Failed to retrieve document URL")

@router.delete("/{session_id}/supporting/{filename}")
async def delete_supporting_document(
    session_id: str,
    filename: str,
    user: dict = Depends(verify_token)
) -> Dict[str, Any]:
    """Deletes a supporting document for the session."""
    supabase = get_supabase_admin()
    
    # Authorize: check if user is creator
    sess_res = supabase.table("negotiation_sessions").select("*").eq("id", session_id).execute()
    if not sess_res.data:
        raise HTTPException(status_code=404, detail="Session not found")
    session = sess_res.data[0]
    if user["id"] != session.get("creator_id") and user["id"] != session.get("party_a_id"):
        raise HTTPException(status_code=403, detail="Not authorized to delete supporting documents")
        
    try:
        path = f"supporting/{session_id}/{filename}"
        supabase.storage.from_("contracts").remove([path])
        return {"success": True, "message": "Document deleted successfully"}
    except Exception as e:
        logger.error(f"Failed to delete supporting document: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete supporting document: {str(e)}")

@router.delete("/{session_id}")
async def delete_session(session_id: str, user: dict = Depends(verify_token)) -> Dict[str, Any]:
    """Deletes a negotiation session and all associated data."""
    supabase = get_supabase_admin()
    
    # Check if session exists
    sess_res = supabase.table("negotiation_sessions").select("*").eq("id", session_id).execute()
    if not sess_res.data:
        raise HTTPException(status_code=404, detail="Session not found")
    session = sess_res.data[0]
    
    # Authorize: user must be creator or part of the session
    if user["id"] not in [session.get("creator_id"), session.get("party_a_id"), session.get("party_b_id")]:
        raise HTTPException(status_code=403, detail="Not authorized to delete this session")
        
    try:
        supabase.table("negotiation_sessions").delete().eq("id", session_id).execute()
        return {"success": True, "message": "Session deleted successfully"}
    except Exception as e:
        logger.error(f"Failed to delete session: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete session: {str(e)}")
