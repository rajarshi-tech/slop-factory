import React, { useState, useEffect } from 'react';
import {
  getUncalculatedTrends,
  calculateTrends,
} from '../services/api';
import type { Job, CalculatedVideo } from '../services/api';

interface TrendCalculatorSectionProps {
  uncalculatedCount: number;
  onRefreshNeeded: () => void;
  onViewJobs: () => void;
}

export const TrendCalculatorSection: React.FC<TrendCalculatorSectionProps> = ({
  onRefreshNeeded,
  onViewJobs,
}) => {
  const [uncalculatedJobs, setUncalculatedJobs] = useState<Job[]>([]);
  const [recentCalculations, setRecentCalculations] = useState<CalculatedVideo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchUncalculated = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await getUncalculatedTrends('search');
      setUncalculatedJobs(res.jobs || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch uncalculated jobs';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUncalculated();
  }, []);

  const handleCalculateAll = async () => {
    setIsCalculating(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const result = await calculateTrends('search');
      setStatusMessage(result.message || `Trend scores calculated for ${result.calculated_count} video(s)!`);
      if (result.jobs && result.jobs.length > 0) {
        setRecentCalculations((prev) => [...result.jobs, ...prev]);
      }
      // Refresh uncalculated list
      await fetchUncalculated();
      onRefreshNeeded();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Trend calculation failed';
      setErrorMessage(msg);
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header card with Action */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">YouTube Trend Rank Calculator</h2>
            </div>
            <p className="text-slate-400 text-sm mt-2 max-w-2xl">
              Evaluates views per hour (velocity), subscriber velocity, like rates, and comment rates from each video's metadata to calculate an objective trend ranking score.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchUncalculated}
              disabled={isLoading || isCalculating}
              className="px-4 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium rounded-2xl border border-slate-700 transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
              title="Refresh uncalculated list"
            >
              <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </button>

            <button
              onClick={handleCalculateAll}
              disabled={isCalculating || uncalculatedJobs.length === 0}
              className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-2xl shadow-lg shadow-amber-500/25 transition-all flex items-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isCalculating ? (
                <>
                  <svg className="animate-spin w-4 h-4 text-slate-950" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Calculating Scores...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span>Calculate Trends ({uncalculatedJobs.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Notifications */}
        {statusMessage && (
          <div className="mt-4 p-4 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-2xl text-sm flex items-center gap-3">
            <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{statusMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 p-4 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-2xl text-sm flex items-center gap-3">
            <svg className="w-5 h-5 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Uncalculated Queue Card */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <h3 className="text-lg font-bold text-white">
              Newly Ingested Videos Pending Trend Ranking ({uncalculatedJobs.length})
            </h3>
          </div>
        </div>

        {uncalculatedJobs.length === 0 ? (
          <div className="py-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl bg-slate-950/30">
            <svg className="w-10 h-10 text-slate-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-slate-400">All searched videos have calculated trend scores!</p>
            <p className="text-xs text-slate-500 mt-1">Use the "Ingest Videos" tab to search or import new videos.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {uncalculatedJobs.map((job) => (
              <div
                key={job.video_id}
                className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-slate-800 text-slate-400 uppercase tracking-wider">
                      {job.source}
                    </span>
                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Trend Pending
                    </span>
                  </div>
                  <h4 className="font-semibold text-slate-200 text-sm mt-2 line-clamp-2 group-hover:text-amber-300 transition-colors">
                    {job.title || job.video_id}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">{job.channel || 'Unknown Channel'}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span className="font-mono text-[11px]">{job.video_id}</span>
                  <a
                    href={`https://youtube.com/watch?v=${job.video_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1"
                  >
                    Watch
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Calculated Results / Live Rankings */}
      {recentCalculations.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span>Recently Calculated Trend Ranks ({recentCalculations.length})</span>
            </h3>

            <button
              onClick={onViewJobs}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1"
            >
              <span>View in Job Queue</span>
              <span>→</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentCalculations.map((v) => (
              <div
                key={v.video_id}
                className="p-5 rounded-2xl bg-gradient-to-b from-slate-950 to-slate-900 border border-amber-500/30 hover:border-amber-500/60 shadow-lg shadow-amber-500/5 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-500">{v.video_id}</span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20">
                      ★ {v.trend_score.toFixed(4)}
                    </span>
                  </div>

                  <h4 className="font-bold text-white text-sm mt-2 line-clamp-2">{v.title}</h4>
                  <p className="text-xs text-slate-400 mt-1">{v.channel}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block">Views</span>
                    <span className="font-semibold text-slate-200">
                      {v.view_count ? Number(v.view_count).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block">Likes</span>
                    <span className="font-semibold text-slate-200">
                      {v.like_count ? Number(v.like_count).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block">Age (hrs)</span>
                    <span className="font-semibold text-slate-200">{v.age_hours ? v.age_hours.toFixed(1) : 'N/A'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
