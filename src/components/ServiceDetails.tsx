import { Service } from '../types';
import { StatusBadge } from './StatusBadge';

interface ServiceDetailsProps {
  service: Service;
  onBack: () => void;
  onAnalyzeIncident: () => void;
  onServiceClick: (service: Service) => void;
}

export function ServiceDetails({ service, onBack, onAnalyzeIncident, onServiceClick: _onServiceClick }: ServiceDetailsProps) {
  return (
    <div className="service-details">
      <div className="details-header">
        <button className="back-button" onClick={onBack}>
          &#8592; Back to Search
        </button>
        <div className="details-title-row">
          <div>
            <h1 className="details-title">{service.displayName}</h1>
            <span className="details-subtitle">{service.name}</span>
          </div>
          <div className="details-actions">
            <StatusBadge status={service.status} size="large" />
            <button className="action-button warning" onClick={onAnalyzeIncident}>
              Analyze Impact
            </button>
          </div>
        </div>
      </div>

      <div className="details-content">
        {/* Overview Section */}
        <section className="details-section">
          <h2 className="section-title">Overview</h2>
          <div className="info-grid">
            <div className="info-card">
              <h4>Description</h4>
              <p>{service.description}</p>
            </div>
            <div className="info-card">
              <h4>Type & Tier</h4>
              <p>
                <span className="service-type-badge">{service.type}</span>
                <span className={`tier-badge ${service.tier}`}>{service.tier}</span>
              </p>
            </div>
            <div className="info-card">
              <h4>Architecture</h4>
              <p>{service.architecture || 'Not specified'}</p>
            </div>
            <div className="info-card">
              <h4>Tech Stack</h4>
              <div className="tech-tags">
                {service.techStack.map(tech => (
                  <span key={tech} className="tech-tag">{tech}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Ownership Section */}
        <section className="details-section">
          <h2 className="section-title">Ownership</h2>
          <div className="owner-info">
            <div className="owner-team">
              <h4>{service.ownerTeam.name}</h4>
              {service.ownerTeam.slackChannel && (
                <p><strong>Slack:</strong> {service.ownerTeam.slackChannel}</p>
              )}
              {service.ownerTeam.emailGroup && (
                <p><strong>Email:</strong> {service.ownerTeam.emailGroup}</p>
              )}
            </div>
            <div className="contacts-list">
              <h4>Contacts</h4>
              {service.ownerTeam.contacts.map(contact => (
                <div key={contact.id} className="contact-card">
                  <span className={`contact-role ${contact.role}`}>{contact.role}</span>
                  <strong>{contact.name}</strong>
                  <span>{contact.email}</span>
                  {contact.phone && <span>{contact.phone}</span>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Dependencies Section */}
        <section className="details-section">
          <h2 className="section-title">Dependencies</h2>
          <div className="dependencies-grid">
            <div className="dep-column">
              <h4>&#8593; Upstream Dependencies ({service.upstreamDependencies.length})</h4>
              {service.upstreamDependencies.length === 0 ? (
                <p className="no-deps">No upstream dependencies</p>
              ) : (
                <div className="dep-list">
                  {service.upstreamDependencies.map(dep => (
                    <div
                      key={dep.serviceId}
                      className={`dep-item ${dep.type}`}
                      onClick={() => {
                        // Would normally fetch the service and navigate
                      }}
                    >
                      <div className="dep-header">
                        <span className="dep-name">{dep.serviceName}</span>
                        <span className={`dep-type-badge ${dep.type}`}>{dep.type}</span>
                      </div>
                      <p className="dep-description">{dep.description}</p>
                      <span className="dep-flow">Data flow: {dep.dataFlow}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="dep-column">
              <h4>&#8595; Downstream Dependencies ({service.downstreamDependencies.length})</h4>
              {service.downstreamDependencies.length === 0 ? (
                <p className="no-deps">No downstream dependencies</p>
              ) : (
                <div className="dep-list">
                  {service.downstreamDependencies.map(dep => (
                    <div
                      key={dep.serviceId}
                      className={`dep-item ${dep.type}`}
                    >
                      <div className="dep-header">
                        <span className="dep-name">{dep.serviceName}</span>
                        <span className={`dep-type-badge ${dep.type}`}>{dep.type}</span>
                      </div>
                      <p className="dep-description">{dep.description}</p>
                      <span className="dep-flow">Data flow: {dep.dataFlow}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Infrastructure Section */}
        <section className="details-section">
          <h2 className="section-title">Infrastructure</h2>
          <div className="infra-grid">
            <div className="infra-column">
              <h4>Servers ({service.servers.length})</h4>
              {service.servers.map(server => (
                <div key={server.id} className="server-card">
                  <div className="server-header">
                    <strong>{server.hostname}</strong>
                    <span className="server-env">{server.environment}</span>
                  </div>
                  <p>IP: {server.ipAddress}</p>
                  <p>Datacenter: {server.datacenter}</p>
                  {server.specs && (
                    <div className="server-specs">
                      <span>{server.specs.cpu}</span>
                      <span>{server.specs.memory}</span>
                      <span>{server.specs.storage}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="infra-column">
              <h4>Endpoints ({service.endpoints.length})</h4>
              {service.endpoints.map(endpoint => (
                <div key={endpoint.id} className="endpoint-card">
                  <div className="endpoint-header">
                    <span className={`http-method ${endpoint.method.toLowerCase()}`}>
                      {endpoint.method}
                    </span>
                    <code className="endpoint-url">{endpoint.url}</code>
                  </div>
                  <p>{endpoint.description}</p>
                  {endpoint.expectedResponseTime && (
                    <span className="response-time">
                      Expected: {endpoint.expectedResponseTime}ms
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Runbooks Section */}
        {service.runbooks.length > 0 && (
          <section className="details-section">
            <h2 className="section-title">Runbooks</h2>
            <div className="runbooks-list">
              {service.runbooks.map(runbook => (
                <div key={runbook.id} className="runbook-card">
                  <div className="runbook-header">
                    <h4>{runbook.title}</h4>
                    <span className="runbook-duration">{runbook.estimatedDuration}</span>
                  </div>
                  <p className="runbook-description">{runbook.description}</p>
                  <div className="runbook-triggers">
                    <strong>Triggers:</strong>
                    <ul>
                      {runbook.triggerConditions.map((condition, idx) => (
                        <li key={idx}>{condition}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="runbook-steps">
                    <strong>Steps:</strong>
                    <ol>
                      {runbook.steps.map(step => (
                        <li key={step.order}>
                          <strong>{step.title}</strong>
                          <p>{step.description}</p>
                          {step.commands && step.commands.length > 0 && (
                            <div className="step-commands">
                              {step.commands.map((cmd, idx) => (
                                <code key={idx}>{cmd}</code>
                              ))}
                            </div>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="runbook-meta">
                    <span>Last updated: {runbook.lastUpdated}</span>
                    <span>Author: {runbook.author}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SLA Section */}
        {service.sla && (
          <section className="details-section">
            <h2 className="section-title">SLA & Performance</h2>
            <div className="sla-grid">
              <div className="sla-card">
                <h4>Target Uptime</h4>
                <span className="sla-value">{service.sla.targetUptime}%</span>
                {service.sla.currentUptime && (
                  <span className={`sla-current ${service.sla.currentUptime >= service.sla.targetUptime ? 'good' : 'bad'}`}>
                    Current: {service.sla.currentUptime}%
                  </span>
                )}
              </div>
              {service.sla.responseTimeP50 && (
                <div className="sla-card">
                  <h4>Response Time (P50/P95/P99)</h4>
                  <span className="sla-value">
                    {service.sla.responseTimeP50}ms / {service.sla.responseTimeP95}ms / {service.sla.responseTimeP99}ms
                  </span>
                </div>
              )}
              {service.sla.errorRateThreshold && (
                <div className="sla-card">
                  <h4>Error Rate Threshold</h4>
                  <span className="sla-value">{service.sla.errorRateThreshold}%</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Alerts Section */}
        {service.alerts.length > 0 && (
          <section className="details-section">
            <h2 className="section-title">Alerts ({service.alerts.length})</h2>
            <div className="alerts-list">
              {service.alerts.map(alert => (
                <div key={alert.id} className={`alert-card ${alert.severity}`}>
                  <div className="alert-header">
                    <span className={`alert-severity ${alert.severity}`}>{alert.severity}</span>
                    <strong>{alert.name}</strong>
                  </div>
                  <p>Condition: {alert.condition}</p>
                  <p>Channels: {alert.notificationChannels.join(', ')}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Links Section */}
        <section className="details-section">
          <h2 className="section-title">Links</h2>
          <div className="links-grid">
            {service.repository && (
              <a href={service.repository} className="link-card" target="_blank" rel="noopener noreferrer">
                <span className="link-icon">&#128190;</span>
                <span>Repository</span>
              </a>
            )}
            {service.documentationUrl && (
              <a href={service.documentationUrl} className="link-card" target="_blank" rel="noopener noreferrer">
                <span className="link-icon">&#128196;</span>
                <span>Documentation</span>
              </a>
            )}
            {service.metrics.length > 0 && service.metrics[0].dashboardUrl && (
              <a href={service.metrics[0].dashboardUrl} className="link-card" target="_blank" rel="noopener noreferrer">
                <span className="link-icon">&#128200;</span>
                <span>Dashboard</span>
              </a>
            )}
          </div>
        </section>

        {/* Tags Section */}
        <section className="details-section">
          <h2 className="section-title">Tags</h2>
          <div className="tags-list">
            {service.tags.map(tag => (
              <span key={tag} className="detail-tag">{tag}</span>
            ))}
          </div>
        </section>

        {/* Metadata */}
        <section className="details-section metadata">
          <p>Created: {new Date(service.createdAt).toLocaleDateString()}</p>
          <p>Updated: {new Date(service.updatedAt).toLocaleDateString()}</p>
          {service.version && <p>Version: {service.version}</p>}
        </section>
      </div>
    </div>
  );
}
