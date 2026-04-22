'use client';

import { useEffect } from 'react';
import { Backshift } from '@backshift/client';

export function BackshiftProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const endpoint = process.env.NEXT_PUBLIC_BACKSHIFT_ENDPOINT;
    if (!endpoint) {
      console.warn('[Backshift] NEXT_PUBLIC_BACKSHIFT_ENDPOINT is not set');
      return;
    }
    Backshift.init({
      endpoint,
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev',
      debug: process.env.NODE_ENV === 'development',
    });

    // Track initial page view
    Backshift.track('Page_View', { path: window.location.pathname });
  }, []);

  return <>{children}</>;
}
