import React from 'react';

export type TabType = 'ingestion' | 'reddit' | 'trend' | 'jobs' | 'processed' | 'archived' | 'settings';

interface NavbarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  isBackendHealthy: boolean;
  isWsConnected: boolean;
  activeJobCount: number;
  processedJobCount?: number;
  archivedJobCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  isBackendHealthy,
  isWsConnected,
  activeJobCount,
  processedJobCount = 0,
  archivedJobCount = 0,
}) => {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-slate-900/80 border-b border-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-2">
          {/* Brand Logo & Name */}
          <div className="flex shrink-0 items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <span className="hidden whitespace-nowrap text-xl font-bold bg-linear-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent sm:inline">
                Slop Factory
              </span>
              <span className="ml-2 hidden whitespace-nowrap rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-400 xl:inline-block">
                v0.1.0
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex min-w-0 flex-1 items-center justify-center gap-0 overflow-x-auto sm:gap-2" style={{ scrollbarWidth: 'none' }}>
            <button
              onClick={() => onSelectTab('ingestion')}
              title="Ingest Videos"
              aria-label="Ingest Videos"
              className={`flex shrink-0 items-center gap-1 rounded-lg px-1 py-2 text-sm font-medium transition-all sm:gap-2 sm:px-3.5 ${
                activeTab === 'ingestion'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span className="hidden xl:inline">Ingest Videos</span>
            </button>

            <button
              onClick={() => onSelectTab('reddit')}
              title="Reddit Studio"
              aria-label="Reddit Studio"
              className={`flex shrink-0 items-center gap-1 rounded-lg px-1 py-2 text-sm font-medium transition-all sm:gap-2 sm:px-3.5 ${
                activeTab === 'reddit'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2a2 2 0 0 1 1.94 1.52l2.2.44a2.1 2.1 0 1 1-.17 1.99l-2.42-.49-.74 3.14c2.6.13 4.9 1.04 6.13 2.43a1.8 1.8 0 1 1 1.72 2.33c.13.55.2 1.13.2 1.74 0 4.15-4.86 7.52-10.86 7.52S1.14 19.25 1.14 15.1c0-.6.07-1.19.2-1.74a1.8 1.8 0 1 1 1.72-2.33c1.23-1.39 3.54-2.3 6.14-2.43l1.02-4.31A2 2 0 0 1 12 2Zm-4.5 11.2a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Zm9 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Zm-8.3 4.08a.75.75 0 0 0-1.06 1.06c1.16 1.16 2.86 1.76 4.86 1.76s3.7-.6 4.86-1.76a.75.75 0 0 0-1.06-1.06c-.85.85-2.14 1.32-3.8 1.32s-2.95-.47-3.8-1.32Z" />
              </svg>
              <span className="hidden xl:inline">Reddit Studio</span>
            </button>

            <button
              onClick={() => onSelectTab('trend')}
              title="Trend Score"
              aria-label="Trend Score"
              className={`flex shrink-0 items-center gap-1 rounded-lg px-1 py-2 text-sm font-medium transition-all sm:gap-2 sm:px-3.5 ${
                activeTab === 'trend'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="hidden xl:inline">Trend Score</span>
            </button>


            <button
              onClick={() => onSelectTab('jobs')}
              title="Job Queue"
              aria-label="Job Queue"
              className={`relative flex shrink-0 items-center gap-1 rounded-lg px-1 py-2 text-sm font-medium transition-all sm:gap-2 sm:px-3.5 ${
                activeTab === 'jobs'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="hidden xl:inline">Job Queue</span>
              {activeJobCount > 0 && (
                <span className="px-1.5 py-0.2 text-[11px] font-semibold rounded-full bg-emerald-500 text-white">
                  {activeJobCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onSelectTab('processed')}
              title="Processed"
              aria-label="Processed"
              className={`relative flex shrink-0 items-center gap-1 rounded-lg px-1 py-2 text-sm font-medium transition-all sm:gap-2 sm:px-3.5 ${
                activeTab === 'processed'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="hidden xl:inline">Processed</span>
              {processedJobCount > 0 && (
                <span className="px-1.5 py-0.2 text-[11px] font-semibold rounded-full bg-purple-500 text-white">
                  {processedJobCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onSelectTab('archived')}
              title="Archived"
              aria-label="Archived"
              className={`relative flex shrink-0 items-center gap-1 rounded-lg px-1 py-2 text-sm font-medium transition-all sm:gap-2 sm:px-3.5 ${
                activeTab === 'archived'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1a2 2 0 01-2 2M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              <span className="hidden xl:inline">Archived</span>
              {archivedJobCount > 0 && (
                <span className="px-1.5 py-0.2 text-[11px] font-semibold rounded-full bg-amber-500 text-white">
                  {archivedJobCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onSelectTab('settings')}
              className={`shrink-0 rounded-lg p-2 text-sm font-medium transition-all ${
                activeTab === 'settings'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title="Settings & Parameters"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </nav>

          {/* Connection Indicators */}
          <div className="hidden shrink-0 items-center gap-3 text-xs 2xl:flex">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60">
              <span className={`w-2 h-2 rounded-full ${isBackendHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-slate-300">API: {isBackendHealthy ? 'Online' : 'Offline'}</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60">
              <span className={`w-2 h-2 rounded-full ${isWsConnected ? 'bg-indigo-400' : 'bg-amber-500'}`} />
              <span className="text-slate-300">Live WS: {isWsConnected ? 'Connected' : 'Polling'}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
