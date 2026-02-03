import { useState, useCallback, useEffect } from 'react';
import { SearchFilters, SearchResult, Service, ApplicationStack } from '../types';
import { searchCatalogue, getAllServices, getAllStacks } from '../services/catalogueService';

export function useSearch() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [results, setResults] = useState<SearchResult>({
    services: [],
    stacks: [],
    totalServices: 0,
    totalStacks: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (searchFilters: SearchFilters) => {
    setIsLoading(true);
    setError(null);
    try {
      const searchResults = await searchCatalogue(searchFilters);
      setResults(searchResults);
    } catch (err) {
      setError('Failed to search catalogue');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateQuery = useCallback((newQuery: string) => {
    setQuery(newQuery);
    const newFilters = { ...filters, query: newQuery };
    setFilters(newFilters);
    search(newFilters);
  }, [filters, search]);

  const updateFilters = useCallback((newFilters: Partial<SearchFilters>) => {
    const updatedFilters = { ...filters, ...newFilters, query };
    setFilters(updatedFilters);
    search(updatedFilters);
  }, [filters, query, search]);

  const clearFilters = useCallback(() => {
    setFilters({});
    setQuery('');
    search({});
  }, [search]);

  // Initial load
  useEffect(() => {
    search({});
  }, [search]);

  return {
    query,
    filters,
    results,
    isLoading,
    error,
    updateQuery,
    updateFilters,
    clearFilters
  };
}

export function useServiceDetails(serviceId: string | null) {
  const [service, setService] = useState<Service | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!serviceId) {
      setService(null);
      return;
    }

    const fetchService = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const services = await getAllServices();
        const found = services.find(s => s.id === serviceId);
        setService(found || null);
      } catch (err) {
        setError('Failed to load service details');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchService();
  }, [serviceId]);

  return { service, isLoading, error };
}

export function useStackDetails(stackId: string | null) {
  const [stack, setStack] = useState<ApplicationStack | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!stackId) {
      setStack(null);
      return;
    }

    const fetchStack = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const stacks = await getAllStacks();
        const found = stacks.find(s => s.id === stackId);
        setStack(found || null);
      } catch (err) {
        setError('Failed to load stack details');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStack();
  }, [stackId]);

  return { stack, isLoading, error };
}
