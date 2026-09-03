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
            "details": {
                "llm": {
                    "provider": {
                        "ollama": {
                            "models": [
                                "qwen3:8b"
                            ]
                        },
                        "gemini": {
                            "models": [
                                "models/gemini-2.5-flash",
                                "models/gemini-2.5-pro",
                                "models/gemini-2.5-flash-preview-tts",
                                "models/gemini-2.5-pro-preview-tts",
                                "models/gemma-4-26b-a4b-it",
                                "models/gemma-4-31b-it",
                                "models/gemini-flash-latest",
                                "models/gemini-flash-lite-latest",
                                "models/gemini-pro-latest",
                                "models/gemini-2.5-flash-lite",
                                "models/gemini-2.5-flash-image",
                                "models/gemini-3-flash-preview",
                                "models/gemini-3.1-pro-preview",
                                "models/gemini-3.1-pro-preview-customtools",
                                "models/gemini-3.1-flash-lite-preview",
                                "models/gemini-3.1-flash-lite",
                                "models/gemini-3-pro-image-preview",
                                "models/gemini-3-pro-image",
                                "models/nano-banana-pro-preview",
                                "models/gemini-3.1-flash-image-preview",
                                "models/gemini-3.1-flash-image",
                                "models/gemini-3.1-flash-lite-image",
                                "models/gemini-3.5-flash",
                                "models/gemini-3.5-flash-lite",
                                "models/gemini-omni-flash-preview",
                                "models/gemini-omni-1.1-flash",
                                "models/gemini-3.5-transcribe",
                                "models/gemini-3.6-flash",
                                "models/gemini-3.7-flash",
                                "models/lyria-3-clip-preview",
                                "models/lyria-3-pro-preview",
                                "models/gemini-3.1-flash-tts-preview",
                                "models/gemini-robotics-er-2-preview",
                                "models/gemini-2.5-computer-use-preview-10-2025",
                                "models/antigravity-preview-05-2026",
                                "models/deep-research-max-preview-04-2026",
                                "models/deep-research-preview-04-2026",
                                "models/deep-research-pro-preview-12-2025"
                            ]
                        }
                    }
                    },
                "params": {
                    "order": [
                        "date",
                        "rating",
                        "relevance",
                        "title",
                        "videoCount",
                        "viewCount"
                    ],
                    "maxResults": {
                        "min": 1,
                        "max": 50,
                        "default": 10
                    },
                    "videoCaption": [
                        "any",
                        "closedCaption",
                        "none"
                    ],
                    "videoCategoryId": [
                        { "id": "1", "name": "Film & Animation" },
                        { "id": "2", "name": "Autos & Vehicles" },
                        { "id": "10", "name": "Music" },
                        { "id": "15", "name": "Pets & Animals" },
                        { "id": "17", "name": "Sports" },
                        { "id": "18", "name": "Short Movies" },
                        { "id": "19", "name": "Travel & Events" },
                        { "id": "20", "name": "Gaming" },
                        { "id": "21", "name": "Videoblogging" },
                        { "id": "22", "name": "People & Blogs" },
                        { "id": "23", "name": "Comedy" },
                        { "id": "24", "name": "Entertainment" },
                        { "id": "25", "name": "News & Politics" },
                        { "id": "26", "name": "Howto & Style" },
                        { "id": "27", "name": "Education" },
                        { "id": "28", "name": "Science & Technology" },
                        { "id": "29", "name": "Nonprofits & Activism" },
                        { "id": "30", "name": "Movies" },
                        { "id": "31", "name": "Anime/Animation" },
                        { "id": "32", "name": "Action/Adventure" },
                        { "id": "33", "name": "Classics" },
                        { "id": "34", "name": "Comedy" },
                        { "id": "35", "name": "Documentary" },
                        { "id": "36", "name": "Drama" },
                        { "id": "37", "name": "Family" },
                        { "id": "38", "name": "Foreign" },
                        { "id": "39", "name": "Horror" },
                        { "id": "40", "name": "Sci-Fi/Fantasy" },
                        { "id": "41", "name": "Thriller" },
                        { "id": "42", "name": "Shorts" },
                        { "id": "43", "name": "Shows" },
                        { "id": "44", "name": "Trailers" }
                    ],
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
                }
            },
            "llm": {
                "provider": None,
                "model": None
            },
            "params": {
                "q": "life without the internet",
                "order": "viewCount",
                "publishedAfter": None,
                "publishedBefore": None,
                "maxResults": 10,
                "videoCaption": "closedCaption",
                "videoCategoryId": None,
                "videoDefinition": "any",
                "videoDimension": "any",
                "videoDuration": "medium",
                "videoEmbeddable": "any",
                "videoLicense": "any",
                "videoSyndicated": "any",
                "videoType": "any",
                "safeSearch": "moderate",
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


#set all param options
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

    with open(config_dir, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)

    return config["params"]