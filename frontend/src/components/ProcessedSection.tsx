import React, { useState, useEffect, useCallback } from 'react';
import { getJobClips, archiveJobs, getUploadChannels, previewUploadSchedule, createScheduledUploads, API_BASE_URL } from '../services/api';
import type { Job, Clip, UploadChannel, UploadScheduleItem } from '../services/api';

interface ProcessedSectionProps {
  jobs: Job[];
  isLoading: boolean;
  onRefresh: () => void;
}

export const ProcessedSection: React.FC<ProcessedSectionProps> = ({
  jobs,
  isLoading,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [clipsMap, setClipsMap] = useState<Record<string, Clip[]>>({});
  const [loadingClips, setLoadingClips] = useState<Record<string, boolean>>({});
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [uploadChannels, setUploadChannels] = useState<UploadChannel[]>([]);
  const [channelId, setChannelId] = useState('');
  const [videosPerDay, setVideosPerDay] = useState(3);
  const [startDate, setStartDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [startTime, setStartTime] = useState('09:00');
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [schedulePreview, setSchedulePreview] = useState<UploadScheduleItem[]>([]);
  const [previewError, setPreviewError] = useState('');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSavingUploads, setIsSavingUploads] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');

  // Filter processed and non-archived jobs
  const processedJobs = jobs.filter(
    (job) => job.processing_state === 'processed' && job.video_state !== 'archived'
  );

  const filteredJobs = processedJobs.filter((job) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchTitle = (job.title || '').toLowerCase().includes(q);
    const matchChannel = (job.channel || '').toLowerCase().includes(q);
    const matchId = job.video_id.toLowerCase().includes(q);
    return matchTitle || matchChannel || matchId;
  });

  const fetchClipsForJob = useCallback(async (videoId: string) => {
    setLoadingClips((prev) => ({ ...prev, [videoId]: true }));
    try {
      const res = await getJobClips(videoId);
      setClipsMap((prev) => ({ ...prev, [videoId]: res.clips || [] }));
    } catch (err) {
      console.error(`Failed to fetch clips for ${videoId}:`, err);
      setClipsMap((prev) => ({ ...prev, [videoId]: [] }));
    } finally {
      setLoadingClips((prev) => ({ ...prev, [videoId]: false }));
    }
  }, []);

  useEffect(() => {
    // Fetch clips for all processed videos
    processedJobs.forEach((job) => {
      if (clipsMap[job.video_id] === undefined && !loadingClips[job.video_id]) {
        fetchClipsForJob(job.video_id);
      }
    });
  }, [processedJobs, clipsMap, loadingClips, fetchClipsForJob]);

  useEffect(() => {
    const availableIds = new Set(processedJobs.map((job) => job.video_id));
    setSelectedVideoIds((previous) => previous.filter((id) => availableIds.has(id)));
  }, [processedJobs]);

  useEffect(() => {
    if (selectedVideoIds.length === 0) return;
    getUploadChannels()
      .then((response) => {
        const channels = response.channels || [];
        setUploadChannels(channels);
        setChannelId((current) => current || channels[0]?.id || '');
      })
      .catch((error) => {
        console.error('Failed to load YouTube channels:', error);
        setUploadChannels([]);
      });
  }, [selectedVideoIds.length]);

  const toggleSelectedVideo = (videoId: string) => {
    setSelectedVideoIds((previous) => (
      previous.includes(videoId)
        ? previous.filter((id) => id !== videoId)
        : [...previous, videoId]
    ));
    setSchedulePreview([]);
    setUploadMessage('');
  };

  const uploadRequest = () => ({
    video_ids: selectedVideoIds,
    channel_id: channelId,
    videos_per_day: videosPerDay,
    start_date: startDate,
    start_time: startTime,
    timezone,
  });

  const handlePreview = async () => {
    if (!channelId) {
      setPreviewError('Configure and select a YouTube channel before previewing.');
      return;
    }
    try {
      setIsPreviewing(true);
      setPreviewError('');
      setUploadMessage('');
      const response = await previewUploadSchedule(uploadRequest());
      setSchedulePreview(response.schedule || []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to build the upload schedule.';
      setPreviewError(message);
      setSchedulePreview([]);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSaveUploads = async () => {
    try {
      setIsSavingUploads(true);
      setPreviewError('');
      const response = await createScheduledUploads(uploadRequest());
      setUploadMessage(response.message || `Started ${response.upload_count} upload jobs.`);
      setSelectedVideoIds([]);
      setSchedulePreview([]);
      onRefresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to create upload jobs.';
      setPreviewError(message);
    } finally {
      setIsSavingUploads(false);
    }
  };

  const handleArchiveJob = async (videoId: string) => {
    try {
      setArchivingId(videoId);
      await archiveJobs([videoId]);
      onRefresh();
    } catch (err) {
      console.error('Failed to archive job:', err);
    } finally {
      setArchivingId(null);
    }
  };

  const formatTime = (seconds?: number) => {
    if (seconds === undefined || seconds === null) return null;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 backdrop-blur-xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Processed Videos & Clips</h2>
            <p className="text-xs text-slate-400">
              Showing {filteredJobs.length} processed video{filteredJobs.length === 1 ? '' : 's'} with generated short-form clips
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search processed videos..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
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

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors disabled:opacity-50"
            title="Refresh processed videos"
          >
            <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {selectedVideoIds.length > 0 && (
        <section className="bg-indigo-950/30 border border-indigo-500/30 rounded-3xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white">YouTube upload schedule</h3>
              <p className="text-xs text-slate-400 mt-1">
                {selectedVideoIds.length} processed video{selectedVideoIds.length === 1 ? '' : 's'} selected. Every generated clip will be uploaded; clips cannot be selected individually.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
              {schedulePreview.length} clip{schedulePreview.length === 1 ? '' : 's'} scheduled
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <label className="text-xs text-slate-300 space-y-1.5">
              <span>YouTube channel</span>
              <select value={channelId} onChange={(event) => { setChannelId(event.target.value); setSchedulePreview([]); }} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Select a channel</option>
                {uploadChannels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-300 space-y-1.5">
              <span>Videos per day</span>
              <input type="number" min="1" max="96" value={videosPerDay} onChange={(event) => { setVideosPerDay(Math.max(1, Number(event.target.value) || 1)); setSchedulePreview([]); }} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </label>
            <label className="text-xs text-slate-300 space-y-1.5">
              <span>Start date</span>
              <input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setSchedulePreview([]); }} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </label>
            <label className="text-xs text-slate-300 space-y-1.5">
              <span>Start time</span>
              <input type="time" value={startTime} onChange={(event) => { setStartTime(event.target.value); setSchedulePreview([]); }} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </label>
            <label className="text-xs text-slate-300 space-y-1.5">
              <span>Timezone</span>
              <input value={timezone} onChange={(event) => { setTimezone(event.target.value); setSchedulePreview([]); }} placeholder="Asia/Kolkata" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </label>
          </div>

          {uploadChannels.length === 0 && (
            <p className="text-xs text-amber-300">No configured YouTube channels are available. Add a channel credential to the existing multi-channel configuration first.</p>
          )}
          {previewError && <p className="text-xs text-rose-300">{previewError}</p>}
          {uploadMessage && <p className="text-xs text-emerald-300">{uploadMessage}</p>}

          <div className="flex flex-wrap gap-3">
            <button onClick={handlePreview} disabled={isPreviewing || !channelId} className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white disabled:opacity-50">
              {isPreviewing ? 'Building preview...' : 'Preview schedule'}
            </button>
            <button onClick={handleSaveUploads} disabled={isSavingUploads || schedulePreview.length === 0 || !channelId} className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-50">
              {isSavingUploads ? 'Creating uploads...' : 'Save & upload scheduled videos'}
            </button>
          </div>

          {schedulePreview.length > 0 && (
            <div className="overflow-x-auto border border-slate-800 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider">
                  <tr><th className="p-3">Clip</th><th className="p-3">Source</th><th className="p-3">Day / slot</th><th className="p-3">Publish time</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {schedulePreview.map((item) => (
                    <tr key={`${item.source_video_id}-${item.clip_id}`} className="text-slate-300">
                      <td className="p-3 font-medium">{item.title}</td><td className="p-3 font-mono text-slate-500">{item.source_video_id}</td><td className="p-3">Day {item.day_number}, slot {item.slot_number}</td><td className="p-3">{new Date(item.display_publish_at).toLocaleString(undefined, { timeZone: item.timezone, dateStyle: 'medium', timeStyle: 'short' })} ({item.timezone})</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Main Content Area */}
      {filteredJobs.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-16 text-center text-slate-500">
          <svg className="w-12 h-12 text-slate-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p className="text-base font-semibold text-slate-400">No processed videos found</p>
          <p className="text-xs text-slate-500 mt-1">Select videos from the Job Queue and click "Process Selected" to generate clips.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredJobs.map((job) => {
            const clips = clipsMap[job.video_id] || [];
            const isClipsLoading = loadingClips[job.video_id];

            return (
              <div
                key={job.video_id}
                className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl shadow-xl space-y-6"
              >
                {/* Video Info Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        Processed
                      </span>
                      {job.trend_score !== null && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
                          ★ {Number(job.trend_score).toFixed(3)}
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-bold text-slate-100 mt-2">{job.title || job.video_id}</h3>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
                      <span className="font-semibold text-slate-300">{job.channel || 'Unknown Channel'}</span>
                      <span>•</span>
                      <span className="font-mono text-slate-500">{job.video_id}</span>
                      <span>•</span>
                      <span className="text-slate-500">
                        Processed on {new Date(job.updated_at).toLocaleDateString()} at{' '}
                        {new Date(job.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <label className="px-3 py-1.5 text-xs font-medium text-indigo-200 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-xl border border-indigo-500/30 transition-colors flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedVideoIds.includes(job.video_id)}
                        onChange={() => toggleSelectedVideo(job.video_id)}
                        className="accent-indigo-500"
                        aria-label={`Select ${job.title || job.video_id} for upload`}
                      />
                      <span>Upload all clips</span>
                    </label>
                    <button
                      onClick={() => handleArchiveJob(job.video_id)}
                      disabled={archivingId === job.video_id}
                      className="px-3 py-1.5 text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl border border-amber-500/30 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1a2 2 0 01-2 2M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                      <span>{archivingId === job.video_id ? 'Archiving...' : 'Archive'}</span>
                    </button>

                    <a
                      href={`https://youtube.com/watch?v=${job.video_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5"
                    >
                      <span>YouTube</span>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                </div>

                {/* Generated Clips Display */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                      </svg>
                      <span>Generated Clips ({clips.length})</span>
                    </h4>

                    <button
                      onClick={() => fetchClipsForJob(job.video_id)}
                      disabled={isClipsLoading}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                    >
                      <svg className={`w-3 h-3 ${isClipsLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Reload Clips</span>
                    </button>
                  </div>

                  {isClipsLoading ? (
                    <div className="py-8 text-center text-slate-500">
                      <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-2" />
                      <p className="text-xs">Loading generated clips...</p>
                    </div>
                  ) : clips.length === 0 ? (
                    <div className="bg-slate-950/60 rounded-2xl p-6 text-center text-slate-500 border border-slate-800/60">
                      <p className="text-xs text-slate-400">No clip files found for this video yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {clips.map((clip, index) => (
                        <div
                          key={clip.id || index}
                          className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3 hover:border-slate-700 transition-colors"
                        >
                          <div className="space-y-2">
                            {/* Video Player */}
                            <video
                              src={`${API_BASE_URL}${clip.url}`}
                              controls
                              preload="metadata"
                              className="w-full aspect-9/16 rounded-xl bg-black border border-slate-800 object-cover max-h-80 mx-auto"
                            />

                            <div className="pt-1">
                              <div className="flex items-start justify-between gap-2">
                                <h5 className="text-xs font-bold text-slate-200 line-clamp-2">
                                  {index + 1}. {clip.title || clip.filename}
                                </h5>
                                {clip.score && (
                                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-300 shrink-0">
                                    {clip.score} pts
                                  </span>
                                )}
                              </div>

                              {(clip.start !== undefined && clip.end !== undefined) && (
                                <p className="text-[11px] text-slate-500 mt-1 font-mono">
                                  Time: {formatTime(clip.start)} - {formatTime(clip.end)}
                                </p>
                              )}

                              {clip.summary && (
                                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 italic">
                                  "{clip.summary}"
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                            <span className="text-[10px] text-slate-500 font-mono truncate max-w-37.5">
                              {clip.filename}
                            </span>

                            <a
                              href={`${API_BASE_URL}${clip.url}`}
                              download={clip.filename}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 text-xs font-medium text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg transition-colors flex items-center gap-1"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              <span>Download</span>
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
