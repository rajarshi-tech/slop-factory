import json

from google import genai
from google.genai import types
from app.core.config import get_gemini_api_key
from app.llm.base import LLMProvider


class GeminiProvider(LLMProvider):

    def __init__(self, model: str):
        self.model = model
        self.client = genai.Client(api_key=get_gemini_api_key())

    def generate(
        self,
        prompt: str,
        response_schema: dict | None = None,
    ) -> str:

        config_kwargs = {}

        if response_schema is not None:
            config_kwargs["response_mime_type"] = "application/json"
            config_kwargs["response_schema"] = response_schema

        config = types.GenerateContentConfig(
            **config_kwargs
        )

        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=config,
        )

        return response.text # type: ignore

    @classmethod
    def list_models(cls) -> list[str]:

        client = genai.Client(api_key=get_gemini_api_key())

        models = client.models.list()

        return [
            model.name
            for model in models
            if "generateContent" in (model.supported_actions or [])
        ] # type: ignore
