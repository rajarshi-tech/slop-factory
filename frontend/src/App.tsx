/**
 * Main App Component
 * Integrates all components and manages the application state
 * Layout: Search bar at top, config section and param controls side by side
 */

import { useEffect, useState } from 'react';
import SearchBar from './components/SearchBar';
import ConfigSection from './components/ConfigSection';
import ParamControls from './components/ParamControls';
import { getConfig, updateSearchParams } from './services/api';
import type { LLMConfig, SearchParams } from './services/api';
import './App.css';

function App() {
  // State for configuration
  const [llmConfig, setLlmConfig] = useState<LLMConfig>({ provider: null, model: null });

  // State for search parameters with defaults
  const [searchParams, setSearchParams] = useState<SearchParams>({
    q: '',
    order: 'viewCount',
    publishedAfter: null,
    publishedBefore: null,
    maxResults: 10,
    videoCaption: 'closedCaption',
    videoCategoryId: null,
    videoDefinition: 'any',
    videoDimension: 'any',
    videoDuration: 'medium',
    videoEmbeddable: 'any',
    videoLicense: 'any',
    videoSyndicated: 'any',
    videoType: 'any',
    safeSearch: 'moderate',
  });

  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load initial configuration on mount
   */
  useEffect(() => {
    loadInitialConfig();
  }, []);

  /**
   * Fetch the full config from backend to get default values
   */
  const loadInitialConfig = async () => {
    try {
      const config = await getConfig();

      // Set LLM config
      setLlmConfig(config.llm);

      // Set search parameters from config
      setSearchParams(config.params);
    } catch (err) {
      console.error('Failed to load initial config:', err);
      setError('Failed to load initial configuration. Using defaults.');
    }
  };

  /**
   * Handle LLM configuration update
   */
  const handleConfigUpdate = (config: LLMConfig) => {
    setLlmConfig(config);
  };

  /**
   * Handle search parameters change
   */
  const handleParamsChange = (params: Partial<SearchParams>) => {
    setSearchParams((prev) => ({ ...prev, ...params }));
  };

  /**
   * Handle save parameters separately (without searching)
   * If search query is empty, uses default value
   */
  const handleParamsSave = async (params: SearchParams) => {
    try {
      // If query is empty, use default or keep existing
      const paramsToSave: SearchParams = {
        ...params,
        q: params.q || searchParams.q || 'life without the internet',
      };

      // Send to backend - this updates config.json with all params
      await updateSearchParams(paramsToSave);

      // Update local state
      setSearchParams(paramsToSave);

      console.log('Parameters saved:', paramsToSave);
    } catch (err) {
      throw new Error(`Failed to save parameters: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  /**
   * Handle search submission
   * Sends the search query along with all parameters to the backend
   */
  const handleSearch = async (query: string) => {
    setIsSearching(true);
    setError(null);

    try {
      // Update the query in search params
      const finalParams: SearchParams = {
        ...searchParams,
        q: query,
      };

      // Send to backend - this updates config.json with all params
      await updateSearchParams(finalParams);

      console.log('Search submitted with params:', finalParams);

      // TODO: Implement actual search functionality
      // This would typically call another endpoint that performs the search
      alert(`Search submitted successfully!\nQuery: ${query}\nProvider: ${llmConfig.provider}\nModel: ${llmConfig.model}`);

    } catch (err) {
      setError(`Search failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">YouTube Search with AI</h1>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Search bar - full width at top */}
        <SearchBar
          onSearch={handleSearch}
          defaultQuery={searchParams.q}
          isLoading={isSearching}
        />

        {/* Configuration and parameters - side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column - LLM Configuration */}
          <div>
            <ConfigSection onConfigUpdate={handleConfigUpdate} />
          </div>

          {/* Right column - Search Parameters */}
          <div>
            <ParamControls
              onParamsChange={handleParamsChange}
              onParamsSave={handleParamsSave}
              defaultParams={searchParams}
            />
          </div>
        </div>

        {/* Current configuration display */}
        <div className="mt-6 p-4 bg-white rounded-lg shadow-md">
          <h3 className="font-bold text-lg mb-2">Current Configuration</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Provider:</span>{' '}
              <span className="text-gray-700">{llmConfig.provider || 'Not set'}</span>
            </div>
            <div>
              <span className="font-medium">Model:</span>{' '}
              <span className="text-gray-700">{llmConfig.model || 'Not set'}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
