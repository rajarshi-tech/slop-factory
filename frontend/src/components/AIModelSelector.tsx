import axios from "axios";
import React, { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

// Interfaces matching your config response shape
interface ProviderDetail {
  models: string[];
}

export interface ConfigResponse {
  details: {
    llm: {
      provider: Record<string, ProviderDetail>;
    };
  };
  llm: {
    provider: string;
    model: string;
  };
}

interface FormState {
  provider: string;
  model: string;
}

// API Helpers
const fetchConfig = async (): Promise<ConfigResponse> => {
  const response = await axios.get<ConfigResponse>("/api/config");
  return response.data;
};

const updateConfig = async (payload: FormState): Promise<ConfigResponse> => {
  const response = await axios.put<ConfigResponse>("/api/config", payload);
  return response.data;
};

export const AIModelSelector: React.FC = () => {
  const [providerModels, setProviderModels] = useState<Record<string, string[]>>({});
  const [formData, setFormData] = useState<FormState>({ provider: "", model: "" });
  
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [fullConfig, setFullConfig] = useState<ConfigResponse | null>(null);

  // Helper to parse response and sync component state
  const syncConfigData = (data: ConfigResponse) => {
    const parsedModels: Record<string, string[]> = {};
    Object.entries(data.details.llm.provider).forEach(([name, info]) => {
      parsedModels[name] = info.models;
    });

    setProviderModels(parsedModels);
    setFullConfig(data);
    setFormData({
      provider: data.llm.provider || "",
      model: data.llm.model || "",
    });
  };

  // Initial fetch on mount
  useEffect(() => {
    const loadInitialConfig = async () => {
      try {
        const data = await fetchConfig();
        syncConfigData(data);
      } catch (error) {
        console.error("Failed to fetch initial config:", error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialConfig();
  }, []);

  const handleProviderChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const selectedProvider = e.target.value;
    const availableModels = providerModels[selectedProvider] || [];

    setFormData({
      provider: selectedProvider,
      model: availableModels[0] || "",
    });
  };

  const handleModelChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setFormData((prev) => ({
      ...prev,
      model: e.target.value,
    }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.provider || !formData.model) return;

    setSubmitting(true);
    try {
      // Execute PUT request and receive updated full config
      const updatedConfig = await updateConfig(formData);
      
      // Update local state with returned backend state
      syncConfigData(updatedConfig);
      
      console.log("Entire updated config from backend:", updatedConfig);
    } catch (error) {
      console.error("Failed to update config:", error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>Loading model configuration...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "400px" }}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <label htmlFor="provider-select">Provider: </label>
          <select
            id="provider-select"
            value={formData.provider}
            onChange={handleProviderChange}
            disabled={submitting}
          >
            <option value="">Select Provider</option>
            {Object.keys(providerModels).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="model-select">Model: </label>
          <select
            id="model-select"
            value={formData.model}
            onChange={handleModelChange}
            disabled={!formData.provider || submitting}
          >
            <option value="">Select Model</option>
            {(providerModels[formData.provider] || []).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" disabled={!formData.provider || !formData.model || submitting}>
          {submitting ? "Saving..." : "Save Selection"}
        </button>
      </form>

      {/* Render returned full config file preview */}
      {fullConfig && (
        <pre style={{ background: "#f4f4f4", padding: "1rem", borderRadius: "4px", fontSize: "12px" }}>
          {JSON.stringify(fullConfig, null, 2)}
        </pre>
      )}
    </div>
  );
};

export default AIModelSelector;