import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // No third-party analytics scripts — all telemetry is proxied through
  // backshift-edge at NEXT_PUBLIC_BACKSHIFT_ENDPOINT
};

export default nextConfig;
