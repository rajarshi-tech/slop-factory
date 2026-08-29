import json

from fastapi import APIRouter

from app.utils.storage import youtube_params_dir


router = APIRouter()

config_dir = str(youtube_params_dir() / 'config.json')
with open(config_dir, "r", encoding="utf-8") as f:
    config = json.load(f)

@router.get("")
def get_config():
    return config

@router.put("")
def update_config(new_llm_settings: dict):
    with open(config_dir, "r", encoding="utf-8") as f:
        config = json.load(f)
        
    # Update active selections safely
    config["llm"]["provider"] = new_llm_settings.get("provider")
    config["llm"]["model"] = new_llm_settings.get("model")
    
    with open(config_dir, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
        
    # Return full config so frontend state stays perfectly synced
    return config