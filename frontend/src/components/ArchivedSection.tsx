import React, { useState } from 'react';
import { getJobById, deleteJobs, unarchiveJobs } from '../services/api';
import type { Job } from '../services/api';

interface ArchivedSectionProps {
  jobs: Job[];
  isLoading: boolean;
  onRefresh: () => void;
  isWsConnected: boolean;
}

export const ArchivedSection: React.FC<ArchivedSectionProps> = ({
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

  // Selection & Deletion state
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const [isConfirmingDelete, setIsConfirmingDelete] = useState<boolean>(false);
  const [idsToDelete, setIdsToDelete] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [unarchivingId, setUnarchivingId] = useState<string | null>(null);

  // Filter only archived jobs
  const archivedJobs = jobs.filter((job) => job.video_state === 'archived');

  const filteredJobs = archivedJobs.filter((job) => {
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'downloading':
      case 'transcribing':
      case 'generating_clips':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      case 'failed':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'downloaded':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      default:
        return 'bg-slate-700/50 text-slate-300 border-slate-600/50';
    }
  };

  const formatDuration = (seconds?: number) => {
    if (seconds === undefined || seconds === null) return 'Unknown';
    const totalSeconds = Math.round(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;
    return `${hours > 0 ? `${hours}:` : ''}${hours > 0 && minutes < 10 ? '0' : ''}${minutes}:${remainingSeconds
      .toString()
      .padStart(2, '0')}`;
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

  // Selection handlers
  const handleToggleSelect = (videoId: string) => {
    setSelectedVideoIds((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) {
        next.delete(videoId);
      } else {
        next.add(videoId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const allFilteredIds = filteredJobs.map((j) => j.video_id);
    const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedVideoIds.has(id));

    if (isAllSelected) {
      setSelectedVideoIds((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedVideoIds((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  // Trigger deletion prompt for selected videos or single video
  const promptDeleteBatch = () => {
    if (selectedVideoIds.size === 0) return;
    setIdsToDelete(Array.from(selectedVideoIds));
    setIsConfirmingDelete(true);
  };

  const promptDeleteSingle = (videoId: string) => {
    setIdsToDelete([videoId]);
    setIsConfirmingDelete(true);
  };

  const handleExecuteDelete = async () => {
    if (idsToDelete.length === 0) return;

    try {
      setIsDeleting(true);
      await deleteJobs(idsToDelete);

      // Clear selections for deleted IDs
      setSelectedVideoIds((prev) => {
        const next = new Set(prev);
        idsToDelete.forEach((id) => next.delete(id));
        return next;
      });

      // Close modals
      setIsConfirmingDelete(false);
      if (selectedJob && idsToDelete.includes(selectedJob.video_id)) {
        setIsViewingDetails(false);
      }
      setIdsToDelete([]);

      // Refresh list
      onRefresh();
    } catch (err) {
      console.error('Failed to delete videos:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUnarchive = async (videoIds: string[]) => {
    if (videoIds.length === 0) return;

    try {
      setUnarchivingId(videoIds.length === 1 ? videoIds[0] : 'batch');
      await unarchiveJobs(videoIds);
      setSelectedVideoIds((prev) => {
        const next = new Set(prev);
        videoIds.forEach((id) => next.delete(id));
        return next;
      });
      if (selectedJob && videoIds.includes(selectedJob.video_id)) {
        setIsViewingDetails(false);
      }
      onRefresh();
    } catch (err) {
      console.error('Failed to unarchive videos:', err);
    } finally {
      setUnarchivingId(null);
    }
  };

  const isAllFilteredSelected =
    filteredJobs.length > 0 && filteredJobs.every((j) => selectedVideoIds.has(j.video_id));

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/80 border border-amber-500/20 rounded-3xl p-6 backdrop-blur-xl shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1a2 2 0 01-2 2M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              Archived Videos
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {archivedJobs.length}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Videos that have been archived from the main job queue. You can permanently delete selected videos and their files.
            </p>
          </div>
        </div>
      </div>

      {/* Selection Action Bar (Shown when videos are selected) */}
      {selectedVideoIds.size > 0 && (
        <div className="bg-rose-950/40 border border-rose-800/60 rounded-2xl p-4 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
            <span className="text-sm font-bold text-rose-200">
              {selectedVideoIds.size} video{selectedVideoIds.size > 1 ? 's' : ''} selected
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedVideoIds(new Set())}
              className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Clear Selection
            </button>
            <button
              onClick={promptDeleteBatch}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Selected ({selectedVideoIds.size})
            </button>
            <button
              onClick={() => handleUnarchive(Array.from(selectedVideoIds))}
              disabled={unarchivingId === 'batch'}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8m0 0V3m0 5h5" />
              </svg>
              {unarchivingId === 'batch' ? 'Restoring...' : 'Restore Selected'}
            </button>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 backdrop-blur-xl shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search filter input */}
          <div className="relative flex-1 min-w-50 max-w-sm">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search archived videos..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
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
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">All Statuses ({archivedJobs.length})</option>
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
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
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
            <span>{isWsConnected ? 'Live Updates' : 'Polling'}</span>
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors disabled:opacity-50"
            title="Refresh archived jobs"
          >
            <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Archived Jobs Grid / Table */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl">
        {filteredJobs.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <svg className="w-12 h-12 text-slate-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1a2 2 0 01-2 2M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <p className="text-base font-semibold text-slate-400">No archived videos found</p>
            <p className="text-xs text-slate-500 mt-1">
              {archivedJobs.length === 0
                ? 'Videos you archive from the Job Queue will appear here.'
                : 'No archived videos match your search/filter criteria.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={isAllFilteredSelected}
                      onChange={handleSelectAll}
                      className="rounded border-slate-700 bg-slate-900 text-rose-600 focus:ring-rose-500 focus:ring-offset-slate-950 w-4 h-4 cursor-pointer"
                      title="Select all filtered videos"
                    />
                  </th>
                  <th className="py-3.5 px-4 sm:px-6">Video / Title</th>
                  <th className="py-3.5 px-4">Source</th>
                  <th className="py-3.5 px-4">Trend Score</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">State</th>
                  <th className="py-3.5 px-4">Added</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {filteredJobs.map((job) => {
                  const isSelected = selectedVideoIds.has(job.video_id);
                  return (
                    <tr
                      key={job.video_id}
                      className={`transition-colors group ${
                        isSelected ? 'bg-rose-950/20' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-4 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(job.video_id)}
                          className="rounded border-slate-700 bg-slate-900 text-rose-600 focus:ring-rose-500 focus:ring-offset-slate-950 w-4 h-4 cursor-pointer"
                        />
                      </td>

                      {/* Title & Channel */}
                      <td className="py-4 px-4 sm:px-6 max-w-xs sm:max-w-md">
                        <div className="font-semibold text-slate-200 truncate group-hover:text-amber-400 transition-colors">
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
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                            job.source === 'direct_url'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          }`}
                        >
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
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(
                            job.job_status
                          )}`}
                        >
                          {job.job_status}
                        </span>
                      </td>

                      {/* Video State */}
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          archived
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
                            onClick={() => handleUnarchive([job.video_id])}
                            disabled={unarchivingId === job.video_id}
                            className="p-1.5 text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg border border-emerald-500/30 transition-colors disabled:opacity-50"
                            title="Restore video to its designated area"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8m0 0V3m0 5h5" />
                            </svg>
                          </button>
                          <button
                            onClick={() => promptDeleteSingle(job.video_id)}
                            className="p-1.5 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg border border-rose-500/30 transition-colors"
                            title="Delete video and files"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
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

      {/* Confirmation Modal for Deletion */}
      {isConfirmingDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Delete Video{idsToDelete.length > 1 ? 's' : ''}?</h3>
                <p className="text-xs text-slate-400 mt-1">
                  This action is permanent and cannot be undone.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-300 space-y-2">
              <p>
                You are about to permanently delete <strong className="text-rose-400">{idsToDelete.length}</strong> video{idsToDelete.length > 1 ? 's' : ''}:
              </p>
              <ul className="list-disc list-inside text-slate-400 space-y-1 max-h-32 overflow-y-auto font-mono">
                {idsToDelete.map((id) => (
                  <li key={id}>{id}</li>
                ))}
              </ul>
              <p className="text-rose-400/90 text-[11px] pt-1">
                ⚠️ This will delete database entries and all associated media files, transcripts, and folders on disk.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setIsConfirmingDelete(false);
                  setIdsToDelete([]);
                }}
                disabled={isDeleting}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteDelete}
                disabled={isDeleting}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Permanently ({idsToDelete.length})</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Drawer / Modal */}
      {isViewingDetails && selectedJob && (
        <div className="fixed inset-0 z-50 min-h-full overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="my-8 bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusBadge(selectedJob.job_status)}`}>
                    {selectedJob.job_status}
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    archived
                  </span>
                </div>
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
                <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full mx-auto" />
                <p className="text-xs mt-2">Loading metadata...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block">Video ID</span>
                  <span className="font-mono text-slate-200 break-all">{selectedJob.metadata?.id || selectedJob.video_id}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block">Title</span>
                  <span className="font-semibold text-slate-200">{selectedJob.metadata?.title || selectedJob.title || 'Unknown'}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block">Channel</span>
                  <span className="font-semibold text-slate-200">{selectedJob.metadata?.channel?.name || selectedJob.channel || 'Unknown'}</span>
                  {selectedJob.metadata?.channel?.id && <span className="font-mono text-slate-500 block mt-1 break-all">{selectedJob.metadata.channel.id}</span>}
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block">Subscribers</span>
                  <span className="font-semibold text-slate-200">{selectedJob.metadata?.channel?.subscriber_count?.toLocaleString() || 'Unknown'}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block">Video Length</span>
                  <span className="font-semibold text-slate-200">{formatDuration(selectedJob.metadata?.details?.duration)}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block">Published</span>
                  <span className="font-semibold text-slate-200">{selectedJob.metadata?.published_at ? new Date(selectedJob.metadata.published_at).toLocaleString() : 'Unknown'}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 sm:col-span-2">
                  <span className="text-slate-500 block">Video URL</span>
                  {selectedJob.metadata?.url ? <a href={selectedJob.metadata.url} target="_blank" rel="noreferrer" className="text-indigo-300 hover:text-indigo-200 break-all">{selectedJob.metadata.url}</a> : <span className="text-slate-400">Unknown</span>}
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block">Views</span>
                  <span className="font-semibold text-slate-200">{selectedJob.metadata?.statistics?.views?.toLocaleString() || 'Unknown'}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block">Likes</span>
                  <span className="font-semibold text-slate-200">{selectedJob.metadata?.statistics?.likes?.toLocaleString() || 'Unknown'}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block">Comments</span>
                  <span className="font-semibold text-slate-200">{selectedJob.metadata?.statistics?.comments?.toLocaleString() || 'Unknown'}</span>
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
                  <span className="text-slate-500 block">Source</span>
                  <span className="font-semibold text-slate-200 uppercase">{selectedJob.source}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block">Pipeline</span>
                  <div className="mt-1 space-y-1 text-slate-300">
                    {Object.entries(selectedJob.metadata?.pipeline || {}).map(([stage, complete]) => (
                      <div key={stage} className="flex justify-between gap-3"><span>{stage}</span><span className={complete ? 'text-emerald-400' : 'text-slate-500'}>{complete ? 'Complete' : 'Pending'}</span></div>
                    ))}
                    {!selectedJob.metadata?.pipeline && <span className="text-slate-500">Unknown</span>}
                  </div>
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
                onClick={() => handleUnarchive([selectedJob.video_id])}
                disabled={unarchivingId === selectedJob.video_id}
                className="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8m0 0V3m0 5h5" />
                </svg>
                {unarchivingId === selectedJob.video_id ? 'Restoring...' : 'Restore Video'}
              </button>
              <button
                onClick={() => promptDeleteSingle(selectedJob.video_id)}
                className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Video
              </button>
              <a
                href={`https://youtube.com/watch?v=${selectedJob.video_id}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl transition-colors"
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
