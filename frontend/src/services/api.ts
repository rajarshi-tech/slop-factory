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

export interface ApiKeyStatus {
  youtube_key_set: boolean;
  gemini_key_set: boolean;
}

export interface YouTubeOAuthClientConfig {
  configured: boolean;
  client_id: string;
  redirect_uri: string;
}

export interface VideoMetadata {
  id?: string;
  title?: string;
  channel?: {
    name?: string;
    id?: string;
    subscriber_count?: number;
  };
  url?: string;
  published_at?: string;
  statistics?: {
    views?: number;
    likes?: number;
    comments?: number;
  };
  details?: {
    duration?: number;
  };
  pipeline?: Record<string, boolean>;
  trend_score?: number;
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
  metadata?: VideoMetadata;
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

export interface ArchiveResponse {
  status: string;
  archived_count: number;
  video_ids: string[];
  message: string;
}

export interface UnarchiveResponse {
  status: string;
  unarchived_count: number;
  video_ids: string[];
  message: string;
}

export interface DeleteJobsResponse {
  status: string;
  deleted_count: number;
  video_ids: string[];
  message: string;
}

export interface Clip {
  id: string;
  filename: string;
  url: string;
  title: string;
  start?: number;
  end?: number;
  score?: number;
  summary?: string;
}

export interface JobClipsResponse {
  video_id: string;
  clips: Clip[];
  count: number;
}

export interface ProcessResponse {
  [videoId: string]: string;
}

export interface UploadChannel {
  id: string;
  name: string;
}

export interface UploadScheduleRequest {
  video_ids: string[];
  channel_id: string;
  videos_per_day: number;
  start_date: string;
  start_time: string;
  timezone: string;
}

export interface UploadScheduleItem {
  source_video_id: string;
  clip_id: string;
  clip_filename: string;
  title: string;
  channel_name: string;
  scheduled_publish_at: string;
  display_publish_at: string;
  timezone: string;
  slot_number: number;
  day_number: number;
}

export interface UploadPreviewResponse {
  clip_count: number;
  schedule: UploadScheduleItem[];
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
  const response = await client.get('/api/config/search/params/options');
  return response.data;
};

export const updateLLMConfig = async (config: LLMConfig): Promise<LLMConfig> => {
  const response = await client.put('/api/config/llm/configure', config);
  return response.data;
};

export const updateSearchParams = async (params: SearchParams): Promise<SearchParams> => {
  const response = await client.put('/api/config/search/params', params);
  return response.data;
};

// API Keys
export const checkApiKeys = async (): Promise<ApiKeyStatus> => {
  const response = await client.get('/api/config/check-keys');
  return response.data;
};

export const setApiKeys = async (keys: { youtube_key: string; gemini_key: string }): Promise<{ message: string }> => {
  const response = await client.post('/api/config/set-keys', keys);
  return response.data;
};

export const getYouTubeOAuthClientConfig = async (): Promise<YouTubeOAuthClientConfig> => {
  const response = await client.get('/auth/youtube/client-config');
  return response.data;
};

export const setYouTubeOAuthClientConfig = async (config: {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
}): Promise<{ message: string }> => {
  const response = await client.put('/auth/youtube/client-config', config);
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

export const archiveJobs = async (videoIds: string[]): Promise<ArchiveResponse> => {
  const response = await client.post('/api/jobs/archive', { video_ids: videoIds });
  return response.data;
};

export const unarchiveJobs = async (videoIds: string[]): Promise<UnarchiveResponse> => {
  const response = await client.post('/api/jobs/unarchive', { video_ids: videoIds });
  return response.data;
};

export const deleteJobs = async (videoIds: string[]): Promise<DeleteJobsResponse> => {
  const response = await client.post('/api/jobs/delete', { video_ids: videoIds });
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

// Processing & Clips
export const processVideos = async (videoIds: string[]): Promise<ProcessResponse> => {
  const response = await client.post('/api/process', { video_ids: videoIds });
  return response.data;
};

export const getJobClips = async (videoId: string): Promise<JobClipsResponse> => {
  const response = await client.get(`/api/jobs/${videoId}/clips`);
  return response.data;
};

// Scheduled YouTube uploads
export const getUploadChannels = async (): Promise<{ channels: UploadChannel[] }> => {
  const response = await client.get('/api/uploads/channels');
  return response.data;
};

export const removeUploadChannel = async (channelId: string): Promise<{ message: string }> => {
  const response = await client.delete(`/api/uploads/channels/${channelId}`);
  return response.data;
};

export const getYouTubeOAuthStatus = async (): Promise<{ configured: boolean }> => {
  const response = await client.get('/auth/youtube/status');
  return response.data;
};

export const uploadYouTubeClientSecret = async (file: File): Promise<{ message: string }> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await client.post('/auth/youtube/client-secret', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const previewUploadSchedule = async (request: UploadScheduleRequest): Promise<UploadPreviewResponse> => {
  const response = await client.post('/api/uploads/preview', request);
  return response.data;
};

export const createScheduledUploads = async (request: UploadScheduleRequest): Promise<{ upload_count: number; message: string }> => {
  const response = await client.post('/api/uploads', request);
  return response.data;
};

export default client;
