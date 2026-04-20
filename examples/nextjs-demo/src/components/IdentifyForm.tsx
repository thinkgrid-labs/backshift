'use client';

import { useState } from 'react';
import { Nightshift } from '@nightshift/client';

export function IdentifyForm() {
  const [userId, setUserId] = useState('');
  const [plan, setPlan] = useState('free');
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId.trim()) return;
    Nightshift.identify(userId.trim(), { plan, source: 'demo' });
    setSent(true);
    setTimeout(() => setSent(false), 2000);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 340 }}>
      <input
        type="text"
        placeholder="User ID (e.g. user_123)"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        style={{
          padding: '8px 12px',
          border: '1px solid #d1d5db',
          borderRadius: 6,
          fontSize: 14,
        }}
      />
      <select
        value={plan}
        onChange={(e) => setPlan(e.target.value)}
        style={{
          padding: '8px 12px',
          border: '1px solid #d1d5db',
          borderRadius: 6,
          fontSize: 14,
        }}
      >
        <option value="free">Free</option>
        <option value="pro">Pro</option>
        <option value="enterprise">Enterprise</option>
      </select>
      <button
        type="submit"
        style={{
          padding: '10px 20px',
          background: '#059669',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {sent ? '✓ Sent!' : 'Identify User'}
      </button>
    </form>
  );
}
