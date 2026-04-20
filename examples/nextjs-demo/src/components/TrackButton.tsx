'use client';

import { Nightshift } from '@nightshift/client';

interface TrackButtonProps {
  event: string;
  properties?: Record<string, unknown>;
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
}

export function TrackButton({ event, properties, label, variant = 'primary' }: TrackButtonProps) {
  const colors = {
    primary: 'background:#2563eb;color:#fff',
    secondary: 'background:#6b7280;color:#fff',
    danger: 'background:#dc2626;color:#fff',
  };

  return (
    <button
      data-testid={`track-${event}`}
      style={{
        padding: '10px 20px',
        borderRadius: '6px',
        border: 'none',
        cursor: 'pointer',
        fontWeight: 600,
        ...parseStyle(colors[variant]),
      }}
      onClick={() => {
        Nightshift.track(event, { ...properties, triggeredAt: Date.now() });
      }}
    >
      {label}
    </button>
  );
}

function parseStyle(str: string): React.CSSProperties {
  return Object.fromEntries(
    str.split(';').map((part) => {
      const [k, v] = part.split(':');
      return [k?.trim(), v?.trim()];
    })
  );
}
