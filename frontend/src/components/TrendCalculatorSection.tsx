import React, { useState, useMemo } from 'react';
import { calculateTrends, getJobs } from '../services/api';
import type { Job } from '../services/api';

interface TrendCalculatorSectionProps {
  jobs: Job[];
  onRefresh: () => void;
}

export const TrendCalculatorSection: React.FC<TrendCalculatorSectionProps> = ({
  jobs,
  onRefresh,
}) => {
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [calculatingVideoId, setCalculatingVideoId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'score-desc' | 'score-asc' | 'title' | 'date'>('score-desc');
  const [showFormulaDetails, setShowFormulaDetails] = useState<boolean>(false);

  // Statistics
  const totalJobsCount = jobs.length;
  const rankedJobsCount = jobs.filter((j) => j.trend_score !== null && j.trend_score !== undefined).length;
  const unrankedJobsCount = totalJobsCount - rankedJobsCount;

  const avgTrendScore = useMemo(() => {
    const scoredJobs = jobs.filter((j) => typeof j.trend_score === 'number');
    if (scoredJobs.length === 0) return 0;
    const sum = scoredJobs.reduce((acc, j) => acc + (j.trend_score || 0), 0);
    return sum / scoredJobs.length;
  }, [jobs]);

  const maxTrendScore = useMemo(() => {
    const scoredJobs = jobs.filter((j) => typeof j.trend_score === 'number');
    if (scoredJobs.length === 0) return 0;
    return Math.max(...scoredJobs.map((j) => j.trend_score || 0));
  }, [jobs]);

  /**
   * Recalculate trend scores for ALL videos in job.db
   */
  const handleRecalculateAll = async () => {
    setIsCalculating(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      // First fetch the latest jobs from DB to ensure we have every video ID
      const latestJobsRes = await getJobs();
      const allJobs = latestJobsRes.jobs || jobs;

      if (allJobs.length === 0) {
        setErrorMessage('No videos found in job.db to calculate trend scores.');
        setIsCalculating(false);
        return;
      }

      const allVideoIds = allJobs.map((j) => j.video_id);

      // Call API route with all video_ids to recalculate trend score for all videos in job.db
      const res = await calculateTrends(undefined, allVideoIds);

      setSuccessMessage(
        `Successfully recalculated trend score for all ${res.calculated_count} video(s) in job.db!`
      );
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error during calculation';
      setErrorMessage(`Failed to recalculate trend scores: ${msg}`);
    } finally {
      setIsCalculating(false);
    }
  };

  /**
   * Recalculate trend score for a single video
   */
  const handleRecalculateSingle = async (videoId: string) => {
    setCalculatingVideoId(videoId);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await calculateTrends(undefined, [videoId]);
      const newScore = res.jobs && res.jobs[0] ? res.jobs[0].trend_score : null;
      setSuccessMessage(
        `Recalculated trend score for ${videoId}${newScore !== null ? `: ${newScore.toFixed(4)}` : ''}`
      );
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to recalculate video score';
      setErrorMessage(msg);
    } finally {
      setCalculatingVideoId(null);
    }
  };

  // Filter & sort videos
  const filteredAndSortedJobs = useMemo(() => {
    return jobs
      .filter((j) => {
        if (!searchFilter.trim()) return true;
        const q = searchFilter.toLowerCase();
        return (
          (j.title && j.title.toLowerCase().includes(q)) ||
          (j.channel && j.channel.toLowerCase().includes(q)) ||
          j.video_id.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'score-desc') {
          const scoreA = a.trend_score ?? -Infinity;
          const scoreB = b.trend_score ?? -Infinity;
          return scoreB - scoreA;
        }
        if (sortBy === 'score-asc') {
          const scoreA = a.trend_score ?? Infinity;
          const scoreB = b.trend_score ?? Infinity;
          return scoreA - scoreB;
        }
        if (sortBy === 'title') {
          return (a.title || '').localeCompare(b.title || '');
        }
        if (sortBy === 'date') {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return 0;
      });
  }, [jobs, searchFilter, sortBy]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="relative overflow-hidden p-6 sm:p-8 rounded-3xl bg-linear-to-r from-slate-900 via-slate-900/90 to-amber-950/40 border border-slate-800 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Trend Score Calculator
              </h2>
            </div>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Recalculate trend scores for all videos in <code className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-xs">job.db</code> based on video age, view velocity, and engagement rates.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={handleRecalculateAll}
              disabled={isCalculating || totalJobsCount === 0}
              className={`flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl font-bold text-sm transition-all shadow-lg ${
                isCalculating || totalJobsCount === 0
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-linear-to-r from-amber-500 via-amber-600 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white shadow-amber-500/20 hover:shadow-amber-500/30 active:scale-95'
              }`}
            >
              {isCalculating ? (
                <>
                  <svg className="w-5 h-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Recalculating All ({totalJobsCount})...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Recalculate All Trend Scores</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-emerald-500/20"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-200 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-rose-500/20"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Videos</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-black text-white">{totalJobsCount}</span>
            <span className="text-xs text-slate-500">in job.db</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Scored Videos</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-black text-emerald-400">{rankedJobsCount}</span>
            <span className="text-xs text-slate-500">/ {totalJobsCount}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Unscored Videos</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-3xl font-black ${unrankedJobsCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
              {unrankedJobsCount}
            </span>
            <span className="text-xs text-slate-500">pending</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Peak Trend Score</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-black text-amber-400">
              {maxTrendScore > 0 ? maxTrendScore.toFixed(3) : '—'}
            </span>
            <span className="text-xs text-slate-500">avg {avgTrendScore > 0 ? avgTrendScore.toFixed(2) : '—'}</span>
          </div>
        </div>
      </div>

      {/* Formula Explainer Toggle */}
      <div className="rounded-2xl bg-slate-900/40 border border-slate-800/80 overflow-hidden">
        <button
          onClick={() => setShowFormulaDetails(!showFormulaDetails)}
          className="w-full px-6 py-4 flex items-center justify-between text-left text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800/40 transition-all"
        >
          <div className="flex items-center gap-2.5">
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>How is the Trend Score calculated?</span>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {showFormulaDetails ? 'Hide details ▲' : 'Show formula ▼'}
          </span>
        </button>

        {showFormulaDetails && (
          <div className="px-6 pb-6 pt-2 border-t border-slate-800/60 space-y-3 text-xs text-slate-300">
            <div className="p-3 rounded-xl bg-slate-950/80 font-mono text-amber-300 border border-slate-800">
              Trend Score = log(Velocity + 1) × Engagement
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-400">
              <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/50 space-y-1">
                <span className="font-semibold text-slate-200 block">Velocity</span>
                <p><code className="text-indigo-300">views / max(age_hours, 1.0)</code></p>
                <p className="text-[11px]">Measures view velocity per hour since publication.</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/50 space-y-1">
                <span className="font-semibold text-slate-200 block">Engagement</span>
                <p><code className="text-indigo-300">0.5 × like_rate + 0.3 × comment_rate + 0.2 × sub_velocity</code></p>
                <p className="text-[11px]">Weighted ratio of likes, comments, and views relative to subscribers.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Videos List Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search by title, channel, or video ID..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition-all"
          />
          {searchFilter && (
            <button
              onClick={() => setSearchFilter('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
            >
              Clear
            </button>
          )}
        </div>

        {/* Sort dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 whitespace-nowrap">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'score-desc' | 'score-asc' | 'title' | 'date')}
            className="py-2.5 px-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-medium text-slate-200 focus:outline-none focus:border-amber-500/60"
          >
            <option value="score-desc">Trend Score (High → Low)</option>
            <option value="score-asc">Trend Score (Low → High)</option>
            <option value="title">Title (A → Z)</option>
            <option value="date">Date Added (Newest)</option>
          </select>
        </div>
      </div>

      {/* Videos List / Table */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden shadow-xl">
        {filteredAndSortedJobs.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <svg className="w-12 h-12 text-slate-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-slate-400 font-medium">No videos found matching your filter.</p>
            {totalJobsCount === 0 && (
              <p className="text-xs text-slate-500">Ingest videos using the Ingest Videos tab to start calculating scores.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                  <th className="py-3.5 px-4 w-12 text-center">#</th>
                  <th className="py-3.5 px-4">Video Details</th>
                  <th className="py-3.5 px-4">Channel</th>
                  <th className="py-3.5 px-4">Source</th>
                  <th className="py-3.5 px-4 text-center">Trend Score</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredAndSortedJobs.map((job, index) => {
                  const hasScore = typeof job.trend_score === 'number';
                  const score = job.trend_score ?? 0;
                  const isRecalculatingThis = calculatingVideoId === job.video_id;

                  return (
                    <tr key={job.video_id} className="hover:bg-slate-800/30 transition-colors group">
                      {/* Rank Index */}
                      <td className="py-4 px-4 text-center text-xs font-mono font-bold text-slate-500">
                        {index + 1}
                      </td>

                      {/* Video Details */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3 min-w-60">
                          <img
                            src={`https://img.youtube.com/vi/${job.video_id}/mqdefault.jpg`}
                            alt={job.title || job.video_id}
                            className="w-16 h-10 rounded-lg object-cover bg-slate-800 shrink-0 border border-slate-700/60"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="40" viewBox="0 0 64 40"><rect width="64" height="40" fill="%231e293b"/></svg>';
                            }}
                          />
                          <div className="space-y-0.5 overflow-hidden">
                            <a
                              href={`https://www.youtube.com/watch?v=${job.video_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-slate-100 hover:text-amber-400 transition-colors line-clamp-1 block"
                              title={job.title || job.video_id}
                            >
                              {job.title || job.video_id}
                            </a>
                            <span className="text-[11px] font-mono text-slate-500 block">
                              ID: {job.video_id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Channel */}
                      <td className="py-4 px-4 text-xs font-medium text-slate-300 whitespace-nowrap">
                        {job.channel || '—'}
                      </td>

                      {/* Source */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                            job.source === 'search'
                              ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                              : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          {job.source}
                        </span>
                      </td>

                      {/* Trend Score */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        {hasScore ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-linear-to-r from-amber-500/15 via-rose-500/15 to-indigo-500/15 border border-amber-500/30">
                            <span className="text-xs font-mono font-bold text-amber-300">
                              {score.toFixed(4)}
                            </span>
                          </div>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-mono text-slate-500 bg-slate-800/60 border border-slate-700/50">
                            Uncalculated
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleRecalculateSingle(job.video_id)}
                          disabled={isRecalculatingThis || isCalculating}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-amber-600 text-slate-300 hover:text-white text-xs font-semibold transition-all border border-slate-700/80 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Recalculate trend score for this video"
                        >
                          {isRecalculatingThis ? (
                            <span className="flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              <span>Calculating...</span>
                            </span>
                          ) : (
                            'Recalculate'
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrendCalculatorSection;
