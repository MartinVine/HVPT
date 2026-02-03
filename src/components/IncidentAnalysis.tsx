import { useState, useEffect } from 'react';
import { Service, IncidentImpactAnalysis } from '../types';
import { analyzeIncidentImpact } from '../services/catalogueService';
import { StatusBadge } from './StatusBadge';

interface IncidentAnalysisProps {
  service: Service;
  onBack: () => void;
  onServiceClick: (service: Service) => void;
}

export function IncidentAnalysis({ service, onBack, onServiceClick }: IncidentAnalysisProps) {
  const [analysis, setAnalysis] = useState<IncidentImpactAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAnalysis = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await analyzeIncidentImpact(service.id);
        setAnalysis(result);
      } catch (err) {
        setError('Failed to analyze incident impact');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    loadAnalysis();
  }, [service.id]);

  if (isLoading) {
    return (
      <div className="incident-analysis loading">
        <div className="loading-state">
          <div className="spinner large"></div>
          <h2>Analyzing Incident Impact...</h2>
          <p>Calculating affected services and generating recommendations</p>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="incident-analysis error">
        <button className="back-button" onClick={onBack}>
          &#8592; Back to Search
        </button>
        <div className="error-state">
          <h2>Analysis Failed</h2>
          <p>{error || 'Unable to analyze incident impact'}</p>
        </div>
      </div>
    );
  }

  const criticalImpacts = analysis.impactedServices.filter(i => i.severity === 'critical');
  const highImpacts = analysis.impactedServices.filter(i => i.severity === 'high');
  const mediumImpacts = analysis.impactedServices.filter(i => i.severity === 'medium');
  const lowImpacts = analysis.impactedServices.filter(i => i.severity === 'low');

  return (
    <div className="incident-analysis">
      <div className="analysis-header">
        <button className="back-button" onClick={onBack}>
          &#8592; Back to Search
        </button>
        <div className="analysis-title-row">
          <div>
            <h1 className="analysis-title">Incident Impact Analysis</h1>
            <span className="analysis-subtitle">
              Analyzing outage scenario for: {service.displayName}
            </span>
          </div>
          <div className="affected-service-badge">
            <StatusBadge status={service.status} size="large" />
          </div>
        </div>
      </div>

      <div className="analysis-content">
        {/* Impact Summary */}
        <section className="analysis-section alert-section">
          <div className="impact-banner">
            <div className="impact-icon">&#9888;</div>
            <div className="impact-summary">
              <h2>Business Impact Assessment</h2>
              <p className="impact-description">{analysis.businessImpact}</p>
            </div>
          </div>
        </section>

        {/* Impact Statistics */}
        <section className="analysis-section">
          <h2 className="section-title">Impact Overview</h2>
          <div className="impact-stats">
            <div className="impact-stat critical">
              <span className="stat-count">{criticalImpacts.length}</span>
              <span className="stat-label">Critical</span>
            </div>
            <div className="impact-stat high">
              <span className="stat-count">{highImpacts.length}</span>
              <span className="stat-label">High</span>
            </div>
            <div className="impact-stat medium">
              <span className="stat-count">{mediumImpacts.length}</span>
              <span className="stat-label">Medium</span>
            </div>
            <div className="impact-stat low">
              <span className="stat-count">{lowImpacts.length}</span>
              <span className="stat-label">Low</span>
            </div>
            <div className="impact-stat total">
              <span className="stat-count">{analysis.impactedServices.length}</span>
              <span className="stat-label">Total Affected</span>
            </div>
          </div>
        </section>

        {/* Suggested Actions */}
        <section className="analysis-section">
          <h2 className="section-title">&#9889; Suggested Actions</h2>
          <div className="actions-list">
            {analysis.suggestedActions.map((action, index) => (
              <div key={index} className="action-item">
                <span className="action-text">{action}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Escalation Contacts */}
        <section className="analysis-section">
          <h2 className="section-title">&#128222; Escalation Contacts</h2>
          <div className="contacts-grid">
            {analysis.escalationContacts.map(contact => (
              <div key={contact.id} className="escalation-contact-card">
                <div className="contact-header">
                  <span className={`contact-role ${contact.role}`}>{contact.role}</span>
                  <strong className="contact-name">{contact.name}</strong>
                </div>
                <div className="contact-details">
                  <p><strong>Team:</strong> {contact.team}</p>
                  <p><strong>Email:</strong> <a href={`mailto:${contact.email}`}>{contact.email}</a></p>
                  {contact.phone && (
                    <p><strong>Phone:</strong> <a href={`tel:${contact.phone}`}>{contact.phone}</a></p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Impacted Services */}
        <section className="analysis-section">
          <h2 className="section-title">Impacted Services</h2>

          {criticalImpacts.length > 0 && (
            <div className="impact-group critical">
              <h3 className="impact-group-title">
                <span className="severity-indicator critical"></span>
                Critical Impact ({criticalImpacts.length})
              </h3>
              <div className="impacted-services-list">
                {criticalImpacts.map(impact => (
                  <div
                    key={impact.service.id}
                    className="impacted-service-card critical"
                    onClick={() => onServiceClick(impact.service)}
                  >
                    <div className="impacted-service-header">
                      <StatusBadge status={impact.service.status} size="small" />
                      <strong>{impact.service.displayName}</strong>
                      <span className="impact-type">{impact.impactType}</span>
                    </div>
                    <p className="impact-estimate">{impact.estimatedImpact}</p>
                    <div className="impacted-service-meta">
                      <span>{impact.service.type}</span>
                      <span>{impact.service.tier}</span>
                      <span>{impact.service.ownerTeam.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {highImpacts.length > 0 && (
            <div className="impact-group high">
              <h3 className="impact-group-title">
                <span className="severity-indicator high"></span>
                High Impact ({highImpacts.length})
              </h3>
              <div className="impacted-services-list">
                {highImpacts.map(impact => (
                  <div
                    key={impact.service.id}
                    className="impacted-service-card high"
                    onClick={() => onServiceClick(impact.service)}
                  >
                    <div className="impacted-service-header">
                      <StatusBadge status={impact.service.status} size="small" />
                      <strong>{impact.service.displayName}</strong>
                      <span className="impact-type">{impact.impactType}</span>
                    </div>
                    <p className="impact-estimate">{impact.estimatedImpact}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mediumImpacts.length > 0 && (
            <div className="impact-group medium">
              <h3 className="impact-group-title">
                <span className="severity-indicator medium"></span>
                Medium Impact ({mediumImpacts.length})
              </h3>
              <div className="impacted-services-list">
                {mediumImpacts.map(impact => (
                  <div
                    key={impact.service.id}
                    className="impacted-service-card medium"
                    onClick={() => onServiceClick(impact.service)}
                  >
                    <div className="impacted-service-header">
                      <StatusBadge status={impact.service.status} size="small" />
                      <strong>{impact.service.displayName}</strong>
                      <span className="impact-type">{impact.impactType}</span>
                    </div>
                    <p className="impact-estimate">{impact.estimatedImpact}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {lowImpacts.length > 0 && (
            <div className="impact-group low">
              <h3 className="impact-group-title">
                <span className="severity-indicator low"></span>
                Low Impact ({lowImpacts.length})
              </h3>
              <div className="impacted-services-list">
                {lowImpacts.map(impact => (
                  <div
                    key={impact.service.id}
                    className="impacted-service-card low"
                    onClick={() => onServiceClick(impact.service)}
                  >
                    <div className="impacted-service-header">
                      <StatusBadge status={impact.service.status} size="small" />
                      <strong>{impact.service.displayName}</strong>
                    </div>
                    <p className="impact-estimate">{impact.estimatedImpact}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Relevant Runbooks */}
        {analysis.relevantRunbooks.length > 0 && (
          <section className="analysis-section">
            <h2 className="section-title">&#128214; Relevant Runbooks</h2>
            <div className="runbooks-list">
              {analysis.relevantRunbooks.map(runbook => (
                <div key={runbook.id} className="runbook-card compact">
                  <div className="runbook-header">
                    <h4>{runbook.title}</h4>
                    {runbook.estimatedDuration && (
                      <span className="runbook-duration">{runbook.estimatedDuration}</span>
                    )}
                  </div>
                  <p className="runbook-description">{runbook.description}</p>
                  <div className="runbook-quick-steps">
                    <strong>Quick Steps:</strong>
                    <ol>
                      {runbook.steps.slice(0, 3).map(step => (
                        <li key={step.order}>{step.title}</li>
                      ))}
                      {runbook.steps.length > 3 && (
                        <li className="more-steps">+{runbook.steps.length - 3} more steps...</li>
                      )}
                    </ol>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Agent-Ready Data Export */}
        <section className="analysis-section">
          <h2 className="section-title">&#129302; Agent-Ready Summary</h2>
          <div className="agent-summary">
            <p className="agent-description">
              This data structure is ready for consumption by AI agents for automated incident response:
            </p>
            <pre className="agent-data">
{JSON.stringify({
  affectedService: {
    id: service.id,
    name: service.name,
    tier: service.tier,
    status: service.status
  },
  impactSummary: {
    critical: criticalImpacts.length,
    high: highImpacts.length,
    medium: mediumImpacts.length,
    low: lowImpacts.length,
    total: analysis.impactedServices.length
  },
  primaryAction: analysis.suggestedActions[0] || 'Check service health',
  escalationRequired: service.tier === 'tier-1' || criticalImpacts.length > 0,
  primaryContact: analysis.escalationContacts[0]?.email || 'oncall@company.com'
}, null, 2)}
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
}
