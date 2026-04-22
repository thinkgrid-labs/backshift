import { TrackButton } from '../components/TrackButton';
import { IdentifyForm } from '../components/IdentifyForm';
import { ErrorDemo } from '../components/ErrorDemo';

export default function Home() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '48px 24px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <header style={{ marginBottom: 48 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>
          Backshift Demo
        </h1>
        <p style={{ color: '#6b7280', fontSize: 16, lineHeight: 1.6 }}>
          All events below are tracked via{' '}
          <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>
            navigator.sendBeacon()
          </code>{' '}
          — zero main-thread blocking, no third-party scripts.
        </p>
      </header>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Track Events</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <TrackButton
            event="Button_Clicked"
            properties={{ buttonName: 'Add to Cart', page: 'demo' }}
            label="Add to Cart"
            variant="primary"
          />
          <TrackButton
            event="Checkout_Started"
            properties={{ cartValue: 149.99, currency: 'USD', itemCount: 3 }}
            label="Start Checkout"
            variant="secondary"
          />
          <TrackButton
            event="Feature_Used"
            properties={{ feature: 'darkMode', enabled: true }}
            label="Toggle Feature"
            variant="secondary"
          />
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Identify User</h2>
        <IdentifyForm />
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Error Tracking</h2>
        <ErrorDemo />
      </section>

      <footer
        style={{
          marginTop: 64,
          paddingTop: 24,
          borderTop: '1px solid #e5e7eb',
          color: '#9ca3af',
          fontSize: 14,
        }}
      >
        Open DevTools → Network → filter by{' '}
        <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>
          /ingest
        </code>{' '}
        to watch events fire in real time.
      </footer>
    </main>
  );
}
