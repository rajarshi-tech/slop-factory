import React, { useState } from 'react';
import { searchVideos, createJobFromUrl } from '../services/api';
import type { Job, SearchParams } from '../services/api';

interface IngestionSectionProps {
  currentParams: SearchParams;
  onJobCreated: (job: Job) => void;
  onSearchCompleted: (jobs: Job[]) => void;
}

export const IngestionSection: React.FC<IngestionSectionProps> = ({
  currentParams,
  onJobCreated,
  onSearchCompleted,
}) => {
  const [ingestionMode, setIngestionMode] = useState<'search' | 'url'>('search');

  // Search state
  const [query, setQuery] = useState(currentParams.q || '');
  const [isSearching, setIsSearching] = useState(false);
  const [searchSuccess, setSearchSuccess] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Direct URL state
  const [url, setUrl] = useState('');
  const [isSubmittingUrl, setIsSubmittingUrl] = useState(false);
  const [urlSuccess, setUrlSuccess] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Suggested keywords
  const presets = [
    'AI developments 2026',
    'Quantum computing breakthroughs',
    'Robotics and automation',
    'Autonomous agents coding',
    'Next gen web frameworks',
  ];

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setSearchSuccess(null);
    setSearchError(null);

    try {
      const result = await searchVideos(query.trim());
      if (result.jobs && result.jobs.length > 0) {
        setSearchSuccess(`Successfully ingested ${result.count} video(s) into job database!`);
        onSearchCompleted(result.jobs);
      } else {
        setSearchError(result.message || 'No videos found for this query.');
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Search failed';
      setSearchError(`Failed to search YouTube: ${errorMsg}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsSubmittingUrl(true);
    setUrlSuccess(null);
    setUrlError(null);

    try {
      const result = await createJobFromUrl(url.trim());
      if (result.job) {
        setUrlSuccess(`Video "${result.job.title || result.job.video_id}" added to queue successfully!`);
        onJobCreated(result.job);
        setUrl('');
      } else {
        setUrlError(result.message || 'Could not process URL.');
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'URL submission failed';
      setUrlError(`Failed to add video: ${errorMsg}`);
    } finally {
      setIsSubmittingUrl(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode Switcher */}
      <div className="flex bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800 max-w-md mx-auto">
        <button
          onClick={() => setIngestionMode('search')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
            ingestionMode === 'search'
              ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span>YouTube Search Query</span>
        </button>

        <button
          onClick={() => setIngestionMode('url')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
            ingestionMode === 'url'
              ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-lg shadow-rose-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span>Direct Video URL</span>
        </button>
      </div>

      {/* Main Card */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-72 h-72 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-72 h-72 rounded-full bg-rose-600/10 blur-3xl pointer-events-none" />

        {/* Search Mode */}
        {ingestionMode === 'search' && (
          <div className="space-y-6 relative">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Search & Ingest YouTube Videos</h2>
              <p className="text-slate-400 text-sm mt-1">
                Scrapes YouTube using your configured criteria, saves video metadata, and queues jobs in database.
              </p>
            </div>

            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter keywords (e.g., 'artificial intelligence future')..."
                  className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl px-5 py-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-inner"
                  disabled={isSearching}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={isSearching || !query.trim()}
                className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isSearching ? (
                  <>
                    <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Scraping & Queuing...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span>Scrape & Ingest</span>
                  </>
                )}
              </button>
            </form>

            {/* Presets */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quick Suggestions:</span>
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setQuery(preset)}
                  className="px-3 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-full border border-slate-700 transition-colors"
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Active search config preview */}
            <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 text-xs text-slate-400 flex flex-wrap items-center gap-x-6 gap-y-2">
              <div><span className="text-slate-500 font-medium">Order:</span> <span className="text-slate-300 font-mono">{currentParams.order}</span></div>
              <div><span className="text-slate-500 font-medium">Max Results:</span> <span className="text-slate-300 font-mono">{currentParams.maxResults}</span></div>
              <div><span className="text-slate-500 font-medium">Duration:</span> <span className="text-slate-300 font-mono">{currentParams.videoDuration}</span></div>
              <div><span className="text-slate-500 font-medium">Caption:</span> <span className="text-slate-300 font-mono">{currentParams.videoCaption}</span></div>
            </div>

            {/* Feedback Alerts */}
            {searchSuccess && (
              <div className="p-4 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-2xl text-sm flex items-center gap-3">
                <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{searchSuccess}</span>
              </div>
            )}

            {searchError && (
              <div className="p-4 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-2xl text-sm flex items-center gap-3">
                <svg className="w-5 h-5 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{searchError}</span>
              </div>
            )}
          </div>
        )}

        {/* Direct URL Mode */}
        {ingestionMode === 'url' && (
          <div className="space-y-6 relative">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Ingest Single YouTube Video</h2>
              <p className="text-slate-400 text-sm mt-1">
                Paste any standard YouTube video or Shorts URL to directly ingest full statistics and queue it for processing.
              </p>
            </div>

            <form onSubmit={handleUrlSubmit} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                  className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl px-5 py-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all shadow-inner"
                  disabled={isSubmittingUrl}
                />
                {url && (
                  <button
                    type="button"
                    onClick={() => setUrl('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmittingUrl || !url.trim()}
                className="px-8 py-4 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-semibold rounded-2xl shadow-lg shadow-rose-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isSubmittingUrl ? (
                  <>
                    <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Ingesting Video...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Add to Job Queue</span>
                  </>
                )}
              </button>
            </form>

            <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Supported formats:</span>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-400">
                <li><code className="text-rose-400">https://www.youtube.com/watch?v=VIDEO_ID</code></li>
                <li><code className="text-rose-400">https://youtu.be/VIDEO_ID</code></li>
                <li><code className="text-rose-400">https://www.youtube.com/embed/VIDEO_ID</code></li>
              </ul>
            </div>

            {/* Feedback Alerts */}
            {urlSuccess && (
              <div className="p-4 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-2xl text-sm flex items-center gap-3">
                <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{urlSuccess}</span>
              </div>
            )}

            {urlError && (
              <div className="p-4 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-2xl text-sm flex items-center gap-3">
                <svg className="w-5 h-5 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{urlError}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
