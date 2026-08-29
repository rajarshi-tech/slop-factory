import React, { useState, type ChangeEvent, type FormEvent } from 'react';

// Define explicit types for provider-model mappings
type Provider = 'Ollama' | 'Google';

const PROVIDER_MODELS: Record<Provider, string[]> = {
  Ollama: [],
  Google: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-ultra'],
};

interface FormState {
  provider: Provider | '';
  model: string;
}

export const ModelSelectorForm: React.FC = () => {
  const [formData, setFormData] = useState<FormState>({
    provider: '',
    model: '',
  });

  const providers = Object.keys(PROVIDER_MODELS) as Provider[];

  const handleProviderChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const provider = e.target.value as Provider;
    setFormData({
      provider,
      model: '', // Reset model selection when provider changes
    });
  };

  const handleModelChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setFormData((prev) => ({
      ...prev,
      model: e.target.value,
    }));
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.provider || !formData.model) return;
    
    console.log('Selected Configuration:', formData);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-gray-100 bg-white p-6 shadow-lg space-y-5"
      >
        <h2 className="text-xl font-semibold text-gray-800 text-center">
          Model Configuration
        </h2>

        {/* Provider Dropdown */}
        <div className="flex flex-col space-y-1.5">
          <label
            htmlFor="provider-select"
            className="text-sm font-medium text-gray-700"
          >
            Provider
          </label>
          <select
            id="provider-select"
            value={formData.provider}
            onChange={handleProviderChange}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="" disabled>
              Select Provider
            </option>
            {providers.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
        </div>

        {/* Model Dropdown */}
        <div className="flex flex-col space-y-1.5">
          <label
            htmlFor="model-select"
            className="text-sm font-medium text-gray-700"
          >
            Model
          </label>
          <select
            id="model-select"
            value={formData.model}
            onChange={handleModelChange}
            disabled={!formData.provider}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option value="" disabled>
              {formData.provider ? 'Select Model' : 'Select a provider first'}
            </option>
            {formData.provider &&
              PROVIDER_MODELS[formData.provider].map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
          </select>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!formData.provider || !formData.model}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:cursor-not-allowed disabled:bg-indigo-300"
        >
          Submit Selection
        </button>
      </form>
    </div>
  );
};

export default ModelSelectorForm;