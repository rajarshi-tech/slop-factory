from app.llm.base import LLMProvider
from app.llm.providers.ollama import OllamaProvider
from app.llm.providers.gemini import GeminiProvider


PROVIDERS: dict[str, type[LLMProvider]] = {
    "ollama": OllamaProvider,
    "gemini": GeminiProvider,
}


def create_llm(
    provider: str,
    model: str,
) -> LLMProvider:

    provider_class = PROVIDERS.get(provider)

    if provider_class is None:
        raise ValueError(
            f"Unsupported LLM provider: {provider}"
        )

    return provider_class(model) # type: ignore


def get_provider_models(provider: str) -> list[str]:

    provider_class = PROVIDERS.get(provider)

    if provider_class is None:
        raise ValueError(
            f"Unsupported LLM provider: {provider}"
        )

    return provider_class.list_models()