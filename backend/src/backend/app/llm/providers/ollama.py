import json

import ollama

from app.llm.base import LLMProvider


class OllamaProvider(LLMProvider):

    def __init__(self, model: str):
        self.model = model

    def generate(
        self,
        prompt: str,
        response_schema: dict | None = None,
    ) -> str:

        response = ollama.chat(
            model=self.model,
            messages=[
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            format=response_schema,
        )

        return response["message"]["content"]

    @classmethod
    def list_models(cls) -> list[str]:

        response = ollama.list()

        return [
            model.model
            for model in response.models
        ] # type: ignore