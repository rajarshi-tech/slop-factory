import React, { useState } from 'react';
import { getJobById, archiveJobs, processVideos } from '../services/api';
import type { Job } from '../services/api';

interface JobQueueSectionProps {
  jobs: Job[];
  isLoading: boolean;
  onRefresh: () => void;
  isWsConnected: boolean;
}

export const JobQueueSection: React.FC<JobQueueSectionProps> = ({
  jobs,
  isLoading,
  onRefresh,
  isWsConnected,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isViewingDetails, setIsViewingDetails] = useState<boolean>(false);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processMessage, setProcessMessage] = useState<string | null>(null);

  // Exclude archived and processed videos from job queue (processed videos move to Processed section)
  const queueJobs = jobs.filter(
    (job) => job.video_state !== 'archived' && job.processing_state !== 'processed'
  );

  // Filter queue jobs
  const filteredJobs = queueJobs.filter((job) => {
    if (filterStatus !== 'all' && job.job_status !== filterStatus) return false;
    if (filterSource !== 'all' && job.source !== filterSource) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (job.title || '').toLowerCase().includes(q);
      const matchChannel = (job.channel || '').toLowerCase().includes(q);
      const matchId = job.video_id.toLowerCase().includes(q);
      if (!matchTitle && !matchChannel && !matchId) return false;
    }
    return true;
  });

  const toggleSelectAll = () => {
    const visibleIds = filteredJobs.map((j) => j.video_id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const toggleSelectJob = (videoId: string) => {
    setSelectedIds((prev) =>
      prev.includes(videoId) ? prev.filter((id) => id !== videoId) : [...prev, videoId]
    );
  };

  const handleProcessSelected = async () => {
    if (selectedIds.length === 0) return;
    try {
      setIsProcessing(true);
      setProcessMessage(`Processing ${selectedIds.length} video(s)...`);
      await processVideos(selectedIds);
      setProcessMessage(`Processing completed! Videos moved to Processed section.`);
      setSelectedIds([]);
      onRefresh();
    } catch (err) {
      console.error('Failed to process videos:', err);
      setProcessMessage('Failed to process selected videos.');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setProcessMessage(null), 5000);
    }
  };

  const handleArchiveSelected = async () => {
    if (selectedIds.length === 0) return;
    try {
      await archiveJobs(selectedIds);
      setSelectedIds([]);
      onRefresh();
    } catch (err) {
      console.error('Failed to archive selected videos:', err);
    }
  };

  const handleArchiveJob = async (videoId: string) => {
    try {
      setArchivingId(videoId);
      await archiveJobs([videoId]);
      if (selectedJob?.video_id === videoId) {
        setIsViewingDetails(false);
      }
      setSelectedIds((prev) => prev.filter((id) => id !== videoId));
      onRefresh();
    } catch (err) {
      console.error('Failed to archive job:', err);
    } finally {
      setArchivingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'downloading':
      case 'transcribing':
      case 'generating_clips':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 animate-pulse';
      case 'failed':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'downloaded':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      default:
        return 'bg-slate-700/50 text-slate-300 border-slate-600/50';
    }
  };

  const handleOpenDetails = async (job: Job) => {
    setSelectedJob(job);
    setIsViewingDetails(true);
    setDetailsLoading(true);
    try {
      const fullJob = await getJobById(job.video_id);
      setSelectedJob(fullJob);
    } catch {
      // Keep existing job data if fetch fails
    } finally {
      setDetailsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters & Control Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 backdrop-blur-xl shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search filter input */}
          <div className="relative flex-1 min-w-50 max-w-sm">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, channel, video ID..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Statuses ({queueJobs.length})</option>
            <option value="queued">Queued</option>
            <option value="downloading">Downloading</option>
            <option value="downloaded">Downloaded</option>
            <option value="transcribing">Transcribing</option>
            <option value="generating_clips">Generating Clips</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>

          {/* Source Filter */}
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Sources</option>
            <option value="search">Search Scraper</option>
            <option value="direct_url">Direct URL</option>
          </select>
        </div>

        {/* Refresh & WS indicators */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800">
            <span className={`w-2 h-2 rounded-full ${isWsConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
            <span>{isWsConnected ? 'Live Updates (WS)' : 'Polling (REST)'}</span>
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors disabled:opacity-50"
            title="Refresh jobs"
          >
            <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Process Notification / Status Message */}
      {processMessage && (
        <div className="p-4 rounded-2xl bg-indigo-950/60 border border-indigo-500/40 text-indigo-200 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            {isProcessing && <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />}
            <span>{processMessage}</span>
          </div>
          <button onClick={() => setProcessMessage(null)} className="text-indigo-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Batch Selection Action Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-indigo-950/80 border border-indigo-800/80 rounded-2xl p-4 backdrop-blur-xl shadow-xl flex flex-wrap items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30">
              {selectedIds.length} selected
            </span>
            <button
              onClick={() => setSelectedIds([])}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              Deselect all
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleArchiveSelected}
              className="px-3 py-2 text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl border border-amber-500/30 transition-colors"
            >
              Archive Selected ({selectedIds.length})
            </button>

            <button
              onClick={handleProcessSelected}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-bold text-white bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Process Selected Videos ({selectedIds.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Jobs Grid / Table */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl">
        {filteredJobs.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <svg className="w-12 h-12 text-slate-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-base font-semibold text-slate-400">No jobs found</p>
            <p className="text-xs text-slate-500 mt-1">Try changing filters or ingest new videos.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={filteredJobs.length > 0 && filteredJobs.every((j) => selectedIds.includes(j.video_id))}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      title="Select all"
                    />
                  </th>
                  <th className="py-3.5 px-4 sm:px-6">Video / Title</th>
                  <th className="py-3.5 px-4">Source</th>
                  <th className="py-3.5 px-4">Trend Score</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Progress</th>
                  <th className="py-3.5 px-4">Added</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {filteredJobs.map((job) => {
                  const isSelected = selectedIds.includes(job.video_id);
                  return (
                    <tr
                      key={job.video_id}
                      className={`hover:bg-slate-800/40 transition-colors group ${isSelected ? 'bg-indigo-950/30' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="py-4 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectJob(job.video_id)}
                          className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                        />
                      </td>

                      {/* Title & Channel */}
                      <td className="py-4 px-4 sm:px-6 max-w-xs sm:max-w-md">
                        <div className="font-semibold text-slate-200 truncate group-hover:text-indigo-400 transition-colors">
                          {job.title || job.video_id}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <span>{job.channel || 'Unknown Channel'}</span>
                          <span>•</span>
                          <span className="font-mono text-[11px]">{job.video_id}</span>
                        </div>
                      </td>

                    {/* Source */}
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                        job.source === 'direct_url'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      }`}>
                        {job.source}
                      </span>
                    </td>

                    {/* Trend Score */}
                    <td className="py-4 px-4">
                      {job.trend_score !== null && job.trend_score !== undefined ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
                          ★ {Number(job.trend_score).toFixed(3)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600 font-mono italic">unranked</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(job.job_status)}`}>
                        {job.job_status}
                      </span>
                    </td>

                    {/* Progress */}
                    <td className="py-4 px-4 min-w-30">
                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-linear-to-r from-indigo-500 to-emerald-400 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(job.progress || 0, job.job_status === 'completed' ? 100 : 5)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        {job.progress || (job.job_status === 'completed' ? 100 : 0)}%
                      </span>
                    </td>

                    {/* Created Time */}
                    <td className="py-4 px-4 text-xs text-slate-400 whitespace-nowrap">
                      {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleArchiveJob(job.video_id)}
                          disabled={archivingId === job.video_id}
                          className="px-2.5 py-1 text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg border border-amber-500/30 transition-colors flex items-center gap-1 disabled:opacity-50"
                          title="Archive job"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1a2 2 0 01-2 2M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                          </svg>
                          <span>{archivingId === job.video_id ? 'Archiving...' : 'Archive'}</span>
                        </button>
                        <button
                          onClick={() => handleOpenDetails(job)}
                          className="px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
                        >
                          Details
                        </button>
                        <a
                          href={`https://youtube.com/watch?v=${job.video_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                          title="Open on YouTube"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Drawer / Modal */}
      {isViewingDetails && selectedJob && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusBadge(selectedJob.job_status)}`}>
                  {selectedJob.job_status}
                </span>
                <h3 className="text-xl font-bold text-white mt-2">{selectedJob.title || selectedJob.video_id}</h3>
                <p className="text-sm text-slate-400 mt-1">{selectedJob.channel || 'Unknown Channel'}</p>
              </div>

              <button
                onClick={() => setIsViewingDetails(false)}
                className="text-slate-500 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            {detailsLoading ? (
              <div className="py-8 text-center text-slate-500">
                <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto" />
                <p className="text-xs mt-2">Loading metadata...</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block">Video ID</span>
                  <span className="font-mono text-slate-200">{selectedJob.video_id}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block">Source</span>
                  <span className="font-semibold text-slate-200 uppercase">{selectedJob.source}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block">Trend Score</span>
                  <span className="font-bold text-amber-400">
                    {selectedJob.trend_score !== null ? selectedJob.trend_score : 'Not calculated yet'}
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block">Processing State</span>
                  <span className="font-semibold text-slate-200">{selectedJob.processing_state}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block">Created At</span>
                  <span className="text-slate-200">{selectedJob.created_at}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block">Updated At</span>
                  <span className="text-slate-200">{selectedJob.updated_at}</span>
                </div>
              </div>
            )}

            {selectedJob.error_message && (
              <div className="p-4 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs">
                <span className="font-bold block mb-1">Error Details:</span>
                {selectedJob.error_message}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => handleArchiveJob(selectedJob.video_id)}
                disabled={archivingId === selectedJob.video_id}
                className="px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1a2 2 0 01-2 2M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                {archivingId === selectedJob.video_id ? 'Archiving...' : 'Archive Video'}
              </button>
              <a
                href={`https://youtube.com/watch?v=${selectedJob.video_id}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                Open on YouTube
              </a>
              <button
                onClick={() => setIsViewingDetails(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
