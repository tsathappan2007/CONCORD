import logging
from fastapi import APIRouter, Depends, HTTPException
from app.services.supabase_client import verify_token, get_supabase_admin

logger = logging.getLogger("concord")
router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/sync")
async def sync_profile(user: dict = Depends(verify_token)):
    """
    Ensures a user profile exists in public.profiles when they authenticate.
    """
    supabase = get_supabase_admin()
    
    profile_data = {
        "id": user["id"],
        "email": user["email"],
        "full_name": user["email"].split("@")[0].title()
    }
    
    try:
        supabase.table("profiles").upsert(profile_data).execute()
        logger.info(f"Successfully synced profile for user: {user['email']}")
        return {"success": True, "profile": profile_data}
    except Exception as e:
        logger.error(f"Failed to sync user profile: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to sync user profile: {str(e)}")
