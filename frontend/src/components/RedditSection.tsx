import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  API_BASE_URL,
  WS_BASE_URL,
  archiveRedditItems,
  createRedditJob,
  deleteRedditItems,
  getRedditBackgroundVideo,
  getRedditJobs,
  processRedditItems,
  unarchiveRedditItems,
  uploadRedditBackgroundVideo,
} from '../services/api';
import type { RedditBackgroundStatus, RedditJob } from '../services/api';

type QueueFilter = 'active' | 'archived';

function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = error.response;
    if (typeof response === 'object' && response !== null && 'data' in response) {
      const data = response.data;
      if (typeof data === 'object' && data !== null && 'detail' in data && typeof data.detail === 'string') {
        return data.detail;
      }
    }
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just added';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function statusStyle(status: string): string {
  if (status === 'completed') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300';
  if (status === 'failed') return 'border-rose-400/20 bg-rose-400/10 text-rose-300';
  if (['generating_audio', 'transcribing', 'generating_video'].includes(status)) {
    return 'border-orange-400/20 bg-orange-400/10 text-orange-200';
  }
  return 'border-slate-700 bg-slate-800/80 text-slate-300';
}

function statusLabel(status: string): string {
  return status.replaceAll('_', ' ');
}

function Icon({ name, className = 'h-5 w-5' }: { name: 'reddit' | 'spark' | 'upload' | 'play' | 'archive' | 'restore' | 'trash' | 'refresh' | 'check' | 'video' | 'clock'; className?: string }) {
  const paths: Record<typeof name, string> = {
    reddit: 'M12 2a2 2 0 0 1 1.94 1.52l2.2.44a2.1 2.1 0 1 1-.17 1.99l-2.42-.49-.74 3.14c2.6.13 4.9 1.04 6.13 2.43a1.8 1.8 0 1 1 1.72 2.33c.13.55.2 1.13.2 1.74 0 4.15-4.86 7.52-10.86 7.52S1.14 19.25 1.14 15.1c0-.6.07-1.19.2-1.74a1.8 1.8 0 1 1 1.72-2.33c1.23-1.39 3.54-2.3 6.14-2.43l1.02-4.31a2 2 0 0 1 1.78-2.29ZM7.5 13.2a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Zm9 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Zm-8.3 4.08a.75.75 0 0 0-1.06 1.06c1.16 1.16 2.86 1.76 4.86 1.76s3.7-.6 4.86-1.76a.75.75 0 0 0-1.06-1.06c-.85.85-2.14 1.32-3.8 1.32s-2.95-.47-3.8-1.32Z',
    spark: 'm12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Zm7 12 .95 2.55L22.5 18.5l-2.55.95L19 22l-.95-2.55-2.55-.95 2.55-.95L19 15Z',
    upload: 'M12 16V4m0 0L7 9m5-5 5 5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4',
    play: 'm8 5 12 7-12 7V5Z',
    archive: 'M3 5h18v4H3V5Zm2 4v11h14V9M10 13h4',
    restore: 'M4 12a8 8 0 1 0 2.34-5.66L4 8.5M4 4v4.5h4.5M12 8v4l3 2',
    trash: 'M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3',
    refresh: 'M20 7v5h-5M4 17v-5h5m-4.2-2A7.5 7.5 0 0 1 18 7l2 5M4 12l2 5a7.5 7.5 0 0 0 13.2-3',
    check: 'm5 12 4 4L19 6',
    video: 'M15 10l5-3v10l-5-3v3H4V7h11v3Z',
    clock: 'M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  };
  return (
    <svg className={className} viewBox="0 0 24 24" fill={name === 'reddit' || name === 'spark' ? 'currentColor' : 'none'} stroke={name === 'reddit' || name === 'spark' ? 'none' : 'currentColor'} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

export function RedditSection() {
  const [jobs, setJobs] = useState<RedditJob[]>([]);
  const [background, setBackground] = useState<RedditBackgroundStatus | null>(null);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('active');
  const [search, setSearch] = useState('');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [subreddit, setSubreddit] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const refreshJobs = useCallback(async () => {
    try {
      const result = await getRedditJobs();
      setJobs(result.jobs);
      setSelectedIds((previous) => new Set([...previous].filter((id) => result.jobs.some((job) => job.id === id))));
      setError(null);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshBackground = useCallback(async () => {
    try {
      setBackground(await getRedditBackgroundVideo());
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void refreshJobs();
      void refreshBackground();
    }, 0);
    const interval = window.setInterval(() => {
      void refreshJobs();
    }, 12000);
    let reconnectTimer: number | undefined;
    let heartbeat: number | undefined;
    let disposed = false;

    const connect = () => {
      const socket = new WebSocket(`${WS_BASE_URL}/api/reddit/ws`);
      socketRef.current = socket;
      socket.onopen = () => {
        socket.send('refresh');
        heartbeat = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send('refresh');
        }, 12000);
      };
      socket.onmessage = (event: MessageEvent<string>) => {
        try {
          const data: { jobs?: RedditJob[] } = JSON.parse(event.data);
          if (Array.isArray(data.jobs)) setJobs(data.jobs);
        } catch {
          setError('Received an unreadable update from the Reddit queue.');
        }
      };
      socket.onclose = () => {
        if (heartbeat !== undefined) window.clearInterval(heartbeat);
        if (!disposed) reconnectTimer = window.setTimeout(connect, 5000);
      };
      socket.onerror = () => socket.close();
    };

    connect();
    return () => {
      disposed = true;
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      if (heartbeat !== undefined) window.clearInterval(heartbeat);
      socketRef.current?.close();
    };
  }, [refreshJobs, refreshBackground]);

  const activeJobs = useMemo(() => jobs.filter((job) => job.video_state !== 'archived'), [jobs]);
  const archivedJobs = useMemo(() => jobs.filter((job) => job.video_state === 'archived'), [jobs]);
  const processingCount = activeJobs.filter((job) => ['generating_audio', 'transcribing', 'generating_video'].includes(job.job_status)).length;
  const completedCount = activeJobs.filter((job) => job.job_status === 'completed').length;
  const visibleJobs = useMemo(() => {
    const source = queueFilter === 'archived' ? archivedJobs : activeJobs;
    const query = search.trim().toLowerCase();
    if (!query) return source;
    return source.filter((job) =>
      [job.title, job.subreddit ?? '', job.source_url ?? '', job.id].some((value) => value.toLowerCase().includes(query)),
    );
  }, [activeJobs, archivedJobs, queueFilter, search]);
  const selectableJobs = visibleJobs.filter((job) => (
    queueFilter === 'active'
    && !['generating_audio', 'transcribing', 'generating_video'].includes(job.job_status)
  ));
  const processableIds = [...selectedIds].filter((id) => (
    selectableJobs.some((job) => job.id === id && job.job_status !== 'completed')
  ));
  const allSelected = selectableJobs.length > 0 && selectableJobs.every((job) => selectedIds.has(job.id));

  const toggleSelection = (id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!text.trim()) {
      setError('Paste some story text before adding it to the queue.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await createRedditJob({
        text: text.trim(),
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(subreddit.trim() ? { subreddit: subreddit.trim().replace(/^r\//, '') } : {}),
        ...(sourceUrl.trim() ? { source_url: sourceUrl.trim() } : {}),
      });
      setJobs((previous) => [result.job, ...previous.filter((job) => job.id !== result.job.id)]);
      setText('');
      setTitle('');
      setSubreddit('');
      setSourceUrl('');
      setNotice('Added to your Reddit queue. Select it when you’re ready to create the video.');
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleProcess = async (ids: string[]) => {
    if (!ids.length) return;
    if (!background?.configured) {
      setError('Upload a background video before processing queue items.');
      return;
    }
    setProcessing(true);
    setError(null);
    setNotice(null);
    try {
      const response = await processRedditItems(ids);
      const results = Object.values(response.results);
      const complete = results.filter((result) => result.status === 'processed' || result.status === 'already_processed').length;
      const failed = results.filter((result) => result.status === 'failed');
      setNotice(`${complete} item${complete === 1 ? '' : 's'} processed${failed.length ? ` · ${failed.length} need attention` : ''}.`);
      if (failed.length) setError(failed.map((result) => result.error).filter(Boolean).join(' · ') || 'Some items failed to process.');
      setSelectedIds(new Set());
      await refreshJobs();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setProcessing(false);
    }
  };

  const handleArchive = async (ids: string[]) => {
    setBusyAction('archive');
    setError(null);
    try {
      const response = await archiveRedditItems(ids);
      setNotice(`${response.archived_count ?? ids.length} item${ids.length === 1 ? '' : 's'} moved to archive.`);
      setSelectedIds(new Set());
      await refreshJobs();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusyAction(null);
    }
  };

  const handleUnarchive = async (ids: string[]) => {
    setBusyAction('restore');
    setError(null);
    try {
      const response = await unarchiveRedditItems(ids);
      setNotice(`${response.unarchived_count ?? ids.length} item${ids.length === 1 ? '' : 's'} restored to the queue.`);
      await refreshJobs();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async (ids: string[]) => {
    if (!window.confirm(`Permanently delete ${ids.length} item${ids.length === 1 ? '' : 's'} and all generated files?`)) return;
    setBusyAction('delete');
    setError(null);
    try {
      const response = await deleteRedditItems(ids);
      setNotice(`${response.deleted_count ?? ids.length} item${ids.length === 1 ? '' : 's'} permanently deleted.`);
      setSelectedIds(new Set());
      await refreshJobs();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusyAction(null);
    }
  };

  const handleBackgroundUpload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const result = await uploadRedditBackgroundVideo(file);
      setBackground(result);
      setNotice('Your background video is ready for rendering.');
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-7 animate-fadeIn">
      <section className="relative overflow-hidden rounded-[2rem] border border-orange-400/15 bg-[#111217] p-6 shadow-2xl shadow-black/20 sm:p-9">
        <div className="pointer-events-none absolute -right-20 -top-32 h-96 w-96 rounded-full bg-orange-600/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 left-1/3 h-80 w-80 rounded-full bg-rose-600/10 blur-3xl" />
        <div className="relative grid gap-8 xl:grid-cols-[1.2fr_0.8fr] xl:items-center">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-orange-200">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-300 shadow-[0_0_10px_2px_rgba(253,186,116,0.5)]" />
              REDDIT STORY STUDIO
            </div>
            <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              Stories in.
              <span className="block bg-gradient-to-r from-orange-300 via-rose-300 to-orange-200 bg-clip-text text-transparent">scroll-stopping videos out.</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
              Collect your scripts first. When your queue is ready, turn the stories you choose into narrated, word-captioned videos.
            </p>
            <div className="mt-7 flex flex-wrap gap-3 text-xs text-slate-300">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">01 · Paste a story</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">02 · Build your queue</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">03 · Render when ready</span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/20 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Icon name="video" className="h-4 w-4 text-orange-300" />
                  Background footage
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">A looping gameplay or ambient MP4 used behind each story.</p>
              </div>
              {background?.configured && (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                  <Icon name="check" className="h-3.5 w-3.5" /> Ready
                </span>
              )}
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-orange-100 disabled:cursor-wait disabled:opacity-60"
              >
                <Icon name="upload" className="h-4 w-4" />
                {uploading ? 'Uploading…' : background?.configured ? 'Replace footage' : 'Upload footage'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,.mp4"
                className="hidden"
                onChange={(event) => void handleBackgroundUpload(event.target.files?.[0])}
              />
              <span className="min-w-0 text-xs text-slate-500">
                {background?.configured ? background.filename : 'MP4 · up to 1 GB'}
              </span>
            </div>
            {background?.configured && (
              <video
                key={`${API_BASE_URL}/storage/reddit/assets/${background.filename}`}
                src={`${API_BASE_URL}/storage/reddit/assets/${background.filename}`}
                controls
                className="mt-4 max-h-40 w-full rounded-xl border border-white/10 bg-black object-cover"
              />
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.86fr_1.14fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/65 p-5 shadow-xl shadow-black/10 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-300/80">Add to collection</p>
              <h2 className="mt-1 text-xl font-semibold text-white">New story</h2>
            </div>
            <span className="rounded-xl border border-orange-400/15 bg-orange-400/10 p-2.5 text-orange-200">
              <Icon name="reddit" className="h-5 w-5" />
            </span>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reddit-title" className="mb-1.5 block text-xs font-medium text-slate-400">Working title <span className="text-slate-600">· optional</span></label>
              <input
                id="reddit-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                placeholder="Give this story a memorable name"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-orange-400/50 focus:ring-2 focus:ring-orange-400/10"
              />
            </div>
            <div>
              <label htmlFor="reddit-text" className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-400">
                <span>Story text</span><span className={text.length > 95_000 ? 'text-amber-300' : 'text-slate-600'}>{text.length.toLocaleString()} / 100,000</span>
              </label>
              <textarea
                id="reddit-text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={100_000}
                required
                rows={9}
                placeholder="Paste the Reddit story or script you want to narrate…"
                className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-orange-400/50 focus:ring-2 focus:ring-orange-400/10"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="reddit-subreddit" className="mb-1.5 block text-xs font-medium text-slate-400">Subreddit <span className="text-slate-600">· optional</span></label>
                <input id="reddit-subreddit" value={subreddit} onChange={(event) => setSubreddit(event.target.value)} maxLength={100} placeholder="AskReddit" className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-orange-400/50" />
              </div>
              <div>
                <label htmlFor="reddit-url" className="mb-1.5 block text-xs font-medium text-slate-400">Source link <span className="text-slate-600">· optional</span></label>
                <input id="reddit-url" type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} maxLength={2048} placeholder="https://reddit.com/…" className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-orange-400/50" />
              </div>
            </div>
            <button type="submit" disabled={submitting || !text.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45">
              {submitting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Icon name="spark" className="h-4 w-4" />}
              {submitting ? 'Adding story…' : 'Add to queue'}
            </button>
            <p className="text-center text-[11px] text-slate-600">Adding a story won’t start processing. You choose when to render.</p>
          </form>
        </section>

        <section className="min-w-0 rounded-3xl border border-slate-800 bg-slate-900/65 p-5 shadow-xl shadow-black/10 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Your pipeline</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Story queue</h2>
            </div>
            <button type="button" onClick={() => void refreshJobs()} className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white sm:self-auto">
              <Icon name="refresh" className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Collected</span>
              <span className="mt-1 block text-2xl font-semibold text-white">{activeJobs.length}</span>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Rendering</span>
              <span className="mt-1 block text-2xl font-semibold text-orange-200">{processingCount}</span>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Finished</span>
              <span className="mt-1 block text-2xl font-semibold text-emerald-200">{completedCount}</span>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <div className="flex rounded-xl border border-slate-800 bg-slate-950/70 p-1">
              {(['active', 'archived'] as const).map((filter) => (
                <button key={filter} type="button" onClick={() => { setQueueFilter(filter); setSelectedIds(new Set()); }} className={`rounded-lg px-3.5 py-2 text-xs font-semibold capitalize transition ${queueFilter === filter ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>
                  {filter === 'active' ? `Queue · ${activeJobs.length}` : `Archive · ${archivedJobs.length}`}
                </button>
              ))}
            </div>
            <div className="relative min-w-0 flex-1">
              <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a story…" className="w-full rounded-xl border border-slate-800 bg-slate-950/70 py-2.5 pl-9 pr-3 text-xs text-white outline-none placeholder:text-slate-600 focus:border-slate-600" />
            </div>
          </div>

          {queueFilter === 'active' && selectedIds.size > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-400/20 bg-orange-400/[0.06] p-3">
              <span className="text-xs font-semibold text-orange-100">{selectedIds.size} selected</span>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void handleProcess(processableIds)} disabled={processing || !background?.configured || processableIds.length === 0} className="inline-flex items-center gap-1.5 rounded-lg bg-orange-400 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-orange-300 disabled:opacity-50">
                  <Icon name="play" className="h-3.5 w-3.5" /> {processing ? 'Rendering…' : processableIds.length ? 'Process selected' : 'Nothing to process'}
                </button>
                <button type="button" onClick={() => void handleArchive([...selectedIds])} disabled={busyAction !== null} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/5 disabled:opacity-50">Archive</button>
                <button type="button" onClick={() => void handleDelete([...selectedIds])} disabled={busyAction !== null} className="rounded-lg border border-rose-400/20 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-400/10 disabled:opacity-50">Delete</button>
                <button type="button" onClick={() => setSelectedIds(new Set())} className="px-2 py-2 text-xs text-slate-500 hover:text-white">Clear</button>
              </div>
            </div>
          )}

          <div className="mt-3 divide-y divide-white/[0.06]">
            {selectableJobs.length > 0 && queueFilter === 'active' && (
              <label className="flex cursor-pointer items-center gap-3 py-3 text-[11px] font-medium text-slate-500">
                <input type="checkbox" checked={allSelected} onChange={() => setSelectedIds((previous) => {
                  const next = new Set(previous);
                  if (allSelected) selectableJobs.forEach((job) => next.delete(job.id));
                  else selectableJobs.forEach((job) => next.add(job.id));
                  return next;
                })} className="h-3.5 w-3.5 accent-orange-400" />
                Select all available stories
              </label>
            )}

            {loading ? (
              <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500"><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-700 border-t-orange-300" />Loading your stories…</div>
            ) : visibleJobs.length === 0 ? (
              <div className="flex flex-col items-center px-5 py-14 text-center">
                <span className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4 text-slate-500"><Icon name="reddit" className="h-7 w-7" /></span>
                <h3 className="mt-4 text-sm font-semibold text-slate-200">{search ? 'No matching stories' : queueFilter === 'archived' ? 'Nothing in the archive' : 'Your queue is waiting for its first story'}</h3>
                <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">{search ? 'Try another title, subreddit, or link.' : queueFilter === 'archived' ? 'Archived stories will stay here until you restore or delete them.' : 'Paste a story to collect it here. It won’t process until you choose it.'}</p>
              </div>
            ) : visibleJobs.map((job) => {
              const isProcessing = ['generating_audio', 'transcribing', 'generating_video'].includes(job.job_status);
              const canSelect = queueFilter === 'active' && !isProcessing;
              return (
                <article key={job.id} className="group flex gap-3 py-4">
                  <div className="flex shrink-0 items-start pt-1">
                    {canSelect ? (
                      <input type="checkbox" checked={selectedIds.has(job.id)} onChange={() => toggleSelection(job.id)} aria-label={`Select ${job.title}`} className="h-4 w-4 accent-orange-400" />
                    ) : (
                      <span className="mt-0.5 h-4 w-4 text-slate-700">{job.job_status === 'completed' ? <Icon name="check" className="h-4 w-4 text-emerald-400" /> : <Icon name="clock" className="h-4 w-4" />}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="max-w-full truncate text-sm font-semibold text-slate-100">{job.title}</h3>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${statusStyle(job.job_status)}`}>{statusLabel(job.job_status)}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                      {job.subreddit && <span className="font-medium text-orange-200/80">r/{job.subreddit.replace(/^r\//, '')}</span>}
                      {job.source_url && <a href={job.source_url} target="_blank" rel="noreferrer" className="max-w-48 truncate underline decoration-slate-700 underline-offset-2 hover:text-slate-300">Open source ↗</a>}
                      <span>{formatDate(job.created_at)}</span>
                    </div>
                    {isProcessing && (
                      <div className="mt-3">
                        <div className="mb-1 flex justify-between text-[10px] capitalize text-orange-200/70"><span>{statusLabel(job.job_status)}</span><span>{job.progress}%</span></div>
                        <div className="h-1 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-rose-400 transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, job.progress))}%` }} /></div>
                      </div>
                    )}
                    {job.error_message && <p className="mt-2 line-clamp-2 text-xs text-rose-300">{job.error_message}</p>}
                    {job.job_status === 'completed' && (
                      <a href={`${API_BASE_URL}/storage/reddit/content/${job.id}/${job.id}.mp4`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:text-emerald-200"><Icon name="video" className="h-3.5 w-3.5" /> Preview generated video ↗</a>
                    )}
                  </div>
                  <div className="flex shrink-0 items-start gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                    {queueFilter === 'active' ? (
                      <>
                        {job.job_status !== 'completed' && !isProcessing && (
                          <button type="button" title="Process this story" disabled={processing || !background?.configured} onClick={() => void handleProcess([job.id])} className="rounded-lg p-2 text-slate-500 transition hover:bg-orange-400/10 hover:text-orange-200 disabled:cursor-not-allowed disabled:opacity-30"><Icon name="play" className="h-4 w-4" /></button>
                        )}
                        <button type="button" title="Archive this story" disabled={busyAction !== null} onClick={() => void handleArchive([job.id])} className="rounded-lg p-2 text-slate-500 transition hover:bg-white/5 hover:text-slate-200 disabled:opacity-30"><Icon name="archive" className="h-4 w-4" /></button>
                      </>
                    ) : (
                      <button type="button" title="Restore to queue" disabled={busyAction !== null} onClick={() => void handleUnarchive([job.id])} className="rounded-lg p-2 text-slate-500 transition hover:bg-emerald-400/10 hover:text-emerald-200 disabled:opacity-30"><Icon name="restore" className="h-4 w-4" /></button>
                    )}
                    <button type="button" title="Delete permanently" disabled={busyAction !== null} onClick={() => void handleDelete([job.id])} className="rounded-lg p-2 text-slate-600 transition hover:bg-rose-400/10 hover:text-rose-300 disabled:opacity-30"><Icon name="trash" className="h-4 w-4" /></button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      {(error || notice) && (
        <div className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${error ? 'border-rose-400/20 bg-rose-400/[0.06] text-rose-200' : 'border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200'}`} role={error ? 'alert' : 'status'}>
          <span>{error || notice}</span>
          <button type="button" onClick={() => { setError(null); setNotice(null); }} className="shrink-0 text-current opacity-60 hover:opacity-100" aria-label="Dismiss message">×</button>
        </div>
      )}
    </div>
  );
}
