import logging
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from app.config import settings

logger = logging.getLogger("concord")
security = HTTPBearer()

def get_supabase_client() -> Client:
    """Returns a standard client for Supabase operations."""
    if not settings.supabase_url or not settings.supabase_key:
        logger.warning("Supabase URL or Key not configured.")
    return create_client(settings.supabase_url, settings.supabase_key)

def get_supabase_admin() -> Client:
    """Returns an admin client with service role privileges (bypass RLS)."""
    if not settings.supabase_url or not settings.supabase_service_role_key:
        logger.warning("Supabase URL or Service Role Key not configured.")
    return create_client(settings.supabase_url, settings.supabase_service_role_key)

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    FastAPI dependency to verify a Supabase Auth JWT.
    Returns a dict containing the user's ID and email.
    """
    token = credentials.credentials
    supabase = get_supabase_client()
    try:
        # Supabase Python SDK retrieves the user metadata by sending the JWT
        # to the GoTrue auth server, which handles validation.
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid session token")
        
        user = user_response.user
        return {
            "id": user.id,
            "email": user.email,
            "token": token
        }
    except Exception as e:
        logger.error(f"Auth token verification failed: {e}")
        raise HTTPException(status_code=401, detail=f"Authentication failed or token expired: {str(e)}")
