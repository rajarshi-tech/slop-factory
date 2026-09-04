import { useEffect, useState, useRef, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import type { TabType } from './components/Navbar';
import { IngestionSection } from './components/IngestionSection';
import { TrendCalculatorSection } from './components/TrendCalculatorSection';
import { JobQueueSection } from './components/JobQueueSection';
import ConfigSection from './components/ConfigSection';
import ParamControls from './components/ParamControls';
import {
  getConfig,
  updateSearchParams,
  getJobs,
  getUncalculatedTrends,
  checkHealth,
  WS_BASE_URL,
} from './services/api';
import type { Job, LLMConfig, SearchParams } from './services/api';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('ingestion');

  // Configuration state
  const [llmConfig, setLlmConfig] = useState<LLMConfig>({ provider: null, model: null });
  const [searchParams, setSearchParams] = useState<SearchParams>({
    q: '',
    order: 'viewCount',
    publishedAfter: null,
    publishedBefore: null,
    maxResults: 10,
    videoCaption: 'closedCaption',
    videoCategoryId: null,
    videoDefinition: 'any',
    videoDimension: 'any',
    videoDuration: 'medium',
    videoEmbeddable: 'any',
    videoLicense: 'any',
    videoSyndicated: 'any',
    videoType: 'any',
    safeSearch: 'moderate',
  });

  // Jobs state
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState<boolean>(false);
  const [uncalculatedCount, setUncalculatedCount] = useState<number>(0);

  // Status state
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean>(false);
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);

  /**
   * Fetch all initial data
   */
  const loadData = useCallback(async () => {
    try {
      const health = await checkHealth();
      setIsBackendHealthy(health.status === 'ok');
    } catch {
      setIsBackendHealthy(false);
    }

    try {
      const config = await getConfig();
      if (config.llm) setLlmConfig(config.llm);
      if (config.params) setSearchParams(config.params);
    } catch (err) {
      console.error('Failed to load config:', err);
    }

    try {
      setIsLoadingJobs(true);
      const jobsRes = await getJobs();
      setJobs(jobsRes.jobs || []);
    } catch (err) {
      console.error('Failed to load jobs:', err);
    } finally {
      setIsLoadingJobs(false);
    }

    try {
      const uncalcRes = await getUncalculatedTrends('search');
      setUncalculatedCount(uncalcRes.uncalculated_count || 0);
    } catch (err) {
      console.error('Failed to fetch uncalculated count:', err);
    }
  }, []);

  /**
   * Set up WebSocket connection for live job streaming
   */
  const connectWebSocket = useCallback(() => {
    try {
      const socket = new WebSocket(`${WS_BASE_URL}/ws/jobs`);

      socket.onopen = () => {
        setIsWsConnected(true);
        // Send initial heartbeat to request jobs
        socket.send('ping');
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && Array.isArray(data.jobs)) {
            setJobs(data.jobs);
            // Count uncalculated
            const uncalc = data.jobs.filter(
              (j: Job) => j.source === 'search' && (j.trend_score === null || j.trend_score === undefined)
            ).length;
            setUncalculatedCount(uncalc);
          }
        } catch (err) {
          console.error('Error parsing WebSocket data:', err);
        }
      };

      socket.onerror = () => {
        setIsWsConnected(false);
      };

      socket.onclose = () => {
        setIsWsConnected(false);
        // Try reconnecting after 5 seconds
        setTimeout(() => {
          connectWebSocket();
        }, 5000);
      };

      wsRef.current = socket;
    } catch {
      setIsWsConnected(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    connectWebSocket();

    // Polling fallback
    const interval = setInterval(() => {
      loadData();
    }, 15000);

    return () => {
      clearInterval(interval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [loadData, connectWebSocket]);

  const handleConfigUpdate = (config: LLMConfig) => {
    setLlmConfig(config);
  };

  const handleParamsChange = (params: Partial<SearchParams>) => {
    setSearchParams((prev) => ({ ...prev, ...params }));
  };

  const handleParamsSave = async (params: SearchParams) => {
    await updateSearchParams(params);
    setSearchParams(params);
  };

  const handleJobCreated = (newJob: Job) => {
    setJobs((prev) => [newJob, ...prev.filter((j) => j.video_id !== newJob.video_id)]);
    if (newJob.source === 'search' && newJob.trend_score === null) {
      setUncalculatedCount((c) => c + 1);
    }
  };

  const handleSearchCompleted = (newJobs: Job[]) => {
    setJobs((prev) => {
      const existingIds = new Set(newJobs.map((j) => j.video_id));
      return [...newJobs, ...prev.filter((j) => !existingIds.has(j.video_id))];
    });
    setUncalculatedCount((c) => c + newJobs.length);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white pb-16">
      {/* Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isBackendHealthy={isBackendHealthy}
        isWsConnected={isWsConnected}
        uncalculatedCount={uncalculatedCount}
        activeJobCount={jobs.filter((j) => ['queued', 'downloading', 'transcribing'].includes(j.job_status)).length}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* TAB 1: INGESTION */}
        {activeTab === 'ingestion' && (
          <div className="space-y-8 animate-fadeIn">
            <IngestionSection
              currentParams={searchParams}
              onJobCreated={handleJobCreated}
              onSearchCompleted={handleSearchCompleted}
            />

            {/* Quick stats banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Database Jobs</span>
                <span className="text-3xl font-black text-white mt-1 block">{jobs.length}</span>
              </div>

              <div
                onClick={() => setActiveTab('trends')}
                className="p-5 rounded-2xl bg-gradient-to-tr from-slate-900/60 to-amber-950/20 border border-amber-500/20 backdrop-blur-md cursor-pointer hover:border-amber-500/40 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider block">Pending Trend Scores</span>
                  <span className="text-xs text-amber-400 group-hover:translate-x-1 transition-transform">Calculate →</span>
                </div>
                <span className="text-3xl font-black text-amber-400 mt-1 block">{uncalculatedCount}</span>
              </div>

              <div
                onClick={() => setActiveTab('settings')}
                className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md cursor-pointer hover:border-slate-700 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Active LLM Model</span>
                  <span className="text-xs text-slate-400 group-hover:translate-x-1 transition-transform">Edit →</span>
                </div>
                <span className="text-sm font-bold text-slate-200 mt-2 block truncate">
                  {llmConfig.provider ? `${llmConfig.provider.toUpperCase()} / ${llmConfig.model}` : 'Not configured'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TREND RANKINGS */}
        {activeTab === 'trends' && (
          <div className="space-y-8 animate-fadeIn">
            <TrendCalculatorSection
              uncalculatedCount={uncalculatedCount}
              onRefreshNeeded={loadData}
              onViewJobs={() => setActiveTab('jobs')}
            />
          </div>
        )}

        {/* TAB 3: JOB QUEUE */}
        {activeTab === 'jobs' && (
          <div className="space-y-8 animate-fadeIn">
            <JobQueueSection
              jobs={jobs}
              isLoading={isLoadingJobs}
              onRefresh={loadData}
              isWsConnected={isWsConnected}
            />
          </div>
        )}

        {/* TAB 4: SETTINGS & PARAMETERS */}
        {activeTab === 'settings' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ConfigSection
                onConfigUpdate={handleConfigUpdate}
                currentConfig={llmConfig}
              />
              <ParamControls
                onParamsChange={handleParamsChange}
                onParamsSave={handleParamsSave}
                defaultParams={searchParams}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
