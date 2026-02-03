import { ApplicationStack, Service } from '../types';
import { StatusBadge } from './StatusBadge';

interface StackDetailsProps {
  stack: ApplicationStack;
  onBack: () => void;
  onServiceClick: (service: Service) => void;
}

export function StackDetails({ stack, onBack, onServiceClick }: StackDetailsProps) {
  const healthyCount = stack.services.filter(s => s.status === 'healthy').length;
  const degradedCount = stack.services.filter(s => s.status === 'degraded').length;
  const downCount = stack.services.filter(s => s.status === 'down').length;

  return (
    <div className="stack-details">
      <div className="details-header">
        <button className="back-button" onClick={onBack}>
          &#8592; Back to Search
        </button>
        <div className="details-title-row">
          <div>
            <h1 className="details-title">{stack.displayName}</h1>
            <span className="details-subtitle">{stack.name}</span>
          </div>
          <StatusBadge status={stack.status} size="large" />
        </div>
      </div>

      <div className="details-content">
        {/* Overview Section */}
        <section className="details-section">
          <h2 className="section-title">Overview</h2>
          <div className="info-grid">
            <div className="info-card">
              <h4>Description</h4>
              <p>{stack.description}</p>
            </div>
            <div className="info-card">
              <h4>Environment</h4>
              <span className="env-badge large">{stack.environment}</span>
            </div>
            <div className="info-card">
              <h4>Business Criticality</h4>
              <span className={`criticality-badge large ${stack.businessCriticality}`}>
                {stack.businessCriticality}
              </span>
            </div>
            <div className="info-card">
              <h4>Owner Team</h4>
              <p>{stack.ownerTeam.name}</p>
              {stack.ownerTeam.slackChannel && (
                <p className="team-channel">{stack.ownerTeam.slackChannel}</p>
              )}
            </div>
          </div>
        </section>

        {/* Health Summary */}
        <section className="details-section">
          <h2 className="section-title">Health Summary</h2>
          <div className="health-summary">
            <div className="health-stat healthy">
              <span className="health-count">{healthyCount}</span>
              <span className="health-label">Healthy</span>
            </div>
            <div className="health-stat degraded">
              <span className="health-count">{degradedCount}</span>
              <span className="health-label">Degraded</span>
            </div>
            <div className="health-stat down">
              <span className="health-count">{downCount}</span>
              <span className="health-label">Down</span>
            </div>
            <div className="health-stat total">
              <span className="health-count">{stack.services.length}</span>
              <span className="health-label">Total Services</span>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section className="details-section">
          <h2 className="section-title">Services in Stack ({stack.services.length})</h2>
          <div className="stack-services-grid">
            {stack.services.map(service => (
              <div
                key={service.id}
                className="stack-service-card"
                onClick={() => onServiceClick(service)}
              >
                <div className="stack-service-header">
                  <StatusBadge status={service.status} size="small" />
                  <h4>{service.displayName}</h4>
                </div>
                <p className="stack-service-type">{service.type}</p>
                <p className="stack-service-tier">{service.tier}</p>
                <div className="stack-service-deps">
                  <span>&#8593; {service.upstreamDependencies.length}</span>
                  <span>&#8595; {service.downstreamDependencies.length}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Service Dependencies Matrix */}
        <section className="details-section">
          <h2 className="section-title">Internal Dependencies</h2>
          <div className="deps-matrix">
            <p className="matrix-description">
              Dependencies between services within this stack:
            </p>
            <div className="deps-list-detailed">
              {stack.services.map(service => {
                const internalDeps = service.upstreamDependencies.filter(dep =>
                  stack.services.some(s => s.id === dep.serviceId)
                );
                if (internalDeps.length === 0) return null;
                return (
                  <div key={service.id} className="service-deps-row">
                    <strong>{service.displayName}</strong>
                    <span className="deps-arrow">depends on</span>
                    <div className="deps-targets">
                      {internalDeps.map(dep => (
                        <span key={dep.serviceId} className={`dep-chip ${dep.type}`}>
                          {dep.serviceName}
                          <span className="dep-type">({dep.type})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* External Dependencies */}
        <section className="details-section">
          <h2 className="section-title">External Dependencies</h2>
          <div className="external-deps">
            {(() => {
              const externalDeps = new Map<string, { serviceName: string; type: 'hard' | 'soft'; consumers: string[] }>();
              stack.services.forEach(service => {
                service.upstreamDependencies.forEach(dep => {
                  if (!stack.services.some(s => s.id === dep.serviceId)) {
                    const existing = externalDeps.get(dep.serviceId);
                    if (existing) {
                      existing.consumers.push(service.displayName);
                    } else {
                      externalDeps.set(dep.serviceId, {
                        serviceName: dep.serviceName,
                        type: dep.type,
                        consumers: [service.displayName]
                      });
                    }
                  }
                });
              });

              if (externalDeps.size === 0) {
                return <p className="no-deps">No external dependencies</p>;
              }

              return (
                <div className="external-deps-list">
                  {Array.from(externalDeps.entries()).map(([id, dep]) => (
                    <div key={id} className={`external-dep-card ${dep.type}`}>
                      <div className="external-dep-header">
                        <strong>{dep.serviceName}</strong>
                        <span className={`dep-type-badge ${dep.type}`}>{dep.type}</span>
                      </div>
                      <p className="external-dep-consumers">
                        Used by: {dep.consumers.join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </section>

        {/* Tags */}
        <section className="details-section">
          <h2 className="section-title">Tags</h2>
          <div className="tags-list">
            {stack.tags.map(tag => (
              <span key={tag} className="detail-tag">{tag}</span>
            ))}
          </div>
        </section>

        {/* Metadata */}
        <section className="details-section metadata">
          <p>Created: {new Date(stack.createdAt).toLocaleDateString()}</p>
          <p>Updated: {new Date(stack.updatedAt).toLocaleDateString()}</p>
        </section>
      </div>
    </div>
  );
}
