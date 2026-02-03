import { useState, useEffect } from 'react';
import { SearchFilters, ServiceType, ServiceTier, ServiceStatus, Team } from '../types';
import { getAllTeams, getAllTags } from '../services/catalogueService';

interface FilterPanelProps {
  onFilterChange: (filters: Partial<SearchFilters>) => void;
  onClearFilters: () => void;
}

const SERVICE_TYPES: { value: ServiceType; label: string }[] = [
  { value: 'api', label: 'API' },
  { value: 'web', label: 'Web Application' },
  { value: 'database', label: 'Database' },
  { value: 'cache', label: 'Cache' },
  { value: 'queue', label: 'Message Queue' },
  { value: 'storage', label: 'Storage' },
  { value: 'compute', label: 'Compute' },
  { value: 'network', label: 'Network' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'security', label: 'Security' },
];

const SERVICE_TIERS: { value: ServiceTier; label: string }[] = [
  { value: 'tier-1', label: 'Tier 1 (Critical)' },
  { value: 'tier-2', label: 'Tier 2 (High)' },
  { value: 'tier-3', label: 'Tier 3 (Medium)' },
  { value: 'tier-4', label: 'Tier 4 (Low)' },
];

const SERVICE_STATUSES: { value: ServiceStatus; label: string; color: string }[] = [
  { value: 'healthy', label: 'Healthy', color: '#22c55e' },
  { value: 'degraded', label: 'Degraded', color: '#f59e0b' },
  { value: 'down', label: 'Down', color: '#ef4444' },
  { value: 'maintenance', label: 'Maintenance', color: '#6366f1' },
  { value: 'unknown', label: 'Unknown', color: '#6b7280' },
];

export function FilterPanel({ onFilterChange, onClearFilters }: FilterPanelProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<ServiceType[]>([]);
  const [selectedTiers, setSelectedTiers] = useState<ServiceTier[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<ServiceStatus[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    type: true,
    tier: true,
    status: true,
    team: false,
    tags: false,
  });

  useEffect(() => {
    const loadFilterOptions = async () => {
      const [teamsData, tagsData] = await Promise.all([
        getAllTeams(),
        getAllTags()
      ]);
      setTeams(teamsData);
      setTags(tagsData);
    };
    loadFilterOptions();
  }, []);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleTypeChange = (type: ServiceType) => {
    const newTypes = selectedTypes.includes(type)
      ? selectedTypes.filter(t => t !== type)
      : [...selectedTypes, type];
    setSelectedTypes(newTypes);
    onFilterChange({ type: newTypes.length > 0 ? newTypes : undefined });
  };

  const handleTierChange = (tier: ServiceTier) => {
    const newTiers = selectedTiers.includes(tier)
      ? selectedTiers.filter(t => t !== tier)
      : [...selectedTiers, tier];
    setSelectedTiers(newTiers);
    onFilterChange({ tier: newTiers.length > 0 ? newTiers : undefined });
  };

  const handleStatusChange = (status: ServiceStatus) => {
    const newStatuses = selectedStatuses.includes(status)
      ? selectedStatuses.filter(s => s !== status)
      : [...selectedStatuses, status];
    setSelectedStatuses(newStatuses);
    onFilterChange({ status: newStatuses.length > 0 ? newStatuses : undefined });
  };

  const handleTeamChange = (teamId: string) => {
    const newTeams = selectedTeams.includes(teamId)
      ? selectedTeams.filter(t => t !== teamId)
      : [...selectedTeams, teamId];
    setSelectedTeams(newTeams);
    onFilterChange({ team: newTeams.length > 0 ? newTeams : undefined });
  };

  const handleTagChange = (tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];
    setSelectedTags(newTags);
    onFilterChange({ tags: newTags.length > 0 ? newTags : undefined });
  };

  const handleClearAll = () => {
    setSelectedTypes([]);
    setSelectedTiers([]);
    setSelectedStatuses([]);
    setSelectedTeams([]);
    setSelectedTags([]);
    onClearFilters();
  };

  const hasActiveFilters = selectedTypes.length > 0 || selectedTiers.length > 0 ||
    selectedStatuses.length > 0 || selectedTeams.length > 0 || selectedTags.length > 0;

  return (
    <div className="filter-panel">
      <div className="filter-header">
        <h3>Filters</h3>
        {hasActiveFilters && (
          <button className="clear-filters-button" onClick={handleClearAll}>
            Clear All
          </button>
        )}
      </div>

      {/* Status Filter */}
      <div className="filter-section">
        <button
          className="filter-section-header"
          onClick={() => toggleSection('status')}
        >
          <span>Status</span>
          <span className="toggle-icon">{expandedSections.status ? '−' : '+'}</span>
        </button>
        {expandedSections.status && (
          <div className="filter-options">
            {SERVICE_STATUSES.map(status => (
              <label key={status.value} className="filter-option">
                <input
                  type="checkbox"
                  checked={selectedStatuses.includes(status.value)}
                  onChange={() => handleStatusChange(status.value)}
                />
                <span
                  className="status-indicator"
                  style={{ backgroundColor: status.color }}
                ></span>
                <span>{status.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Tier Filter */}
      <div className="filter-section">
        <button
          className="filter-section-header"
          onClick={() => toggleSection('tier')}
        >
          <span>Service Tier</span>
          <span className="toggle-icon">{expandedSections.tier ? '−' : '+'}</span>
        </button>
        {expandedSections.tier && (
          <div className="filter-options">
            {SERVICE_TIERS.map(tier => (
              <label key={tier.value} className="filter-option">
                <input
                  type="checkbox"
                  checked={selectedTiers.includes(tier.value)}
                  onChange={() => handleTierChange(tier.value)}
                />
                <span>{tier.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Type Filter */}
      <div className="filter-section">
        <button
          className="filter-section-header"
          onClick={() => toggleSection('type')}
        >
          <span>Service Type</span>
          <span className="toggle-icon">{expandedSections.type ? '−' : '+'}</span>
        </button>
        {expandedSections.type && (
          <div className="filter-options">
            {SERVICE_TYPES.map(type => (
              <label key={type.value} className="filter-option">
                <input
                  type="checkbox"
                  checked={selectedTypes.includes(type.value)}
                  onChange={() => handleTypeChange(type.value)}
                />
                <span>{type.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Team Filter */}
      <div className="filter-section">
        <button
          className="filter-section-header"
          onClick={() => toggleSection('team')}
        >
          <span>Team</span>
          <span className="toggle-icon">{expandedSections.team ? '−' : '+'}</span>
        </button>
        {expandedSections.team && (
          <div className="filter-options">
            {teams.map(team => (
              <label key={team.id} className="filter-option">
                <input
                  type="checkbox"
                  checked={selectedTeams.includes(team.id)}
                  onChange={() => handleTeamChange(team.id)}
                />
                <span>{team.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Tags Filter */}
      <div className="filter-section">
        <button
          className="filter-section-header"
          onClick={() => toggleSection('tags')}
        >
          <span>Tags</span>
          <span className="toggle-icon">{expandedSections.tags ? '−' : '+'}</span>
        </button>
        {expandedSections.tags && (
          <div className="filter-options filter-tags">
            {tags.map(tag => (
              <button
                key={tag}
                className={`tag-filter-button ${selectedTags.includes(tag) ? 'active' : ''}`}
                onClick={() => handleTagChange(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
