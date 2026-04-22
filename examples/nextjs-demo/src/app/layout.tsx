import type { Metadata } from 'next';
import { BackshiftProvider } from '../components/BackshiftProvider';

export const metadata: Metadata = {
  title: 'Backshift Demo',
  description: 'Zero-overhead telemetry gateway — Next.js demo',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <BackshiftProvider>{children}</BackshiftProvider>
      </body>
    </html>
  );
}
