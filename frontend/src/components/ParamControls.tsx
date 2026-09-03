/**
 * ParamControls Component
 * Handles all YouTube search parameters (order, maxResults, videoCaption, etc.)
 * Users can modify parameters which will be sent along with the search query
 */

import { useEffect, useState } from 'react';
import { getParamOptions } from '../services/api';
import type { ParamOptions, SearchParams } from '../services/api';

interface ParamControlsProps {
  onParamsChange: (params: Partial<SearchParams>) => void;
  defaultParams: SearchParams;
}

const ParamControls = ({ onParamsChange, defaultParams }: ParamControlsProps) => {
  const [options, setOptions] = useState<ParamOptions | null>(null);
  const [params, setParams] = useState<SearchParams>(defaultParams);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load parameter options on mount
   */
  useEffect(() => {
    loadOptions();
  }, []);

  /**
   * Update local params when default params change
   */
  useEffect(() => {
    setParams(defaultParams);
  }, [defaultParams]);

  /**
   * Fetch available parameter options from backend
   */
  const loadOptions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const paramOptions = await getParamOptions();
      setOptions(paramOptions);
    } catch (err) {
      setError(`Failed to load parameter options: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle parameter change and notify parent
   */
  const handleParamChange = (key: keyof SearchParams, value: any) => {
    const updatedParams = { ...params, [key]: value };
    setParams(updatedParams);
    onParamsChange(updatedParams);
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading parameters...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 p-4 rounded-lg">
        {error}
        <button
          onClick={loadOptions}
          className="ml-4 px-3 py-1 bg-red-100 rounded hover:bg-red-200"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!options) {
    return null;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Search Parameters</h2>

      <div className="space-y-4">
        {/* Order */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Order
          </label>
          <select
            value={params.order}
            onChange={(e) => handleParamChange('order', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {options.order.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {/* Max Results */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Max Results ({options.maxResults.min}-{options.maxResults.max})
          </label>
          <input
            type="number"
            min={options.maxResults.min}
            max={options.maxResults.max}
            value={params.maxResults}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              if (value >= options.maxResults.min && value <= options.maxResults.max) {
                handleParamChange('maxResults', value);
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Video Caption */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Video Caption
          </label>
          <select
            value={params.videoCaption}
            onChange={(e) => handleParamChange('videoCaption', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {options.videoCaption.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {/* Video Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Video Category
          </label>
          <select
            value={params.videoCategoryId || ''}
            onChange={(e) => handleParamChange('videoCategoryId', e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Any Category</option>
            {options.videoCategoryId.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {/* Video Definition */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Video Definition
          </label>
          <select
            value={params.videoDefinition}
            onChange={(e) => handleParamChange('videoDefinition', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {options.videoDefinition.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {/* Video Dimension */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Video Dimension
          </label>
          <select
            value={params.videoDimension}
            onChange={(e) => handleParamChange('videoDimension', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {options.videoDimension.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {/* Video Duration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Video Duration
          </label>
          <select
            value={params.videoDuration}
            onChange={(e) => handleParamChange('videoDuration', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {options.videoDuration.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {/* Video Embeddable */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Video Embeddable
          </label>
          <select
            value={params.videoEmbeddable}
            onChange={(e) => handleParamChange('videoEmbeddable', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {options.videoEmbeddable.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {/* Video License */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Video License
          </label>
          <select
            value={params.videoLicense}
            onChange={(e) => handleParamChange('videoLicense', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {options.videoLicense.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {/* Video Syndicated */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Video Syndicated
          </label>
          <select
            value={params.videoSyndicated}
            onChange={(e) => handleParamChange('videoSyndicated', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {options.videoSyndicated.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {/* Video Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Video Type
          </label>
          <select
            value={params.videoType}
            onChange={(e) => handleParamChange('videoType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {options.videoType.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {/* Safe Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Safe Search
          </label>
          <select
            value={params.safeSearch}
            onChange={(e) => handleParamChange('safeSearch', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {options.safeSearch.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {/* Published After (Date) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Published After
          </label>
          <input
            type="datetime-local"
            value={params.publishedAfter || ''}
            onChange={(e) => handleParamChange('publishedAfter', e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Published Before (Date) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Published Before
          </label>
          <input
            type="datetime-local"
            value={params.publishedBefore || ''}
            onChange={(e) => handleParamChange('publishedBefore', e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
};

export default ParamControls;
