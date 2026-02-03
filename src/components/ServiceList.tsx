import { Service } from '../types';
import { StatusBadge } from './StatusBadge';

interface ServiceListProps {
  services: Service[];
  onServiceClick: (service: Service) => void;
  onAnalyzeIncident: (service: Service) => void;
}

export function ServiceList({ services, onServiceClick, onAnalyzeIncident }: ServiceListProps) {
  if (services.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">&#128269;</div>
        <h3>No services found</h3>
        <p>Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <div className="service-list">
      {services.map(service => (
        <div
          key={service.id}
          className="service-card"
          onClick={() => onServiceClick(service)}
        >
          <div className="service-card-header">
            <div className="service-name-container">
              <h3 className="service-name">{service.displayName}</h3>
              <span className="service-id">{service.name}</span>
            </div>
            <StatusBadge status={service.status} />
          </div>

          <p className="service-description">{service.description}</p>

          <div className="service-meta">
            <div className="meta-item">
              <span className="meta-label">Type:</span>
              <span className="meta-value service-type-badge">{service.type}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Tier:</span>
              <span className={`meta-value tier-badge ${service.tier}`}>{service.tier}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Team:</span>
              <span className="meta-value">{service.ownerTeam.name}</span>
            </div>
          </div>

          <div className="service-tech-stack">
            {service.techStack.slice(0, 4).map(tech => (
              <span key={tech} className="tech-tag">{tech}</span>
            ))}
            {service.techStack.length > 4 && (
              <span className="tech-tag more">+{service.techStack.length - 4}</span>
            )}
          </div>

          <div className="service-dependencies">
            <span className="dep-count">
              <span className="dep-icon">&#8593;</span>
              {service.upstreamDependencies.length} upstream
            </span>
            <span className="dep-count">
              <span className="dep-icon">&#8595;</span>
              {service.downstreamDependencies.length} downstream
            </span>
          </div>

          <div className="service-card-actions">
            <button
              className="card-action-button primary"
              onClick={(e) => {
                e.stopPropagation();
                onServiceClick(service);
              }}
            >
              View Details
            </button>
            {service.status !== 'healthy' && (
              <button
                className="card-action-button warning"
                onClick={(e) => {
                  e.stopPropagation();
                  onAnalyzeIncident(service);
                }}
              >
                Analyze Impact
              </button>
            )}
            {service.status === 'healthy' && (
              <button
                className="card-action-button secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  onAnalyzeIncident(service);
                }}
              >
                Simulate Outage
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
