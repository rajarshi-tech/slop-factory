import { useEffect, useState } from 'react';
import { API_BASE_URL, getUploadChannels, getYouTubeOAuthStatus, removeUploadChannel, uploadYouTubeClientSecret } from '../services/api';
import type { UploadChannel } from '../services/api';

const errorMessage = (error: unknown) => {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { detail?: string } } }).response;
    if (response?.data?.detail) return response.data.detail;
  }
  return error instanceof Error ? error.message : 'Unable to update YouTube channels.';
};

export const YoutubeChannelsSection = () => {
  const [channels, setChannels] = useState<UploadChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingClient, setIsUploadingClient] = useState(false);
  const [oauthConfigured, setOauthConfigured] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadChannels = async () => {
    try {
      setIsLoading(true);
      const [response, oauthStatus] = await Promise.all([getUploadChannels(), getYouTubeOAuthStatus()]);
      setChannels(response.channels || []);
      setOauthConfigured(oauthStatus.configured);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClientSecretUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setIsUploadingClient(true);
      setError('');
      const response = await uploadYouTubeClientSecret(file);
      setMessage(response.message);
      await loadChannels();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsUploadingClient(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('youtube');
    const statusMessage = params.get('message');
    if (statusMessage) {
      status === 'connected' ? setMessage(statusMessage) : setError(statusMessage);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    void loadChannels();
  }, []);

  const handleRemove = async (channel: UploadChannel) => {
    if (!window.confirm(`Remove ${channel.name}? Existing upload jobs retain their history, but future uploads will fail until they use another connected channel.`)) return;
    try {
      setError('');
      await removeUploadChannel(channel.id);
      setMessage(`${channel.name} was removed.`);
      await loadChannels();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <section className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">YouTube upload channels</h2>
          <p className="text-xs text-slate-400 mt-1">Connect a channel once with Google, then use it for all future scheduled uploads.</p>
        </div>
        <button onClick={() => void loadChannels()} disabled={isLoading} className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 disabled:opacity-50">Refresh</button>
      </div>

      {message && <p className="p-3 rounded-xl text-xs text-emerald-300 bg-emerald-950/50 border border-emerald-800/70">{message}</p>}
      {error && <p className="p-3 rounded-xl text-xs text-rose-300 bg-rose-950/50 border border-rose-800/70">{error}</p>}

      <div className="space-y-2">
        {isLoading ? <p className="text-xs text-slate-500">Loading channels...</p> : channels.length === 0 ? <p className="text-xs text-slate-500">No upload channels connected yet.</p> : channels.map((channel) => (
          <div key={channel.id} className="flex items-center justify-between gap-3 bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <div className="min-w-0"><p className="text-sm font-semibold text-slate-200 truncate">{channel.name}</p><p className="text-[11px] text-slate-500 font-mono truncate">{channel.id}</p></div>
            <button onClick={() => void handleRemove(channel)} className="shrink-0 px-2.5 py-1.5 text-xs rounded-lg text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30">Remove</button>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-slate-800 space-y-3">
        {!oauthConfigured ? (
          <div className="space-y-2">
            <p className="text-xs text-amber-300">Upload the Google OAuth <code className="font-mono">client_secret.json</code> for a Web application to enable channel connection.</p>
            <label className="inline-flex items-center px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer">
              <input type="file" accept="application/json,.json" onChange={handleClientSecretUpload} disabled={isUploadingClient} className="sr-only" />
              {isUploadingClient ? 'Configuring OAuth...' : 'Upload client_secret.json'}
            </label>
            <p className="text-[11px] text-slate-500">In Google Cloud, add <span className="font-mono">http://localhost:8000/auth/youtube/callback</span> to this client’s Authorized redirect URIs before downloading the file.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <p className="text-xs text-slate-400">Google OAuth is configured. Your browser will open Google’s consent page; channel tokens stay on the backend.</p>
              <button onClick={() => { window.location.assign(`${API_BASE_URL}/auth/youtube`); }} className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold">Connect YouTube channel</button>
            </div>
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <p className="text-xs text-slate-500">To use another Google OAuth application, replace the client file and then connect the new channel.</p>
              <label className="inline-flex items-center px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold cursor-pointer">
                <input type="file" accept="application/json,.json" onChange={handleClientSecretUpload} disabled={isUploadingClient} className="sr-only" />
                {isUploadingClient ? 'Replacing OAuth client...' : 'Replace client_secret.json'}
              </label>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
