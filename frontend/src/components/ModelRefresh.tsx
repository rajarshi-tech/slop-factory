import axios from "axios";
import React, { useEffect, useState } from "react";

interface ProviderModels {
  models: string[];
}

interface ModelRefreshResponse {
  llm: {
    provider: Record<string, ProviderModels>;
  };
  errors?: string[];
}

export const ModelRefresh: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<ModelRefreshResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshModels = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get<ModelRefreshResponse>("/api/config/llm");
      setResponse(res.data);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError(err instanceof Error ? err.message : "Failed to refresh models");
      }
      console.error("Failed to refresh models:", err);
    } finally {
      setLoading(false);
    }
  };

  // Automatically call on mount
  useEffect(() => {
    refreshModels();
  }, []);

  return (
    <div style={{ marginBottom: "20px", padding: "15px", border: "1px solid #ccc", borderRadius: "8px" }}>
      <h3>Available Models</h3>
      <button onClick={refreshModels} disabled={loading}>
        {loading ? "Fetching..." : "Refresh Models"}
      </button>
      
      {error && (
        <div style={{ color: "red", marginTop: "10px" }}>
          Error: {error}
        </div>
      )}

      {response && (
        <div style={{ marginTop: "15px" }}>
          {response.errors && response.errors.length > 0 && (
            <div style={{ color: "orange", marginBottom: "10px" }}>
              <strong>Warnings:</strong>
              <ul>
                {response.errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}
          
          <p><strong>Providers with Models:</strong></p>
          {Object.keys(response.llm.provider).length === 0 ? (
            <p style={{ color: "gray" }}>No providers available. Refresh providers first.</p>
          ) : (
            <ul>
              {Object.entries(response.llm.provider).map(([provider, data]) => (
                <li key={provider}>
                  <strong>{provider}:</strong> {data.models.length} model(s)
                  {data.models.length > 0 && (
                    <ul>
                      {data.models.map((model, idx) => (
                        <li key={idx}>{model}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default ModelRefresh;
