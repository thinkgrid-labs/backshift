'use client';

import { Backshift } from '@backshift/client';

export function ErrorDemo() {
  function triggerError() {
    try {
      throw new Error('Payment gateway timeout — demo error');
    } catch (err) {
      if (err instanceof Error) {
        Backshift.error(err, { component: 'CheckoutFlow', retryable: true });
      }
    }
  }

  function triggerTypeError() {
    try {
      // Intentional runtime error
      const obj = null;
      (obj as unknown as Record<string, unknown>)['key'];
    } catch (err) {
      if (err instanceof Error) {
        Backshift.error(err, { component: 'DataLoader' });
      }
    }
  }

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <button
        data-testid="track-error"
        onClick={triggerError}
        style={{
          padding: '10px 20px',
          background: '#dc2626',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Trigger Error
      </button>
      <button
        data-testid="track-type-error"
        onClick={triggerTypeError}
        style={{
          padding: '10px 20px',
          background: '#9333ea',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Trigger TypeError
      </button>
    </div>
  );
}
