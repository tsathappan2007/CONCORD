import time
import json
import logging
from typing import Type, TypeVar, Optional, List
from pydantic import BaseModel, Field
from groq import Groq
from app.config import settings

logger = logging.getLogger("concord")

T = TypeVar("T", bound=BaseModel)

# Structured response schema representing a negotiation turn's action
class AgentAction(BaseModel):
    thought_process: str = Field(
        ..., 
        description="Internal thinking process assessing the counterparty's last offer, our constraints, and our strategy."
    )
    tool_called: str = Field(
        ..., 
        description="The action to take. Must be one of: 'propose_term', 'accept_term', 'counter_propose', 'request_concession', or 'escalate_to_mediator'."
    )
    term: Optional[str] = Field(
        None, 
        description="Term name for propose_term, accept_term, counter_propose (e.g. 'rate', 'payment_terms', 'deadline')"
    )
    value: Optional[str] = Field(
        None, 
        description="Proposed value for propose_term"
    )
    previous_value: Optional[str] = Field(
        None, 
        description="Previous value for counter_propose"
    )
    new_value: Optional[str] = Field(
        None, 
        description="New value for counter_propose"
    )
    reason: Optional[str] = Field(
        None, 
        description="Reason for accept_term, or explanation for escalate_to_mediator"
    )
    give_up: Optional[str] = Field(
        None, 
        description="Concession term/value you are willing to let go for request_concession"
    )
    want_in_return: Optional[str] = Field(
        None, 
        description="Term/value you want in return for request_concession"
    )
    stuck_on: Optional[str] = Field(
        None, 
        description="Term stuck on for escalate_to_mediator"
    )
    reasoning: str = Field(
        ..., 
        description="Action reasoning text that will be printed in the public negotiation audit log"
    )

class LLMOrchestrator:
    def __init__(self):
        self.groq_client = None
        self.gemini_client = None
        self._init_clients()

    def _init_clients(self):
        # 1. Initialize Groq
        if settings.groq_api_key:
            try:
                self.groq_client = Groq(api_key=settings.groq_api_key)
                logger.info("Groq client initialized successfully.")
            except Exception as e:
                logger.error(f"Failed to initialize Groq client: {e}")
        else:
            logger.warning("GROQ_API_KEY is not set.")

        # 2. Initialize Gemini (google-genai)
        if settings.gemini_api_key:
            try:
                from google import genai
                self.gemini_client = genai.Client(api_key=settings.gemini_api_key)
                logger.info("Gemini client initialized successfully.")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini client: {e}")
        else:
            logger.warning("GEMINI_API_KEY is not set.")

    def generate_structured(self, system_prompt: str, user_prompt: str, response_model: Type[T]) -> T:
        """
        Attempts structured content generation using Groq. 
        If it fails, automatically falls back to Gemini 2.5 Flash with backoff.
        """
        # Determine available providers
        providers = []
        if self.groq_client:
            providers.append("groq")
        if self.gemini_client:
            providers.append("gemini")
            
        if not providers:
            logger.error("No LLM API keys provided. Please set GROQ_API_KEY or GEMINI_API_KEY.")
            raise ValueError("No LLM providers initialized. Please configure GROQ_API_KEY or GEMINI_API_KEY.")

        last_error = None
        for provider in providers:
            max_retries = 3
            backoff = 2
            for attempt in range(max_retries):
                try:
                    if provider == "groq":
                        logger.info(f"Attempting Groq structured generation (Attempt {attempt+1})")
                        return self._generate_groq(system_prompt, user_prompt, response_model)
                    elif provider == "gemini":
                        logger.info(f"Attempting Gemini structured generation (Attempt {attempt+1})")
                        return self._generate_gemini(system_prompt, user_prompt, response_model)
                except Exception as e:
                    last_error = e
                    logger.warning(f"Provider {provider} failed on attempt {attempt+1}: {e}")
                    if attempt < max_retries - 1:
                        time.sleep(backoff ** attempt)
                    else:
                        logger.error(f"Provider {provider} failed all retries.")
        
        raise RuntimeError(f"All LLM providers and retries failed. Last error: {last_error}")

    def _generate_groq(self, system_prompt: str, user_prompt: str, response_model: Type[T]) -> T:
        # Using Llama 3.3 70B as primary model
        model = "llama-3.3-70b-versatile"
        schema_json = response_model.model_json_schema()
        
        full_system = (
            f"{system_prompt}\n\n"
            f"You MUST return a JSON object that strictly conforms to this JSON Schema:\n"
            f"{json.dumps(schema_json)}"
        )
        
        response = self.groq_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": full_system},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.2
        )
        content = response.choices[0].message.content
        logger.debug(f"Groq response: {content}")
        return response_model.model_validate_json(content)

    def _generate_gemini(self, system_prompt: str, user_prompt: str, response_model: Type[T]) -> T:
        from google.genai import types
        model = "gemini-2.5-flash"
        
        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_schema=response_model,
            temperature=0.2
        )
        
        response = self.gemini_client.models.generate_content(
            model=model,
            contents=user_prompt,
            config=config
        )
        content = response.text
        logger.debug(f"Gemini response: {content}")
        return response_model.model_validate_json(content)
