from abc import ABC, abstractmethod


class LLMProvider(ABC):

    @abstractmethod
    def generate(
        self,
        prompt: str,
        response_schema: dict | None = None,
    ) -> str:
        pass

    @classmethod
    @abstractmethod
    def list_models(cls) -> list[str]:
        pass