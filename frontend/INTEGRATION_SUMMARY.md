# Slop Factory - Frontend & Backend Integration

## Project Summary

A YouTube search application with AI-powered analysis. The frontend allows users to configure LLM providers/models and search parameters, then submit searches to the backend.

## What Was Created

### Frontend Components (React + TypeScript + Tailwind)

1. **API Service** (`frontend/src/services/api.ts`)
   - Centralized API calls to backend
   - Type-safe interfaces for all data structures
   - Endpoints: config, providers, models, params

2. **SearchBar Component** (`frontend/src/components/SearchBar.tsx`)
   - Search input field
   - Submit button with loading state
   - Triggers search with current parameters

3. **ConfigSection Component** (`frontend/src/components/ConfigSection.tsx`)
   - Checks available providers (Ollama, Gemini)
   - Fetches available models from each provider
   - Allows user to select and apply provider/model configuration
   - Refresh button to reload providers and models

4. **ParamControls Component** (`frontend/src/components/ParamControls.tsx`)
   - All YouTube search parameters configurable:
     - order, maxResults, videoCaption, videoCategoryId
     - videoDefinition, videoDimension, videoDuration
     - videoEmbeddable, videoLicense, videoSyndicated
     - videoType, safeSearch, publishedAfter, publishedBefore
   - Uses appropriate input types (select, number, datetime-local)
   - Default values pre-filled from backend

5. **App Component** (`frontend/src/App.tsx`)
   - Main integration point
   - Layout: Search bar at top, config and params side-by-side
   - Manages application state
   - Loads initial config from backend
   - Sends complete params with search query

### Backend Updates

1. **CORS Configuration** (`backend/src/backend/app/main.py`)
   - Added `http://localhost:5173` for Vite dev server

2. **Config Routes** (`backend/src/backend/app/api/config.py`)
   - Already had all necessary routes:
     - `GET /api/config` - Full configuration
     - `GET /api/config/llm/providers` - Check providers
     - `GET /api/config/llm/models` - Fetch models
     - `GET /api/config/llm/params/options` - Param options
     - `PUT /api/config/llm/configure` - Update LLM config
     - `PUT /api/config/llm/params` - Update search params

## How It Works

### On Load
1. Frontend fetches full config from `GET /api/config`
2. Displays default values for all parameters
3. Shows current provider/model selection (if any)

### Provider/Model Selection
1. User clicks "Refresh Providers & Models"
2. Frontend calls `GET /api/config/llm/providers`
   - Backend checks if Ollama is running
   - Backend checks if Gemini API key is configured
   - Updates config.json with available providers
3. Frontend calls `GET /api/config/llm/models`
   - Backend fetches models from each available provider
   - Updates config.json with model lists
4. User selects provider from dropdown
5. User selects model from available models
6. User clicks "Apply Configuration"
7. Frontend calls `PUT /api/config/llm/configure` with selection

### Search Flow
1. User modifies any search parameters (optional)
   - All changes are tracked in state
   - Default values already loaded from backend
2. User enters search query in search bar
3. User clicks "Search"
4. Frontend calls `PUT /api/config/llm/params` with all parameters + query
   - Backend saves to config.json
5. Ready for backend to process search (not yet implemented)

## Running the Application

### Backend
```bash
cd backend
# Activate virtual environment if needed
# Start the server (assuming uvicorn or similar)
uvicorn app.main:app --reload
```
Backend runs on: `http://localhost:8000`

### Frontend
```bash
cd frontend
npm run dev
```
Frontend runs on: `http://localhost:5173`

## File Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── ConfigSection.tsx    # Provider/model selection
│   │   ├── ParamControls.tsx    # Search parameters
│   │   └── SearchBar.tsx        # Search input
│   ├── services/
│   │   └── api.ts               # API client
│   ├── App.tsx                  # Main app
│   ├── main.tsx                 # Entry point
│   ├── App.css                  # Styles
│   └── index.css                # Tailwind imports
├── package.json
└── README.md

backend/
└── src/backend/app/
    ├── api/
    │   └── config.py            # Config routes
    └── main.py                  # FastAPI app with CORS
```

## Next Steps

To complete the search functionality:
1. Add a backend endpoint to actually perform the YouTube search
2. Display search results in the frontend
3. Add loading states and error handling for search results
4. Potentially add AI analysis display for the results

## Notes

- Frontend uses TypeScript with strict type checking
- All comments are included in components
- Tailwind CSS used for styling
- Axios for HTTP requests
- Backend config.json stores all configuration
- Default values are loaded from backend on mount
- Build successful with no errors
