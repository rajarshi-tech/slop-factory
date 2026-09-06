import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  getJobClips,
  archiveJobs,
  getUploadChannels,
  previewUploadSchedule,
  createScheduledUploads,
  getUploadJobs,
  updateClipMetadata,
  updateJobTitle,
  API_BASE_URL,
} from '../services/api';
import type {
  Job,
  Clip,
  UploadChannel,
  UploadScheduleItem,
  UploadJob,
  ClipScheduleOverride,
} from '../services/api';

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

  // Upload status and confirmation tracking
  const [uploadJobs, setUploadJobs] = useState<UploadJob[]>([]);
  const [confirmations, setConfirmations] = useState<Array<{ id: string; message: string; videoId?: string; time: string }>>([]);
  const prevUploadStatusRef = useRef<Record<number, string>>({});

  // Clip editing state: clipId -> { title, description, isEditing, isSaving, message }
  const [clipEdits, setClipEdits] = useState<
    Record<string, { title: string; description: string; isEditing: boolean; isSaving: boolean; message?: string }>
  >({});

  // Video title editing state: videoId -> { title, isEditing, isSaving }
  const [videoTitleEdits, setVideoTitleEdits] = useState<
    Record<string, { title: string; isEditing: boolean; isSaving: boolean }>
  >({});

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

  // Map upload jobs by clip_id (latest upload job per clip)
  const uploadJobsByClipId = useMemo(() => {
    const map: Record<string, UploadJob> = {};
    for (const job of uploadJobs) {
      if (!map[job.clip_id] || new Date(job.updated_at) > new Date(map[job.clip_id].updated_at)) {
        map[job.clip_id] = job;
      }
    }
    return map;
  }, [uploadJobs]);

  // Active uploads count
  const activeUploadingCount = useMemo(() => {
    return uploadJobs.filter((j) => j.upload_status === 'uploading' || j.upload_status === 'queued').length;
  }, [uploadJobs]);

  const fetchUploadJobs = useCallback(async () => {
    try {
      const res = await getUploadJobs();
      const currentJobs = res.upload_jobs || [];

      // Check for newly uploaded jobs to show confirmation notifications
      const prev = prevUploadStatusRef.current;
      currentJobs.forEach((job) => {
        const prevStatus = prev[job.id];
        if (prevStatus && prevStatus !== 'uploaded' && job.upload_status === 'uploaded') {
          setConfirmations((c) => [
            {
              id: `${job.id}-${Date.now()}`,
              message: `Upload Confirmed: "${job.title}" has been successfully uploaded to YouTube!`,
              videoId: job.youtube_video_id,
              time: new Date().toLocaleTimeString(),
            },
            ...c.slice(0, 5),
          ]);
          // Also refresh parent to check if source video was auto-archived
          onRefresh();
        }
      });

      // Update ref
      const newStatusMap: Record<number, string> = {};
      currentJobs.forEach((j) => {
        newStatusMap[j.id] = j.upload_status;
      });
      prevUploadStatusRef.current = newStatusMap;

      setUploadJobs(currentJobs);
    } catch (err) {
      console.error('Failed to fetch upload jobs:', err);
    }
  }, [onRefresh]);

  // Periodic poll for upload jobs
  useEffect(() => {
    fetchUploadJobs();
    const interval = setInterval(fetchUploadJobs, activeUploadingCount > 0 ? 3000 : 8000);
    return () => clearInterval(interval);
  }, [fetchUploadJobs, activeUploadingCount]);

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
    setSelectedVideoIds((previous) =>
      previous.includes(videoId) ? previous.filter((id) => id !== videoId) : [...previous, videoId]
    );
    setSchedulePreview([]);
    setUploadMessage('');
  };

  const uploadRequest = (overrides?: ClipScheduleOverride[]) => ({
    video_ids: selectedVideoIds,
    channel_id: channelId,
    videos_per_day: videosPerDay,
    start_date: startDate,
    start_time: startTime,
    timezone,
    clip_overrides: overrides,
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

  const handleScheduleItemChange = (
    index: number,
    field: 'title' | 'description',
    value: string
  ) => {
    setSchedulePreview((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSaveUploads = async () => {
    try {
      setIsSavingUploads(true);
      setPreviewError('');
      // Build clip overrides from the editable schedule preview
      const overrides: ClipScheduleOverride[] = schedulePreview.map((item) => ({
        clip_id: item.clip_id,
        title: item.title,
        description: item.description || '',
      }));

      const response = await createScheduledUploads(uploadRequest(overrides));
      setUploadMessage(response.message || `Started ${response.upload_count} upload jobs.`);
      setSelectedVideoIds([]);
      setSchedulePreview([]);
      fetchUploadJobs();
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

  // Source video title editing
  const startEditingVideoTitle = (job: Job) => {
    setVideoTitleEdits((prev) => ({
      ...prev,
      [job.video_id]: {
        title: job.title || job.video_id,
        isEditing: true,
        isSaving: false,
      },
    }));
  };

  const cancelEditingVideoTitle = (videoId: string) => {
    setVideoTitleEdits((prev) => ({
      ...prev,
      [videoId]: { ...prev[videoId], isEditing: false },
    }));
  };

  const saveVideoTitle = async (videoId: string) => {
    const edit = videoTitleEdits[videoId];
    if (!edit || !edit.title.trim()) return;

    setVideoTitleEdits((prev) => ({
      ...prev,
      [videoId]: { ...prev[videoId], isSaving: true },
    }));

    try {
      await updateJobTitle(videoId, edit.title.trim());
      setVideoTitleEdits((prev) => ({
        ...prev,
        [videoId]: { ...prev[videoId], isEditing: false, isSaving: false },
      }));
      onRefresh();
    } catch (err) {
      console.error(`Failed to save video title for ${videoId}:`, err);
      setVideoTitleEdits((prev) => ({
        ...prev,
        [videoId]: { ...prev[videoId], isSaving: false },
      }));
    }
  };

  // Clip title & description editing
  const startEditingClip = (clip: Clip) => {
    setClipEdits((prev) => ({
      ...prev,
      [clip.id]: {
        title: clip.title || clip.filename,
        description: clip.description || '',
        isEditing: true,
        isSaving: false,
      },
    }));
  };

  const cancelEditingClip = (clipId: string) => {
    setClipEdits((prev) => ({
      ...prev,
      [clipId]: { ...prev[clipId], isEditing: false },
    }));
  };

  const resetClipToDefault = (clip: Clip) => {
    setClipEdits((prev) => ({
      ...prev,
      [clip.id]: {
        title: clip.filename.replace('.mp4', ''),
        description: clip.summary || '',
        isEditing: true,
        isSaving: false,
      },
    }));
  };

  const saveClipEdits = async (videoId: string, clipId: string) => {
    const edit = clipEdits[clipId];
    if (!edit) return;

    setClipEdits((prev) => ({
      ...prev,
      [clipId]: { ...prev[clipId], isSaving: true, message: undefined },
    }));

    try {
      await updateClipMetadata(videoId, clipId, {
        title: edit.title.trim(),
        description: edit.description.trim(),
      });

      // Update local clipsMap state
      setClipsMap((prev) => {
        const list = prev[videoId] || [];
        const updated = list.map((c) =>
          c.id === clipId
            ? { ...c, title: edit.title.trim(), description: edit.description.trim() }
            : c
        );
        return { ...prev, [videoId]: updated };
      });

      setClipEdits((prev) => ({
        ...prev,
        [clipId]: { ...prev[clipId], isEditing: false, isSaving: false, message: 'Saved!' },
      }));

      // Clear success message after 3 seconds
      setTimeout(() => {
        setClipEdits((prev) => {
          if (prev[clipId]) {
            return { ...prev, [clipId]: { ...prev[clipId], message: undefined } };
          }
          return prev;
        });
      }, 3000);
    } catch (err) {
      console.error(`Failed to save clip ${clipId}:`, err);
      setClipEdits((prev) => ({
        ...prev,
        [clipId]: { ...prev[clipId], isSaving: false, message: 'Failed to save' },
      }));
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
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
            onClick={() => {
              fetchUploadJobs();
              onRefresh();
            }}
            disabled={isLoading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors disabled:opacity-50"
            title="Refresh processed videos & upload statuses"
          >
            <svg
              className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Uploading Status Banner */}
      {activeUploadingCount > 0 && (
        <div className="bg-gradient-to-r from-blue-950/70 to-indigo-950/70 border border-blue-500/40 rounded-2xl p-4 shadow-lg backdrop-blur-xl flex items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold text-blue-200">
                Videos are currently uploading to YouTube...
              </p>
              <p className="text-[11px] text-blue-300/80">
                {activeUploadingCount} clip{activeUploadingCount === 1 ? '' : 's'} in progress. Videos will automatically move to archives once all clips are uploaded.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-500/20 text-blue-300 border border-blue-400/30 shrink-0">
            Uploading ({activeUploadingCount})
          </span>
        </div>
      )}

      {/* Upload Confirmations Notification List */}
      {confirmations.length > 0 && (
        <div className="space-y-2">
          {confirmations.map((conf) => (
            <div
              key={conf.id}
              className="bg-emerald-950/60 border border-emerald-500/40 rounded-2xl p-4 shadow-lg backdrop-blur-xl flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 font-bold shrink-0">
                  ✓
                </span>
                <span className="font-semibold text-emerald-200">{conf.message}</span>
                {conf.videoId && (
                  <a
                    href={`https://youtube.com/watch?v=${conf.videoId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-emerald-400 hover:underline shrink-0"
                  >
                    View on YouTube ({conf.videoId})
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-emerald-400/70">{conf.time}</span>
                <button
                  onClick={() => setConfirmations((prev) => prev.filter((c) => c.id !== conf.id))}
                  className="text-emerald-400/70 hover:text-emerald-200 p-1"
                  title="Dismiss"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* YouTube Upload Schedule Section */}
      {selectedVideoIds.length > 0 && (
        <section className="bg-indigo-950/30 border border-indigo-500/30 rounded-3xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white">YouTube upload schedule</h3>
              <p className="text-xs text-slate-400 mt-1">
                {selectedVideoIds.length} processed video{selectedVideoIds.length === 1 ? '' : 's'} selected. Preview and customize each video/clip title & description before scheduling.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
              {schedulePreview.length} clip{schedulePreview.length === 1 ? '' : 's'} scheduled
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <label className="text-xs text-slate-300 space-y-1.5">
              <span>YouTube channel</span>
              <select
                value={channelId}
                onChange={(event) => {
                  setChannelId(event.target.value);
                  setSchedulePreview([]);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select a channel</option>
                {uploadChannels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-300 space-y-1.5">
              <span>Videos per day</span>
              <input
                type="number"
                min="1"
                max="96"
                value={videosPerDay}
                onChange={(event) => {
                  setVideosPerDay(Math.max(1, Number(event.target.value) || 1));
                  setSchedulePreview([]);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <label className="text-xs text-slate-300 space-y-1.5">
              <span>Start date</span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  setSchedulePreview([]);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <label className="text-xs text-slate-300 space-y-1.5">
              <span>Start time</span>
              <input
                type="time"
                value={startTime}
                onChange={(event) => {
                  setStartTime(event.target.value);
                  setSchedulePreview([]);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <label className="text-xs text-slate-300 space-y-1.5">
              <span>Timezone</span>
              <input
                value={timezone}
                onChange={(event) => {
                  setTimezone(event.target.value);
                  setSchedulePreview([]);
                }}
                placeholder="Asia/Kolkata"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
          </div>

          {uploadChannels.length === 0 && (
            <p className="text-xs text-amber-300">
              No configured YouTube channels are available. Add a channel credential in YouTube Channels section first.
            </p>
          )}
          {previewError && <p className="text-xs text-rose-300">{previewError}</p>}
          {uploadMessage && <p className="text-xs text-emerald-300">{uploadMessage}</p>}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handlePreview}
              disabled={isPreviewing || !channelId}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white disabled:opacity-50 transition-colors"
            >
              {isPreviewing ? 'Building preview...' : 'Preview schedule'}
            </button>
            <button
              onClick={handleSaveUploads}
              disabled={isSavingUploads || schedulePreview.length === 0 || !channelId}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-50 transition-colors"
            >
              {isSavingUploads ? 'Creating uploads...' : 'Save & upload scheduled videos'}
            </button>
          </div>

          {/* Editable Preview Schedule Table */}
          {schedulePreview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>You can edit the title and description for each scheduled clip below before uploading:</span>
                <span className="text-[11px] font-mono text-indigo-300">Default titles are prefilled</span>
              </div>

              <div className="overflow-x-auto border border-slate-800 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="p-3 w-1/3">Clip / Title (Editable)</th>
                      <th className="p-3 w-1/3">Description (Editable)</th>
                      <th className="p-3">Day / slot</th>
                      <th className="p-3">Publish time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {schedulePreview.map((item, idx) => (
                      <tr key={`${item.source_video_id}-${item.clip_id}`} className="text-slate-300 hover:bg-slate-900/40">
                        <td className="p-3 space-y-1">
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => handleScheduleItemChange(idx, 'title', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                            placeholder="Video title..."
                            maxLength={100}
                          />
                          <p className="text-[10px] text-slate-500 font-mono">
                            {item.clip_filename} ({item.source_video_id})
                          </p>
                        </td>
                        <td className="p-3">
                          <textarea
                            value={item.description || ''}
                            onChange={(e) => handleScheduleItemChange(idx, 'description', e.target.value)}
                            rows={2}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none resize-none"
                            placeholder="Add description for this video..."
                          />
                        </td>
                        <td className="p-3 whitespace-nowrap text-slate-400">
                          Day {item.day_number}, slot {item.slot_number}
                        </td>
                        <td className="p-3 whitespace-nowrap text-slate-400">
                          {new Date(item.display_publish_at).toLocaleString(undefined, {
                            timeZone: item.timezone,
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}{' '}
                          <span className="text-[10px] text-slate-500 font-mono">({item.timezone})</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Main Content Area */}
      {filteredJobs.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-16 text-center text-slate-500">
          <svg className="w-12 h-12 text-slate-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <p className="text-base font-semibold text-slate-400">No processed videos found</p>
          <p className="text-xs text-slate-500 mt-1">
            Select videos from the Job Queue and click "Process Selected" to generate clips.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredJobs.map((job) => {
            const clips = clipsMap[job.video_id] || [];
            const isClipsLoading = loadingClips[job.video_id];
            const titleEdit = videoTitleEdits[job.video_id];

            return (
              <div
                key={job.video_id}
                className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl shadow-xl space-y-6 transition-all"
              >
                {/* Video Info Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-800/80 pb-5">
                  <div className="flex-1 min-w-0">
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

                    {/* Source Video Title - Editable */}
                    <div className="mt-2">
                      {titleEdit?.isEditing ? (
                        <div className="flex items-center gap-2 max-w-xl">
                          <input
                            type="text"
                            value={titleEdit.title}
                            onChange={(e) =>
                              setVideoTitleEdits((prev) => ({
                                ...prev,
                                [job.video_id]: { ...prev[job.video_id], title: e.target.value },
                              }))
                            }
                            className="bg-slate-950 border border-purple-500/60 rounded-xl px-3 py-1.5 text-base font-bold text-white focus:outline-none focus:ring-2 focus:ring-purple-500 w-full"
                          />
                          <button
                            onClick={() => saveVideoTitle(job.video_id)}
                            disabled={titleEdit.isSaving || !titleEdit.title.trim()}
                            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold disabled:opacity-50 shrink-0"
                          >
                            {titleEdit.isSaving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => cancelEditingVideoTitle(job.video_id)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium shrink-0"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group">
                          <h3 className="text-lg font-bold text-slate-100 truncate">
                            {job.title || job.video_id}
                          </h3>
                          <button
                            onClick={() => startEditingVideoTitle(job)}
                            className="text-slate-500 hover:text-purple-400 p-1 opacity-60 group-hover:opacity-100 transition-opacity"
                            title="Edit video title"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                              />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>

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
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 8h14M5 8a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1a2 2 0 01-2 2M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                        />
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
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </a>
                  </div>
                </div>

                {/* Generated Clips Display */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                        />
                      </svg>
                      <span>Generated Clips ({clips.length})</span>
                    </h4>

                    <button
                      onClick={() => fetchClipsForJob(job.video_id)}
                      disabled={isClipsLoading}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                    >
                      <svg
                        className={`w-3 h-3 ${isClipsLoading ? 'animate-spin' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
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
                      {clips.map((clip, index) => {
                        const clipEdit = clipEdits[clip.id];
                        const uploadJob = uploadJobsByClipId[clip.id];

                        return (
                          <div
                            key={clip.id || index}
                            className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3 hover:border-slate-700 transition-colors"
                          >
                            <div className="space-y-2">
                              {/* Upload Status Badge on Clip Card */}
                              {uploadJob && (
                                <div className="mb-1">
                                  {uploadJob.upload_status === 'uploading' && (
                                    <div className="flex items-center justify-between p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-[11px] font-semibold animate-pulse">
                                      <span className="flex items-center gap-1.5">
                                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Uploading to YouTube...
                                      </span>
                                      <span className="text-[10px] text-blue-400 font-mono">In Progress</span>
                                    </div>
                                  )}
                                  {uploadJob.upload_status === 'queued' && (
                                    <div className="flex items-center justify-between p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-[11px] font-semibold">
                                      <span className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                                        Upload Queued
                                      </span>
                                    </div>
                                  )}
                                  {uploadJob.upload_status === 'uploaded' && (
                                    <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold">
                                      <span className="flex items-center gap-1.5">
                                        <span className="text-emerald-400 font-bold">✓</span>
                                        Uploaded to YouTube
                                      </span>
                                      {uploadJob.youtube_video_id && (
                                        <a
                                          href={`https://youtube.com/watch?v=${uploadJob.youtube_video_id}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-[10px] font-mono text-emerald-400 underline hover:text-emerald-300"
                                        >
                                          {uploadJob.youtube_video_id}
                                        </a>
                                      )}
                                    </div>
                                  )}
                                  {uploadJob.upload_status === 'failed' && (
                                    <div
                                      className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] font-semibold"
                                      title={uploadJob.error_message || 'Upload failed'}
                                    >
                                      ✕ Upload Failed: {uploadJob.error_message || 'Unknown error'}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Video Player */}
                              <video
                                src={`${API_BASE_URL}${clip.url}`}
                                controls
                                preload="metadata"
                                className="w-full aspect-9/16 rounded-xl bg-black border border-slate-800 object-cover max-h-72 mx-auto"
                              />

                              <div className="pt-1 space-y-2">
                                {/* Title & Edit Mode */}
                                {clipEdit?.isEditing ? (
                                  <div className="space-y-2 bg-slate-900/90 p-3 rounded-xl border border-purple-500/40">
                                    <div>
                                      <label className="text-[10px] font-semibold uppercase text-slate-400">
                                        Title (YouTube)
                                      </label>
                                      <input
                                        type="text"
                                        value={clipEdit.title}
                                        onChange={(e) =>
                                          setClipEdits((prev) => ({
                                            ...prev,
                                            [clip.id]: { ...prev[clip.id], title: e.target.value },
                                          }))
                                        }
                                        className="w-full mt-1 bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                                        placeholder="Video title..."
                                        maxLength={100}
                                      />
                                    </div>

                                    <div>
                                      <label className="text-[10px] font-semibold uppercase text-slate-400">
                                        Description
                                      </label>
                                      <textarea
                                        value={clipEdit.description}
                                        onChange={(e) =>
                                          setClipEdits((prev) => ({
                                            ...prev,
                                            [clip.id]: { ...prev[clip.id], description: e.target.value },
                                          }))
                                        }
                                        rows={3}
                                        className="w-full mt-1 bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none resize-none"
                                        placeholder="Add description for this video..."
                                      />
                                    </div>

                                    <div className="flex items-center justify-between pt-1">
                                      <button
                                        type="button"
                                        onClick={() => resetClipToDefault(clip)}
                                        className="text-[10px] text-slate-400 hover:text-slate-200"
                                      >
                                        Reset to default
                                      </button>
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => cancelEditingClip(clip.id)}
                                          className="px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => saveClipEdits(job.video_id, clip.id)}
                                          disabled={clipEdit.isSaving || !clipEdit.title.trim()}
                                          className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-[11px] disabled:opacity-50"
                                        >
                                          {clipEdit.isSaving ? 'Saving...' : 'Save'}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="flex items-start justify-between gap-2">
                                      <h5 className="text-xs font-bold text-slate-200 line-clamp-2">
                                        {index + 1}. {clip.title || clip.filename}
                                      </h5>
                                      <div className="flex items-center gap-1 shrink-0">
                                        {clip.score && (
                                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-300">
                                            {clip.score} pts
                                          </span>
                                        )}
                                        <button
                                          onClick={() => startEditingClip(clip)}
                                          className="text-slate-500 hover:text-purple-400 p-1"
                                          title="Edit title & description"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2}
                                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                            />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>

                                    {clipEdit?.message && (
                                      <span className="text-[10px] text-emerald-400 font-semibold block mt-0.5">
                                        {clipEdit.message}
                                      </span>
                                    )}

                                    {clip.start !== undefined && clip.end !== undefined && (
                                      <p className="text-[11px] text-slate-500 mt-1 font-mono">
                                        Time: {formatTime(clip.start)} - {formatTime(clip.end)}
                                      </p>
                                    )}

                                    {/* Video Description Display */}
                                    {clip.description ? (
                                      <div className="mt-1.5 p-2 bg-slate-900/60 rounded-xl border border-slate-800 text-[11px] text-slate-300">
                                        <span className="text-[9px] font-semibold text-slate-500 uppercase block mb-0.5">
                                          Description:
                                        </span>
                                        <p className="line-clamp-2 whitespace-pre-wrap">{clip.description}</p>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => startEditingClip(clip)}
                                        className="text-[11px] text-slate-500 hover:text-purple-400 font-medium flex items-center gap-1 mt-1"
                                      >
                                        <span>+ Add description</span>
                                      </button>
                                    )}

                                    {clip.summary && !clip.description && (
                                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 italic">
                                        "{clip.summary}"
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                              <span className="text-[10px] text-slate-500 font-mono truncate max-w-37.5">
                                {clip.filename}
                              </span>

                              <div className="flex items-center gap-2">
                                <a
                                  href={`${API_BASE_URL}${clip.url}`}
                                  download={clip.filename}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2.5 py-1 text-xs font-medium text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg transition-colors flex items-center gap-1"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                    />
                                  </svg>
                                  <span>Download</span>
                                </a>
                              </div>
                            </div>
                          </div>
                        );
                      })}
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
