'use client';

import { useEffect } from 'react';
import { Nightshift } from '@nightshift/client';

export function NightshiftProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const endpoint = process.env.NEXT_PUBLIC_NIGHTSHIFT_ENDPOINT;
    if (!endpoint) {
      console.warn('[Nightshift] NEXT_PUBLIC_NIGHTSHIFT_ENDPOINT is not set');
      return;
    }
    Nightshift.init({
      endpoint,
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev',
      debug: process.env.NODE_ENV === 'development',
    });

    // Track initial page view
    Nightshift.track('Page_View', { path: window.location.pathname });
  }, []);

  return <>{children}</>;
}
