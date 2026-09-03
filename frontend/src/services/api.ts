/**
 * API Service for communicating with the backend config routes
 * All API calls to the backend are centralized here
 */

import axios from 'axios';

// Base URL for the backend API
const API_BASE_URL = 'http://localhost:8000/api/config';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Interface definitions for type safety
 */

// Provider availability status
export interface ProviderStatus {
  available: boolean;
  status: string;
}

// Provider check response
export interface ProvidersResponse {
  providers: {
    ollama: ProviderStatus;
    gemini: ProviderStatus;
  };
  available_count: number;
  available_providers: string[];
  config_updated: boolean;
}

// Model structure
export interface ModelsResponse {
  llm: {
    provider: {
      [key: string]: {
        models: string[];
      };
    };
  };
  errors?: string[];
  message?: string;
}

// Parameter options from backend
export interface ParamOptions {
  order: string[];
  maxResults: {
    min: number;
    max: number;
    default: number;
  };
  videoCaption: string[];
  videoCategoryId: Array<{ id: string; name: string }>;
  videoDefinition: string[];
  videoDimension: string[];
  videoDuration: string[];
  videoEmbeddable: string[];
  videoLicense: string[];
  videoSyndicated: string[];
  videoType: string[];
  safeSearch: string[];
}

// Search parameters
export interface SearchParams {
  q: string;
  order: string;
  publishedAfter: string | null;
  publishedBefore: string | null;
  maxResults: number;
  videoCaption: string;
  videoCategoryId: string | null;
  videoDefinition: string;
  videoDimension: string;
  videoDuration: string;
  videoEmbeddable: string;
  videoLicense: string;
  videoSyndicated: string;
  videoType: string;
  safeSearch: string;
}

// LLM configuration
export interface LLMConfig {
  provider: string | null;
  model: string | null;
}

// Full config response
export interface FullConfig {
  details: {
    llm: {
      provider: {
        [key: string]: {
          models: string[];
        };
      };
    };
    params: ParamOptions;
  };
  llm: LLMConfig;
  params: SearchParams;
}

/**
 * API Functions
 */

/**
 * Get the full configuration from backend
 */
export const getConfig = async (): Promise<FullConfig> => {
  const response = await api.get('');
  return response.data;
};

/**
 * Check available providers (Ollama, Gemini)
 * This updates the config.json to only include available providers
 */
export const checkProviders = async (): Promise<ProvidersResponse> => {
  const response = await api.get('/llm/providers');
  return response.data;
};

/**
 * Check available models for all available providers
 * This fetches models from each provider and updates config.json
 */
export const checkModels = async (): Promise<ModelsResponse> => {
  const response = await api.get('/llm/models');
  return response.data;
};

/**
 * Get parameter options (available choices for each parameter)
 */
export const getParamOptions = async (): Promise<ParamOptions> => {
  const response = await api.get('/llm/params/options');
  return response.data;
};

/**
 * Update LLM configuration (provider and model selection)
 */
export const updateLLMConfig = async (config: LLMConfig): Promise<LLMConfig> => {
  const response = await api.put('/llm/configure', config);
  return response.data;
};

/**
 * Update search parameters
 */
export const updateSearchParams = async (params: SearchParams): Promise<SearchParams> => {
  const response = await api.put('/llm/params', params);
  return response.data;
};

export default api;
