/**
 * ConfigSection Component
 * Handles provider/model selection and displays current configuration
 * Separated from parameter controls for better organization
 */

import { useEffect, useState } from 'react';
import { checkProviders, checkModels, updateLLMConfig } from '../services/api';
import type { LLMConfig, ModelsResponse } from '../services/api';

interface ConfigSectionProps {
  onConfigUpdate: (config: LLMConfig) => void;
}

const ConfigSection = ({ onConfigUpdate }: ConfigSectionProps) => {
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<{ [key: string]: string[] }>({});
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  /**
   * Load providers and models on component mount
   */
  useEffect(() => {
    loadProvidersAndModels();
  }, []);

  /**
   * Check providers and then fetch models
   */
  const loadProvidersAndModels = async () => {
    setIsLoading(true);
    setError(null);
    setStatusMessage('Checking providers...');

    try {
      // Step 1: Check which providers are available
      const providersResponse = await checkProviders();
      setAvailableProviders(providersResponse.available_providers);
      setStatusMessage(`Found ${providersResponse.available_count} provider(s)`);

      if (providersResponse.available_providers.length === 0) {
        setError('No providers available. Please ensure Ollama is running or Gemini API key is configured.');
        setIsLoading(false);
        return;
      }

      // Step 2: Fetch models for available providers
      setStatusMessage('Fetching models...');
      const modelsResponse: ModelsResponse = await checkModels();

      // Extract models from response
      const models: { [key: string]: string[] } = {};
      for (const provider in modelsResponse.llm.provider) {
        models[provider] = modelsResponse.llm.provider[provider].models;
      }
      setAvailableModels(models);

      // Show any errors but continue
      if (modelsResponse.errors && modelsResponse.errors.length > 0) {
        setStatusMessage(`Warning: ${modelsResponse.message}`);
      } else {
        setStatusMessage('Providers and models loaded successfully');
      }

    } catch (err) {
      setError(`Failed to load configuration: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle provider selection change
   */
  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    setSelectedModel(null); // Reset model when provider changes
  };

  /**
   * Handle model selection change
   */
  const handleModelChange = (model: string) => {
    setSelectedModel(model);
  };

  /**
   * Apply the selected provider and model configuration
   */
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
      setStatusMessage('Configuration updated successfully');
    } catch (err) {
      setError(`Failed to update configuration: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-6">
      <h2 className="text-xl font-bold mb-4">LLM Configuration</h2>

      {/* Status message */}
      {statusMessage && (
        <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded">
          {statusMessage}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Refresh button */}
      <div className="mb-4">
        <button
          onClick={loadProvidersAndModels}
          disabled={isLoading}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Loading...' : 'Refresh Providers & Models'}
        </button>
      </div>

      {/* Provider selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Provider
        </label>
        <select
          value={selectedProvider || ''}
          onChange={(e) => handleProviderChange(e.target.value)}
          disabled={isLoading || availableProviders.length === 0}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a provider</option>
          {availableProviders.map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </select>
      </div>

      {/* Model selection (only shown when provider is selected) */}
      {selectedProvider && availableModels[selectedProvider] && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Model
          </label>
          <select
            value={selectedModel || ''}
            onChange={(e) => handleModelChange(e.target.value)}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a model</option>
            {availableModels[selectedProvider].map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Apply button */}
      <button
        onClick={applyConfiguration}
        disabled={isLoading || !selectedProvider || !selectedModel}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        Apply Configuration
      </button>
    </div>
  );
};

export default ConfigSection;
