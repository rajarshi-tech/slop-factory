import { useEffect, useState, useRef, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import type { TabType } from './components/Navbar';
import { IngestionSection } from './components/IngestionSection';
import { TrendCalculatorSection } from './components/TrendCalculatorSection';
import { JobQueueSection } from './components/JobQueueSection';
import { ProcessedSection } from './components/ProcessedSection';
import { ArchivedSection } from './components/ArchivedSection';
import ConfigSection from './components/ConfigSection';
import ParamControls from './components/ParamControls';
import { YoutubeChannelsSection } from './components/YoutubeChannelsSection';
import {
  getConfig,
  updateSearchParams,
  getJobs,
  checkHealth,
  WS_BASE_URL,
} from './services/api';
import type { Job, LLMConfig, SearchParams } from './services/api';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>(() => (
    new URLSearchParams(window.location.search).has('youtube') ? 'settings' : 'ingestion'
  ));

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
  };

  const handleSearchCompleted = (newJobs: Job[]) => {
    setJobs((prev) => {
      const existingIds = new Set(newJobs.map((j) => j.video_id));
      return [...newJobs, ...prev.filter((j) => !existingIds.has(j.video_id))];
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white pb-16">
      {/* Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isBackendHealthy={isBackendHealthy}
        isWsConnected={isWsConnected}
        activeJobCount={jobs.filter((j) => j.video_state !== 'archived' && j.processing_state !== 'processed' && ['queued', 'downloading', 'transcribing'].includes(j.job_status)).length}
        processedJobCount={jobs.filter((j) => j.video_state !== 'archived' && j.processing_state === 'processed').length}
        archivedJobCount={jobs.filter((j) => j.video_state === 'archived').length}
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

        {/* TAB 2: TREND CALCULATOR */}
        {activeTab === 'trend' && (
          <div className="space-y-8 animate-fadeIn">
            <TrendCalculatorSection
              jobs={jobs}
              onRefresh={loadData}
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

        {/* TAB 4: PROCESSED */}
        {activeTab === 'processed' && (
          <div className="space-y-8 animate-fadeIn">
            <ProcessedSection
              jobs={jobs}
              isLoading={isLoadingJobs}
              onRefresh={loadData}
            />
          </div>
        )}

        {/* TAB 5: ARCHIVED */}
        {activeTab === 'archived' && (
          <div className="space-y-8 animate-fadeIn">
            <ArchivedSection
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
              <YoutubeChannelsSection />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
