import { ApplicationStack } from '../types';
import { StatusBadge } from './StatusBadge';

interface StackListProps {
  stacks: ApplicationStack[];
  onStackClick: (stack: ApplicationStack) => void;
}

export function StackList({ stacks, onStackClick }: StackListProps) {
  if (stacks.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">&#128230;</div>
        <h3>No application stacks found</h3>
        <p>Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <div className="stack-list">
      {stacks.map(stack => (
        <div
          key={stack.id}
          className="stack-card"
          onClick={() => onStackClick(stack)}
        >
          <div className="stack-card-header">
            <div className="stack-name-container">
              <h3 className="stack-name">{stack.displayName}</h3>
              <span className="stack-id">{stack.name}</span>
            </div>
            <StatusBadge status={stack.status} />
          </div>

          <p className="stack-description">{stack.description}</p>

          <div className="stack-meta">
            <div className="meta-item">
              <span className="meta-label">Environment:</span>
              <span className="meta-value env-badge">{stack.environment}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Criticality:</span>
              <span className={`meta-value criticality-badge ${stack.businessCriticality}`}>
                {stack.businessCriticality}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Owner:</span>
              <span className="meta-value">{stack.ownerTeam.name}</span>
            </div>
          </div>

          <div className="stack-services-preview">
            <span className="services-label">Services ({stack.services.length}):</span>
            <div className="services-list-mini">
              {stack.services.slice(0, 3).map(service => (
                <span key={service.id} className="service-mini-badge">
                  <StatusBadge status={service.status} size="small" />
                  {service.displayName}
                </span>
              ))}
              {stack.services.length > 3 && (
                <span className="service-mini-badge more">
                  +{stack.services.length - 3} more
                </span>
              )}
            </div>
          </div>

          <div className="stack-tags">
            {stack.tags.map(tag => (
              <span key={tag} className="stack-tag">{tag}</span>
            ))}
          </div>

          <div className="stack-card-actions">
            <button
              className="card-action-button primary"
              onClick={(e) => {
                e.stopPropagation();
                onStackClick(stack);
              }}
            >
              View Stack Details
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
