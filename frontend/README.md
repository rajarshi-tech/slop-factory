# Slop Factory Frontend

React 19 dashboard for searching and ingesting YouTube videos, ranking trends, processing clips, and scheduling uploads.

## Requirements

- Node.js 18 or newer
- The Slop Factory backend running at `http://localhost:8000`

## Install and Run

From this directory:

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`. Vite provides hot module replacement during development.

## Commands

```powershell
npm run dev       # Start the Vite development server
npm run build     # Type-check and create a production bundle
npm run lint      # Run ESLint
npm run preview   # Preview the production bundle locally
```

## Dashboard Areas

- **Ingestion** - Search YouTube with saved parameters or add a direct video URL.
- **Trend calculation** - Calculate scores for search results that have not been ranked.
- **Job queue** - Monitor job status and archive completed source videos.
- **Processing** - Download source media, transcribe with WhisperX, and generate clips with subtitle options.
- **Processed videos** - Review generated artifacts and prepare clips for upload.
- **YouTube channels** - Configure OAuth and manage connected upload channels.
- **Scheduling** - Preview and schedule generated clips at a selected rate, date, time, and timezone.
- **Settings** - Select LLM providers/models, edit search parameters, and provide missing API keys.

API requests are centralized in `src/services/api.ts`. The job queue also uses the backend WebSocket at `/ws/jobs` for pull-based snapshots.

## Backend Configuration

Start the backend before opening the dashboard:

```powershell
cd ..\backend
.venv\Scripts\Activate.ps1
fastapi dev src\backend\app\main.py
```

The frontend expects the backend at `http://localhost:8000`. If the backend uses another origin, update the API base URL in `src/services/api.ts` and add the origin to the backend CORS configuration.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
