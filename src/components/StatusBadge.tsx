import { ServiceStatus } from '../types';

interface StatusBadgeProps {
  status: ServiceStatus;
  size?: 'small' | 'medium' | 'large';
}

const STATUS_CONFIG: Record<ServiceStatus, { label: string; color: string; bgColor: string }> = {
  healthy: { label: 'Healthy', color: '#166534', bgColor: '#dcfce7' },
  degraded: { label: 'Degraded', color: '#92400e', bgColor: '#fef3c7' },
  down: { label: 'Down', color: '#991b1b', bgColor: '#fee2e2' },
  maintenance: { label: 'Maintenance', color: '#3730a3', bgColor: '#e0e7ff' },
  unknown: { label: 'Unknown', color: '#374151', bgColor: '#f3f4f6' },
};

export function StatusBadge({ status, size = 'medium' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  if (size === 'small') {
    return (
      <span
        className="status-dot"
        style={{ backgroundColor: config.color }}
        title={config.label}
      />
    );
  }

  return (
    <span
      className={`status-badge status-badge-${size}`}
      style={{
        backgroundColor: config.bgColor,
        color: config.color,
      }}
    >
      <span className="status-indicator" style={{ backgroundColor: config.color }}></span>
      {config.label}
    </span>
  );
}
