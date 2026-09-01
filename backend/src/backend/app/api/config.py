import json
import os

from fastapi import APIRouter, HTTPException
import ollama
from google import genai

from app.llm.factory import get_provider_models
from app.utils.storage import youtube_params_dir
from app.core.config import GEMINI_API_KEY


router = APIRouter()

config_dir = str(youtube_params_dir() / 'config.json')

def load_config():
    """Load configuration with error handling"""
    try:
        with open(config_dir, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        # Create default config if it doesn't exist
        default_config = {
            "llm": {
                "provider": None,
                "model": None
            },
            "details": {
                "llm": {
                    "provider": {}
                }
            }
        }
        youtube_params_dir().mkdir(parents=True, exist_ok=True)
        with open(config_dir, "w", encoding="utf-8") as f:
            json.dump(default_config, f, indent=2)
        return default_config
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Invalid JSON in config.json")

@router.get("")
def get_config():
    return load_config()

@router.put("")
def update_config(new_llm_settings: dict):
    config = load_config()
        
    # Update active selections safely
    config["llm"]["provider"] = new_llm_settings.get("provider")
    config["llm"]["model"] = new_llm_settings.get("model")
    
    with open(config_dir, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
        
    # Return full config so frontend state stays perfectly synced
    return config


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
    if not GEMINI_API_KEY:
        return {
            "available": False,
            "status": "Gemini API key is not configured in .env file"
        }
    
    try:
        # Try to initialize client to verify API key
        client = genai.Client(api_key=GEMINI_API_KEY)
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


@router.get("/provider")
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
    try:
        with open(config_dir, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update config: {str(e)}")
    
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


@router.get("/llm")
def refreshModels():
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
    try:
        with open(config_dir, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save config: {str(e)}")
    
    response = {
        "llm": config["details"]["llm"]
    }
    
    if errors:
        response["errors"] = errors
        response["message"] = "Some providers failed to fetch models and were removed from config"
    
    return response