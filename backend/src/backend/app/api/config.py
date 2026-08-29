from fastapi import APIRouter


router = APIRouter()


@router.get("")
def get_config():
    return {
        "llm": {
            "provider": "ollama",
            "model": "qwen3:8b",
        },
        "whisper": {
            "model": "large-v3",
        },
    }