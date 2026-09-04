import { useEffect, useState } from 'react';
import { getParamOptions } from '../services/api';
import type { ParamOptions, SearchParams } from '../services/api';

interface ParamControlsProps {
  onParamsChange: (params: Partial<SearchParams>) => void;
  onParamsSave: (params: SearchParams) => void;
  defaultParams: SearchParams;
}

const ParamControls = ({ onParamsChange, onParamsSave, defaultParams }: ParamControlsProps) => {
  const [options, setOptions] = useState<ParamOptions | null>(null);
  const [params, setParams] = useState<SearchParams>(defaultParams);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    loadOptions();
  }, []);

  useEffect(() => {
    setParams(defaultParams);
  }, [defaultParams]);

  const loadOptions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const paramOptions = await getParamOptions();
      setOptions(paramOptions);
    } catch (err: unknown) {
      setError(`Failed to load parameter options: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleParamChange = (key: keyof SearchParams, value: unknown) => {
    const updatedParams = { ...params, [key]: value };
    setParams(updatedParams);
    onParamsChange(updatedParams);
    setSaveMessage(null);
  };

  const handleSaveParams = async () => {
    setIsSaving(true);
    setError(null);
    setSaveMessage(null);

    try {
      await onParamsSave(params);
      setSaveMessage('Search parameters saved successfully!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: unknown) {
      setError(`Failed to save parameters: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 text-center text-slate-400">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2" />
        <p className="text-xs">Loading YouTube search parameters...</p>
      </div>
    );
  }

  if (error || !options) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 text-rose-300">
        <p className="text-sm">{error || 'Could not load search options.'}</p>
        <button
          onClick={loadOptions}
          className="mt-3 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-white rounded-xl"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">YouTube Search Parameters</h2>
            <p className="text-xs text-slate-400">Default options and filters applied when scraping YouTube videos.</p>
          </div>
        </div>

        <button
          onClick={handleSaveParams}
          disabled={isSaving}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save Parameters'}
        </button>
      </div>

      {saveMessage && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 rounded-xl text-xs">
          {saveMessage}
        </div>
      )}

      {/* Grid of form inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
        {/* Order */}
        <div>
          <label className="block text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">Order</label>
          <select
            value={params.order}
            onChange={(e) => handleParamChange('order', e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {options.order.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Max Results */}
        <div>
          <label className="block text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">
            Max Results ({options.maxResults.min}-{options.maxResults.max})
          </label>
          <input
            type="number"
            min={options.maxResults.min}
            max={options.maxResults.max}
            value={params.maxResults}
            onChange={(e) => handleParamChange('maxResults', parseInt(e.target.value) || 10)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Video Duration */}
        <div>
          <label className="block text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">Video Duration</label>
          <select
            value={params.videoDuration}
            onChange={(e) => handleParamChange('videoDuration', e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {options.videoDuration.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Video Caption */}
        <div>
          <label className="block text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">Video Caption</label>
          <select
            value={params.videoCaption}
            onChange={(e) => handleParamChange('videoCaption', e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {options.videoCaption.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Video Category */}
        <div>
          <label className="block text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">Category</label>
          <select
            value={params.videoCategoryId || ''}
            onChange={(e) => handleParamChange('videoCategoryId', e.target.value || null)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Any Category</option>
            {options.videoCategoryId.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Safe Search */}
        <div>
          <label className="block text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">Safe Search</label>
          <select
            value={params.safeSearch}
            onChange={(e) => handleParamChange('safeSearch', e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {options.safeSearch.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Video Definition */}
        <div>
          <label className="block text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">Definition</label>
          <select
            value={params.videoDefinition}
            onChange={(e) => handleParamChange('videoDefinition', e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {options.videoDefinition.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Video License */}
        <div>
          <label className="block text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">License</label>
          <select
            value={params.videoLicense}
            onChange={(e) => handleParamChange('videoLicense', e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {options.videoLicense.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Video Dimension */}
        <div>
          <label className="block text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">Dimension</label>
          <select
            value={params.videoDimension}
            onChange={(e) => handleParamChange('videoDimension', e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {options.videoDimension.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default ParamControls;
