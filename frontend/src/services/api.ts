/**
 * API Service for Slop Factory Frontend
 * Centralizes all REST endpoints and WebSocket definitions.
 */

import axios from 'axios';

// Base URLs
export const API_BASE_URL = 'http://localhost:8000';
export const WS_BASE_URL = 'ws://localhost:8000';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Type Definitions
 */

export interface ProviderStatus {
  available: boolean;
  status: string;
}

export interface ProvidersResponse {
  providers: {
    ollama: ProviderStatus;
    gemini: ProviderStatus;
  };
  available_count: number;
  available_providers: string[];
  config_updated: boolean;
}

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

export interface LLMConfig {
  provider: string | null;
  model: string | null;
}

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

export interface Job {
  id: number;
  video_id: string;
  title: string | null;
  channel: string | null;
  source: 'search' | 'direct_url' | string;
  trend_score: number | null;
  job_status: 'queued' | 'downloading' | 'downloaded' | 'transcribing' | 'generating_clips' | 'completed' | 'failed' | string;
  processing_state: 'pending' | 'processed' | 'rejected' | 'failed' | string;
  video_state: 'in_queue' | 'active' | 'archived' | string;
  progress: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface SearchResponse {
  jobs: Job[];
  count: number;
  errors?: string[];
  message?: string;
}

export interface DirectURLResponse {
  job: Job;
  message: string;
  created: boolean;
}

export interface CalculatedVideo {
  video_id: string;
  title: string;
  channel: string;
  source?: string;
  trend_score: number;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  subscriber_count?: number;
  age_hours?: number;
  job?: Job;
}

export interface TrendCalculateResponse {
  status: string;
  calculated_count: number;
  jobs: CalculatedVideo[];
  message: string;
  errors?: string[];
}

export interface UncalculatedTrendsResponse {
  uncalculated_count: number;
  source: string;
  jobs: Job[];
}

export interface HealthResponse {
  status: string;
}

/**
 * API Methods
 */

// Health
export const checkHealth = async (): Promise<HealthResponse> => {
  const response = await client.get('/api/health');
  return response.data;
};

// Config
export const getConfig = async (): Promise<FullConfig> => {
  const response = await client.get('/api/config');
  return response.data;
};

export const checkProviders = async (): Promise<ProvidersResponse> => {
  const response = await client.get('/api/config/llm/providers');
  return response.data;
};

export const checkModels = async (): Promise<ModelsResponse> => {
  const response = await client.get('/api/config/llm/models');
  return response.data;
};

export const getParamOptions = async (): Promise<ParamOptions> => {
  const response = await client.get('/api/config/llm/params/options');
  return response.data;
};

export const updateLLMConfig = async (config: LLMConfig): Promise<LLMConfig> => {
  const response = await client.put('/api/config/llm/configure', config);
  return response.data;
};

export const updateSearchParams = async (params: SearchParams): Promise<SearchParams> => {
  const response = await client.put('/api/config/llm/params', params);
  return response.data;
};

// Search (Ingestion Method 1)
export const searchVideos = async (
  q: string,
  overrideParams?: Partial<SearchParams>
): Promise<SearchResponse> => {
  const response = await client.post('/api/search', {
    q,
    overrideParams,
  });
  return response.data;
};

// Direct URL (Ingestion Method 2)
export const createJobFromUrl = async (url: string): Promise<DirectURLResponse> => {
  const response = await client.post('/api/jobs', { url });
  return response.data;
};

// Job Queue
export const getJobs = async (): Promise<{ jobs: Job[]; count: number }> => {
  const response = await client.get('/api/jobs');
  return response.data;
};

export const getJobById = async (videoId: string): Promise<Job> => {
  const response = await client.get(`/api/jobs/${videoId}`);
  return response.data;
};

// Trend Calculation
export const getUncalculatedTrends = async (
  source: string = 'search'
): Promise<UncalculatedTrendsResponse> => {
  const response = await client.get('/api/trend/uncalculated', {
    params: { source },
  });
  return response.data;
};

export const calculateTrends = async (
  source: string = 'search',
  video_ids?: string[]
): Promise<TrendCalculateResponse> => {
  const response = await client.post('/api/trend/calculate', {
    source,
    video_ids,
  });
  return response.data;
};

export default client;
