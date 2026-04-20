import type { Metadata } from 'next';
import { NightshiftProvider } from '../components/NightshiftProvider';

export const metadata: Metadata = {
  title: 'Nightshift Demo',
  description: 'Zero-overhead telemetry gateway — Next.js demo',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NightshiftProvider>{children}</NightshiftProvider>
      </body>
    </html>
  );
}
