/**
 * SearchBar Component
 * Displays a search input where users can enter their search query
 * Triggers search when user submits
 */

import { useState } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  defaultQuery?: string;
  isLoading?: boolean;
}

const SearchBar = ({ onSearch, defaultQuery = '', isLoading = false }: SearchBarProps) => {
  const [query, setQuery] = useState(defaultQuery);

  /**
   * Handle form submission
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto mb-8">
      <form onSubmit={handleSubmit} className="flex gap-2">
        {/* Search input field */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter your search query..."
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isLoading}
        />

        {/* Submit button */}
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </form>
    </div>
  );
};

export default SearchBar;
