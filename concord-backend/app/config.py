import os
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    supabase_url: str = Field("", validation_alias="SUPABASE_URL")
    supabase_key: str = Field("", validation_alias="SUPABASE_KEY")
    supabase_service_role_key: str = Field("", validation_alias="SUPABASE_SERVICE_ROLE_KEY")
    groq_api_key: str = Field("", validation_alias="GROQ_API_KEY")
    gemini_api_key: str = Field("", validation_alias="GEMINI_API_KEY")
    environment: str = Field("development", validation_alias="ENVIRONMENT")
    port: int = Field(8000, validation_alias="PORT")
    host: str = Field("0.0.0.0", validation_alias="HOST")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
