import { useState } from 'react';
import './App.css';
import { SearchBar } from './components/SearchBar';
import { FilterPanel } from './components/FilterPanel';
import { ServiceList } from './components/ServiceList';
import { StackList } from './components/StackList';
import { ServiceDetails } from './components/ServiceDetails';
import { StackDetails } from './components/StackDetails';
import { IncidentAnalysis } from './components/IncidentAnalysis';
import { DependencyGraph } from './components/DependencyGraph';
import { useSearch } from './hooks/useSearch';
import { Service, ApplicationStack } from './types';

type ViewMode = 'search' | 'service-details' | 'stack-details' | 'incident-analysis' | 'dependency-graph';

function App() {
  const {
    query,
    results,
    isLoading,
    updateQuery,
    updateFilters,
    clearFilters
  } = useSearch();

  const [viewMode, setViewMode] = useState<ViewMode>('search');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedStack, setSelectedStack] = useState<ApplicationStack | null>(null);
  const [activeTab, setActiveTab] = useState<'services' | 'stacks'>('services');

  const handleServiceClick = (service: Service) => {
    setSelectedService(service);
    setViewMode('service-details');
  };

  const handleStackClick = (stack: ApplicationStack) => {
    setSelectedStack(stack);
    setViewMode('stack-details');
  };

  const handleAnalyzeIncident = (service: Service) => {
    setSelectedService(service);
    setViewMode('incident-analysis');
  };

  const handleBackToSearch = () => {
    setViewMode('search');
    setSelectedService(null);
    setSelectedStack(null);
  };

  const handleViewDependencies = () => {
    setViewMode('dependency-graph');
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">
            <span className="title-icon">&#9881;</span>
            Service Catalogue
          </h1>
          <p className="app-subtitle">Search and manage your application stack</p>
        </div>
        <nav className="header-nav">
          <button
            className={`nav-button ${viewMode === 'search' ? 'active' : ''}`}
            onClick={handleBackToSearch}
          >
            Search
          </button>
          <button
            className={`nav-button ${viewMode === 'dependency-graph' ? 'active' : ''}`}
            onClick={handleViewDependencies}
          >
            Dependency Graph
          </button>
        </nav>
      </header>

      <main className="app-main">
        {viewMode === 'search' && (
          <div className="search-view">
            <div className="search-header">
              <SearchBar
                query={query}
                onQueryChange={updateQuery}
                isLoading={isLoading}
              />
            </div>

            <div className="search-content">
              <aside className="filter-sidebar">
                <FilterPanel
                  onFilterChange={updateFilters}
                  onClearFilters={clearFilters}
                />
              </aside>

              <div className="results-container">
                <div className="results-tabs">
                  <button
                    className={`tab-button ${activeTab === 'services' ? 'active' : ''}`}
                    onClick={() => setActiveTab('services')}
                  >
                    Services ({results.totalServices})
                  </button>
                  <button
                    className={`tab-button ${activeTab === 'stacks' ? 'active' : ''}`}
                    onClick={() => setActiveTab('stacks')}
                  >
                    Application Stacks ({results.totalStacks})
                  </button>
                </div>

                <div className="results-panel">
                  {isLoading ? (
                    <div className="loading-state">
                      <div className="spinner"></div>
                      <p>Searching catalogue...</p>
                    </div>
                  ) : activeTab === 'services' ? (
                    <ServiceList
                      services={results.services}
                      onServiceClick={handleServiceClick}
                      onAnalyzeIncident={handleAnalyzeIncident}
                    />
                  ) : (
                    <StackList
                      stacks={results.stacks}
                      onStackClick={handleStackClick}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'service-details' && selectedService && (
          <ServiceDetails
            service={selectedService}
            onBack={handleBackToSearch}
            onAnalyzeIncident={() => handleAnalyzeIncident(selectedService)}
            onServiceClick={handleServiceClick}
          />
        )}

        {viewMode === 'stack-details' && selectedStack && (
          <StackDetails
            stack={selectedStack}
            onBack={handleBackToSearch}
            onServiceClick={handleServiceClick}
          />
        )}

        {viewMode === 'incident-analysis' && selectedService && (
          <IncidentAnalysis
            service={selectedService}
            onBack={handleBackToSearch}
            onServiceClick={handleServiceClick}
          />
        )}

        {viewMode === 'dependency-graph' && (
          <DependencyGraph
            onServiceClick={handleServiceClick}
            onBack={handleBackToSearch}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>HVPT Service Catalogue - For Agentic Service Management</p>
      </footer>
    </div>
  );
}

export default App;
