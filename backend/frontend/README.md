# YouTube Search Frontend

Frontend application for YouTube search with AI-powered analysis.

## Features

1. **Provider & Model Selection**
   - Automatically checks for available providers (Ollama, Gemini)
   - Fetches available models from each provider
   - Allows user to select provider and model

2. **Search Parameters Configuration**
   - Order: date, rating, relevance, title, videoCount, viewCount
   - Max Results: 1-50 (default: 10)
   - Video Caption: any, closedCaption, none
   - Video Category: All YouTube categories
   - Video Definition: any, high, standard
   - Video Dimension: 2d, 3d, any
   - Video Duration: any, long, medium, short
   - Video Embeddable: any, true
   - Video License: any, creativeCommon, youtube
   - Video Syndicated: any, true
   - Video Type: any, episode, movie
   - Safe Search: moderate, none, strict
   - Published After/Before: Date/time filters

3. **Search Bar**
   - Enter search query
   - Submits query with all configured parameters

## Tech Stack

- React 19 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Axios for API calls

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the dev server:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173`

## Backend Integration

The frontend expects the backend API to be running on `http://localhost:8000`

### API Endpoints Used

- `GET /api/config` - Get full configuration
- `GET /api/config/llm/providers` - Check available providers
- `GET /api/config/llm/models` - Get available models
- `GET /api/config/llm/params/options` - Get parameter options
- `PUT /api/config/llm/configure` - Update provider/model selection
- `PUT /api/config/llm/params` - Update search parameters

## Usage Flow

1. On load, the app fetches the current configuration from backend
2. User clicks "Refresh Providers & Models" to check availability
3. User selects a provider from the dropdown
4. User selects a model from the available models
5. User clicks "Apply Configuration" to save the selection
6. User modifies search parameters as needed (default values are pre-filled)
7. User enters a search query and clicks "Search"
8. All parameters are sent to the backend along with the search query

## Component Structure

```
src/
├── App.tsx                      # Main app component
├── components/
│   ├── SearchBar.tsx           # Search input and submit button
│   ├── ConfigSection.tsx       # Provider and model selection
│   └── ParamControls.tsx       # Search parameter controls
├── services/
│   └── api.ts                  # API service with all backend calls
├── main.tsx                    # Entry point
└── index.css                   # Tailwind styles
```

## Development

- Linting: `npm run lint`
- Build: `npm run build`
- Preview production build: `npm run preview`
