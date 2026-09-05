import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ApiKeyPopupProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (youtubeKey: string, geminiKey: string, clientId: string, clientSecret: string, redirectUri: string) => Promise<void>;
  youtubeKey: string;
  setYoutubeKey: (key: string) => void;
  geminiKey: string;
  setGeminiKey: (key: string) => void;
  clientId: string;
  setClientId: (key: string) => void;
  clientSecret: string;
  setClientSecret: (key: string) => void;
  redirectUri: string;
  setRedirectUri: (uri: string) => void;
  isLoading: boolean;
  error: string | null;
}

const ApiKeyPopup = ({
  visible,
  onClose,
  onSubmit,
  youtubeKey,
  setYoutubeKey,
  geminiKey,
  setGeminiKey,
  clientId,
  setClientId,
  clientSecret,
  setClientSecret,
  redirectUri,
  setRedirectUri,
  isLoading,
  error,
}: ApiKeyPopupProps) => {
  useEffect(() => {
    if (!visible) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLoading) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, isLoading, onClose]);

  if (!visible) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-labelledby="api-key-dialog-title">
      <div className="bg-slate-950 border border-slate-700 rounded-3xl p-8 max-w-md w-full shadow-2xl">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h3 id="api-key-dialog-title" className="text-xl font-bold text-white">API Keys</h3>
          <button type="button" onClick={onClose} disabled={isLoading} aria-label="Close API key dialog" className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <p className="text-slate-400 mb-6">
          Set or update the keys used by Slop Factory.
        </p>
        {error && <p className="mb-4 p-3 bg-rose-950/60 border border-rose-800/80 text-rose-300 rounded-xl text-xs">{error}</p>}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              YouTube Data API Key
            </label>
            <input
              type="password"
              autoComplete="off"
              placeholder="Enter YouTube API key"
              value={youtubeKey || ''}
              onChange={(e) => setYoutubeKey(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-rose-400 mt-1">
              Required for YouTube search and ingestion
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Gemini API Key (Optional)
            </label>
            <input
              type="password"
              autoComplete="off"
              placeholder="Enter Gemini API key (optional)"
              value={geminiKey || ''}
              onChange={(e) => setGeminiKey(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              Optional. For cloud-based LLM analysis.
            </p>
          </div>
          <div className="pt-2 border-t border-slate-800">
            <p className="text-sm font-semibold text-slate-200 mb-1">YouTube OAuth Client</p>
            <p className="text-xs text-slate-500 mb-3">Needed to connect a channel for scheduled uploads.</p>
            <div className="space-y-3">
              <input type="text" autoComplete="off" placeholder="Google OAuth client ID" value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input type="password" autoComplete="off" placeholder="Google OAuth client secret" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input type="url" autoComplete="off" placeholder="http://localhost:8000/auth/youtube/callback" value={redirectUri} onChange={(e) => setRedirectUri(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 pt-6">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl border border-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(youtubeKey, geminiKey, clientId, clientSecret, redirectUri)}
            disabled={!youtubeKey.trim() || isLoading}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving...' : 'Save Keys'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ApiKeyPopup;
export { ApiKeyPopup };
