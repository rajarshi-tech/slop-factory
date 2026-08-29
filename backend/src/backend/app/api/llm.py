import json

from fastapi import APIRouter

from app.utils.storage import youtube_params_dir
from app.llm.factory import get_provider_models


router = APIRouter()

config_dir = str(youtube_params_dir() / "config.json")
with open(config_dir, "r", encoding="utf-8") as f:
    config = json.load(f)

providers = list(config["details"]["llm"]["provider"].keys())

@router.get("")
def refreshModels():
    for provider in providers:
        models = get_provider_models(provider)
        config["details"]["llm"]["provider"][provider]["models"] = models
    with open(config_dir, "w", encoding="utf-8") as f:
        json.dump(config, f)
    return config["details"]["llm"]