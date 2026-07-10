import time
import logging
from collections import defaultdict
from typing import Dict, List
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth, sessions, documents

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("concord")

app = FastAPI(
    title="CONCORD API",
    description="Backend API for CONCORD: AI-Mediated Contract Negotiation Platform",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In development, allow all. In prod, configure specific domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory Rate Limiting Middleware
class SlidingWindowRateLimiter:
    def __init__(self, limit: int = 60, window: int = 60):
        self.limit = limit
        self.window = window
        self.requests: Dict[str, List[float]] = defaultdict(list)

    def check_rate_limit(self, client_ip: str):
        now = time.time()
        # Keep only timestamps within the current window
        self.requests[client_ip] = [t for t in self.requests[client_ip] if now - t < self.window]
        
        if len(self.requests[client_ip]) >= self.limit:
            logger.warning(f"Rate limit exceeded for client: {client_ip}")
            raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")
        
        self.requests[client_ip].append(now)

rate_limiter = SlidingWindowRateLimiter(limit=100, window=60) # 100 requests per minute

@app.middleware("http")
async def rate_limiting_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    try:
        rate_limiter.check_rate_limit(client_ip)
    except HTTPException as e:
        return Response(content=e.detail, status_code=e.status_code)
    
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    logger.info(f"{request.method} {request.url.path} responded in {duration:.4f}s with status {response.status_code}")
    return response

# Register Routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(sessions.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "CONCORD",
        "tagline": "Where agreement is engineered.",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting CONCORD server at {settings.host}:{settings.port}")
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)
