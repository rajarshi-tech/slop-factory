import axios from "axios";
import React, { useEffect, useState } from "react";

interface ProviderStatus {
  available: boolean;
  status: string;
}

interface ProviderRefreshResponse {
  providers: {
    ollama: ProviderStatus;
    gemini: ProviderStatus;
  };
  available_count: number;
  available_providers: string[];
  config_updated: boolean;
}

export const ProviderRefresh: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<ProviderRefreshResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshProviders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get<ProviderRefreshResponse>("/api/config/provider");
      setResponse(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh providers");
      console.error("Failed to refresh providers:", err);
    } finally {
      setLoading(false);
    }
  };

  // Automatically call on mount
  useEffect(() => {
    refreshProviders();
  }, []);

  return (
    <div style={{ marginBottom: "20px", padding: "15px", border: "1px solid #ccc", borderRadius: "8px" }}>
      <h3>Provider Availability</h3>
      <button onClick={refreshProviders} disabled={loading}>
        {loading ? "Checking..." : "Refresh Providers"}
      </button>
      
      {error && (
        <div style={{ color: "red", marginTop: "10px" }}>
          Error: {error}
        </div>
      )}

      {response && (
        <div style={{ marginTop: "15px" }}>
          <p><strong>Available Providers:</strong> {response.available_count}</p>
          <ul>
            {Object.entries(response.providers).map(([name, status]) => (
              <li key={name}>
                <strong>{name}:</strong>{" "}
                <span style={{ color: status.available ? "green" : "red" }}>
                  {status.available ? "✓ Available" : "✗ Unavailable"}
                </span>
                <br />
                <small>{status.status}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ProviderRefresh;
