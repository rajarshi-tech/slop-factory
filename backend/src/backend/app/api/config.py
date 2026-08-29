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
def update_config(new_config: dict):
    with open(config_dir, "w", encoding="utf-8") as f:
        json.dump(new_config, f)
    return new_config