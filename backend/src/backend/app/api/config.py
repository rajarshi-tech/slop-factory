import json
import os
from pathlib import Path
from dotenv import load_dotenv, set_key

from fastapi import APIRouter, HTTPException
import ollama
from google import genai

from app.llm.factory import get_provider_models
from app.utils.storage import load_config, save_config
from app.core.config import ROOT_DIR, get_gemini_api_key


router = APIRouter()


def check_ollama_availability() -> dict:
    """Check if Ollama server is running and accessible"""
    try:
        # Try to list models to verify Ollama is running
        ollama.list()
        return {
            "available": True,
            "status": "Ollama server is running and accessible"
        }
    except Exception as e:
        return {
            "available": False,
            "status": f"Ollama server is not running or not accessible: {str(e)}"
        }


def check_gemini_availability() -> dict:
    """Check if Gemini API key is configured and valid"""
    gemini_api_key = get_gemini_api_key()
    if not gemini_api_key or not gemini_api_key.strip():
        return {
            "available": False,
            "status": "Gemini API key is not configured"
        }

    try:
        # Try to initialize client to verify API key
        client = genai.Client(api_key=gemini_api_key)
        # Try to list models to verify the API key is valid
        models = list(client.models.list())
        return {
            "available": True,
            "status": f"Gemini API key is valid ({len(models)} models available)"
        }
    except Exception as e:
        return {
            "available": False,
            "status": f"Gemini API key is invalid or service unavailable: {str(e)}"
        }


# return full config file
@router.get("")
def get_config():
    return load_config()


# set ai model and provider
@router.put("/llm/configure")
def update_config(new_llm_settings: dict):
    config = load_config()

    # Update active selections safely
    config["llm"]["provider"] = new_llm_settings.get("provider")
    config["llm"]["model"] = new_llm_settings.get("model")

    save_config(config)

    return config["llm"]


# check ai providers
@router.get("/llm/providers")
def check_providers():
    """
    Check availability of LLM providers and update config.json
    Returns status of each provider and updates config to only include available ones
    """
    # Check each provider
    ollama_status = check_ollama_availability()
    gemini_status = check_gemini_availability()

    # Load current config
    config = load_config()

    # Ensure the structure exists
    if "details" not in config:
        config["details"] = {}
    if "llm" not in config["details"]:
        config["details"]["llm"] = {}
    if "provider" not in config["details"]["llm"]:
        config["details"]["llm"]["provider"] = {}

    # Update config with only available providers
    available_providers = {}

    if ollama_status["available"]:
        available_providers["ollama"] = {
            "models": []
        }

    if gemini_status["available"]:
        available_providers["gemini"] = {
            "models": []
        }

    # Update the config
    config["details"]["llm"]["provider"] = available_providers

    # Reset active provider if it's no longer available
    if config.get("llm", {}).get("provider") not in available_providers:
        config["llm"]["provider"] = None
        config["llm"]["model"] = None

    # Save updated config
    save_config(config)

    # Return status information
    return {
        "providers": {
            "ollama": ollama_status,
            "gemini": gemini_status
        },
        "available_count": len(available_providers),
        "available_providers": list(available_providers.keys()),
        "config_updated": True
    }


# check ai models
@router.get("/llm/models")
def check_models():
    config = load_config()

    # Ensure proper structure exists
    if "details" not in config or "llm" not in config["details"] or "provider" not in config["details"]["llm"]:
        raise HTTPException(
            status_code=400,
            detail="Configuration not initialized. Please call /api/config/provider first to check provider availability."
        )

    providers = list(config["details"]["llm"]["provider"].keys())

    if not providers:
        raise HTTPException(
            status_code=400,
            detail="No providers available. Please call /api/config/provider to check provider availability."
        )

    errors = []
    for provider in providers:
        try:
            models = get_provider_models(provider)
            config["details"]["llm"]["provider"][provider]["models"] = models
        except Exception as e:
            errors.append(f"{provider}: {str(e)}")
            # Remove provider from config if it fails
            config["details"]["llm"]["provider"].pop(provider, None)

    # Save updated config
    save_config(config)

    response = {
        "llm": config["details"]["llm"]
    }

    if errors:
        response["errors"] = errors
        response["message"] = "Some providers failed to fetch models and were removed from config"

    return response


# get applicable param options
@router.get("/search/params/options")
def get_param_options():
    config = load_config()
    return config["details"]["params"]


# set all param options
@router.put("/search/params")
def set_params(params: dict):
    config = load_config()
    config["params"]["q"] = params.get("q")
    config["params"]["order"] = params.get("order")
    config["params"]["publishedAfter"] = params.get("publishedAfter")
    config["params"]["publishedBefore"] = params.get("publishedBefore")
    config["params"]["maxResults"] = params.get("maxResults")
    config["params"]["videoCaption"] = params.get("videoCaption")
    config["params"]["videoCategoryId"] = params.get("videoCategoryId")
    config["params"]["videoDefinition"] = params.get("videoDefinition")
    config["params"]["videoDimension"] = params.get("videoDimension")
    config["params"]["videoDuration"] = params.get("videoDuration")
    config["params"]["videoEmbeddable"] = params.get("videoEmbeddable")
    config["params"]["videoLicense"] = params.get("videoLicense")
    config["params"]["videoSyndicated"] = params.get("videoSyndicated")
    config["params"]["videoType"] = params.get("videoType")
    config["params"]["safeSearch"] = params.get("safeSearch")

    save_config(config)

    return config["params"]


# check api keys
@router.get("/check-keys")
def check_keys():
    env_path = ROOT_DIR / ".env"
    if not env_path.exists():
        return {"youtube_key_set": False, "gemini_key_set": False}

    load_dotenv(env_path)
    youtube_key = os.getenv("YOUTUBE_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY")

    return {
        "youtube_key_set": bool(youtube_key and youtube_key.strip()),
        "gemini_key_set": bool(gemini_key and gemini_key.strip())
    }


# set api keys
@router.post("/set-keys")
def set_api_keys(keys: dict):
    youtube_key = keys.get("youtube_key", "").strip()
    gemini_key = keys.get("gemini_key", "").strip()

    if not youtube_key:
        raise HTTPException(status_code=400, detail="YouTube API key is required")

    env_path = ROOT_DIR / ".env"
    if not env_path.exists():
        env_path.touch()

    set_key(env_path, "YOUTUBE_API_KEY", youtube_key)
    set_key(env_path, "GEMINI_API_KEY", gemini_key if gemini_key else "")

    # python-dotenv writes the file but does not update this running process.
    # Keep the process environment in sync so provider discovery works before a
    # development server reload (and when reload is disabled).
    os.environ["YOUTUBE_API_KEY"] = youtube_key
    os.environ["GEMINI_API_KEY"] = gemini_key

    # Touch the main.py to trigger a reload (if using --reload)
    main_py = ROOT_DIR / "backend" / "src" / "backend" / "app" / "main.py"
    main_py.touch()

    return {"message": "API keys saved successfully. The server will restart to apply the changes."}
