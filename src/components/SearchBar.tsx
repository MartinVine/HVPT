import { useState, useCallback, useEffect } from 'react';

interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  isLoading: boolean;
}

export function SearchBar({ query, onQueryChange, isLoading }: SearchBarProps) {
  const [localQuery, setLocalQuery] = useState(query);

  // Debounce the search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localQuery !== query) {
        onQueryChange(localQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localQuery, query, onQueryChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalQuery(e.target.value);
  }, []);

  const handleClear = useCallback(() => {
    setLocalQuery('');
    onQueryChange('');
  }, [onQueryChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onQueryChange(localQuery);
    }
  }, [localQuery, onQueryChange]);

  return (
    <div className="search-bar">
      <div className="search-input-container">
        <span className="search-icon">&#128269;</span>
        <input
          type="text"
          className="search-input"
          placeholder="Search services, stacks, teams, technologies..."
          value={localQuery}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          aria-label="Search"
        />
        {localQuery && (
          <button
            className="search-clear-button"
            onClick={handleClear}
            aria-label="Clear search"
          >
            &times;
          </button>
        )}
        {isLoading && <span className="search-spinner"></span>}
      </div>
      <div className="search-hints">
        <span className="hint">Try: "user api", "postgres", "tier-1", "payment"</span>
      </div>
    </div>
  );
}
