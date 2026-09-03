import json

from fastapi import APIRouter, HTTPException
import ollama
from google import genai

from app.llm.factory import get_provider_models
from app.utils.storage import youtube_config_dir
from app.core.config import GEMINI_API_KEY


router = APIRouter()

config_dir = str(youtube_config_dir() / 'config.json')

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
            },
            "params": {
            },
            "params_options": {
                "order": [
                    "date",
                    "rating",
                    "relevance",
                    "title",
                    "videoCount",
                    "viewCount"
                ],
                "maxResults": [
                    "1",
                    "2",
                    "3",
                    "4",
                    "5",
                    "6",
                    "7",
                    "8",
                    "9",
                    "10",
                    "11",
                    "12",
                    "13",
                    "14",
                    "15",
                    "16",
                    "17",
                    "18",
                    "19",
                    "20",
                    "21",
                    "22",
                    "23",
                    "24",
                    "25",
                    "26",
                    "27",
                    "28",
                    "29",
                    "30",
                    "31",
                    "32",
                    "33",
                    "34",
                    "35",
                    "36",
                    "37",
                    "38",
                    "39",
                    "40",
                    "41",
                    "42",
                    "43",
                    "44",
                    "45",
                    "46",
                    "47",
                    "48",
                    "49",
                    "50"
                ],
                "type": [
                    "channel",
                    "playlist",
                    "video"
                ],
                "videoCaption": [
                    "any",
                    "closedCaption",
                    "none"
                ],
                "videoCategoryId": "string (e.g. '10' for Music, '20' for Gaming)",
                "videoDefinition": [
                    "any",
                    "high",
                    "standard"
                ],
                "videoDimension": [
                    "2d",
                    "3d",
                    "any"
                ],
                "videoDuration": [
                    "any",
                    "long",
                    "medium",
                    "short"
                ],
                "videoEmbeddable": [
                    "any",
                    "true"
                ],
                "videoLicense": [
                    "any",
                    "creativeCommon",
                    "youtube"
                ],
                "videoSyndicated": [
                    "any",
                    "true"
                ],
                "videoType": [
                    "any",
                    "episode",
                    "movie"
                ],
                "safeSearch": [
                    "moderate",
                    "none",
                    "strict"
                ],
                "eventType": [
                    "completed",
                    "live",
                    "upcoming"
                ]
            }
        }

        youtube_config_dir().mkdir(parents=True, exist_ok=True)
        with open(config_dir, "w", encoding="utf-8") as f:
            json.dump(default_config, f, indent=2)
        return default_config
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Invalid JSON in config.json")


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
            "status": "Gemini API key is not configured"
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



#return full config file
@router.get("")
def get_config():
    return load_config()


#set ai model and provider
@router.put("/llm/configure")
def update_config(new_llm_settings: dict):
    config = load_config()
        
    # Update active selections safely
    config["llm"]["provider"] = new_llm_settings.get("provider")
    config["llm"]["model"] = new_llm_settings.get("model")
    
    with open(config_dir, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
        
    return config["llm"]


#check ai providers
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


#check ai models
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


#get applicable param options
@router.get("/llm/params/options")
def get_param_options():
    config = load_config()
    return config["details"]["params"]


@router.put("/llm/params")
def set_patams(params: dict):
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
    config["params"]["eventType"] = params.get("eventType")

    with open(config_dir, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)

    return config["params"]