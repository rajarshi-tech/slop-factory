import { useEffect, useState } from 'react';
import { checkProviders, checkModels, updateLLMConfig, checkApiKeys, setApiKeys } from '../services/api';
import type { LLMConfig, ModelsResponse, ApiKeyStatus } from '../services/api';
import ApiKeyPopup from './ApiKeyPopup';

interface ConfigSectionProps {
  onConfigUpdate: (config: LLMConfig) => void;
  currentConfig: LLMConfig;
}

const ConfigSection = ({ onConfigUpdate, currentConfig }: ConfigSectionProps) => {
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<{ [key: string]: string[] }>({});
  const [selectedProvider, setSelectedProvider] = useState<string | null>(currentConfig.provider);
  const [selectedModel, setSelectedModel] = useState<string | null>(currentConfig.model);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [showApiKeyPopup, setShowApiKeyPopup] = useState(false);
  const [youtubeKey, setYoutubeKey] = useState<string>('');
  const [geminiKey, setGeminiKey] = useState<string>('');
  const [isSavingApiKeys, setIsSavingApiKeys] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedProvider(currentConfig.provider);
    setSelectedModel(currentConfig.model);
  }, [currentConfig]);

  useEffect(() => {
    loadProvidersAndModels();
  }, []);

  useEffect(() => {
    checkInitialKeys();
  }, []);

  const checkInitialKeys = async () => {
    try {
      const keyStatus: ApiKeyStatus = await checkApiKeys();
      if (!keyStatus.youtube_key_set) {
        setShowApiKeyPopup(true);
      }
    } catch (err) {
      setShowApiKeyPopup(true);
    }
  };

  const loadProvidersAndModels = async () => {
    setIsLoading(true);
    setError(null);
    setStatusMessage('Checking AI providers...');

    try {
      const providersResponse = await checkProviders();
      setAvailableProviders(providersResponse.available_providers);

      if (providersResponse.available_providers.length === 0) {
        setError('No providers available. Ensure Ollama is running or Gemini API key is configured in .env');
        setIsLoading(false);
        return;
      }

      setStatusMessage('Fetching available models...');
      const modelsResponse: ModelsResponse = await checkModels();

      const models: { [key: string]: string[] } = {};
      for (const provider in modelsResponse.llm.provider) {
        models[provider] = modelsResponse.llm.provider[provider].models;
      }
      setAvailableModels(models);

      if (modelsResponse.errors && modelsResponse.errors.length > 0) {
        setStatusMessage(`Note: ${modelsResponse.message}`);
      } else {
        setStatusMessage('Providers & models ready');
      }
    } catch (err: unknown) {
      setError(`Failed to load LLM config: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    setSelectedModel(null);
  };

  const applyConfiguration = async () => {
    if (!selectedProvider || !selectedModel) {
      setError('Please select both a provider and a model');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const config: LLMConfig = {
        provider: selectedProvider,
        model: selectedModel,
      };

      await updateLLMConfig(config);
      onConfigUpdate(config);
      setStatusMessage('LLM configuration saved successfully!');
    } catch (err: unknown) {
      setError(`Failed to save config: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApiKeySubmit = async (youtubeKey: string, geminiKey: string) => {
    setIsSavingApiKeys(true);
    setApiKeyError(null);

    try {
      await setApiKeys({ youtube_key: youtubeKey, gemini_key: geminiKey || '' });
      setShowApiKeyPopup(false);
      setStatusMessage('API keys saved successfully! Server will restart.');
      await loadProvidersAndModels();
    } catch (err: unknown) {
      setApiKeyError(`Failed to save API keys: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSavingApiKeys(false);
    }
  };

  const openApiKeyPopup = async () => {
    setApiKeyError(null);
    setShowApiKeyPopup(true);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">LLM & AI Reasoning Provider</h2>
            <p className="text-xs text-slate-400">Configure local (Ollama) or Cloud (Gemini) models for video analysis.</p>
          </div>
        </div>

        <button
          onClick={loadProvidersAndModels}
          disabled={isLoading}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          <svg className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>

      {statusMessage && (
        <div className="p-3 bg-indigo-950/60 border border-indigo-800/80 text-indigo-300 rounded-xl text-xs flex items-center gap-2">
          <span>{statusMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-800/80 text-rose-300 rounded-xl text-xs flex items-center gap-2">
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Provider selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
            AI Provider
          </label>
          <select
            value={selectedProvider || ''}
            onChange={(e) => handleProviderChange(e.target.value)}
            disabled={isLoading || availableProviders.length === 0}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            <option value="">Select a provider</option>
            {availableProviders.map((provider) => (
              <option key={provider} value={provider}>
                {provider.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Model selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
            Model
          </label>
          <select
            value={selectedModel || ''}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={isLoading || !selectedProvider}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium disabled:opacity-50"
          >
            <option value="">{selectedProvider ? 'Select a model' : 'Select provider first'}</option>
            {selectedProvider &&
              availableModels[selectedProvider]?.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={openApiKeyPopup} className="px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-2xl border border-slate-700 transition-colors">
          Manage API Keys
        </button>
        <button
          onClick={applyConfiguration}
          disabled={isLoading || !selectedProvider || !selectedModel}
          className="flex-1 py-3.5 bg-linear-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          Save LLM Settings
        </button>
      </div>

      <ApiKeyPopup
        visible={showApiKeyPopup}
        onClose={() => setShowApiKeyPopup(false)}
        onSubmit={handleApiKeySubmit}
        youtubeKey={youtubeKey}
        setYoutubeKey={setYoutubeKey}
        geminiKey={geminiKey}
        setGeminiKey={setGeminiKey}
        isLoading={isSavingApiKeys}
        error={apiKeyError}
      />
    </div>
  );
};

export default ConfigSection;
