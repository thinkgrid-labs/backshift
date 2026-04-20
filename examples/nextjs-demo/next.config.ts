import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // No third-party analytics scripts — all telemetry is proxied through
  // nightshift-edge at NEXT_PUBLIC_NIGHTSHIFT_ENDPOINT
};

export default nextConfig;
