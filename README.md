# Backshift

> **Early Development Notice**
> This project is a work in progress and has not been tested in production. APIs, configuration, and adapter behaviour may change without notice. Use for exploration and feedback — not for production workloads yet.

**The zero-overhead telemetry gateway for modern web applications.**

> Your frontend works the day shift. Backshift handles the rest.

---

## The Problem

Modern web apps need analytics. But every analytics SDK you install is a direct tax on your users' experience — and on your users' privacy.

### The pain today

**1. Every SDK ships its own runtime to the browser.**

| SDK | Size | Blocks Main Thread? |
|---|---|---|
| Google Tag Manager | ~100kb | Yes |
| Mixpanel | ~70kb | Yes |
| Sentry Browser | ~50kb | Yes |
| FullStory | ~30kb | Yes |
| **@backshift/client** | **< 2kb** | **Never** |

These scripts download, parse, and execute on the same thread React uses to render your UI. They directly inflate your **LCP**, **TBT**, and **INP** — the Core Web Vitals that determine your Google search ranking and your users' first impression.

**2. Your API keys live in the browser.**

Every vendor SDK you load exposes your Mixpanel token, your GA4 Measurement ID, your PostHog key — in plain sight in your JS bundle. Anyone can scrape them, replay events, or flood your analytics with fake data.

**3. Your users' data flows directly to vendor servers.**

Raw IP addresses, emails accidentally passed in properties, user agents — all of it travels from your user's browser to GA4, Mixpanel, Sentry, and however many other vendors you've added this quarter. You have no control over what leaves.

**4. Ad-blockers kill your data.**

uBlock Origin, Privacy Badger, and browser-level tracking prevention block requests to known analytics domains. A meaningful fraction of your users — often your most technical ones — are invisible in your dashboards.

**5. Stack fragmentation gets worse as you scale.**

You add GA4 for marketing. Mixpanel for product. Sentry for errors. Amplitude for growth. Each one adds its own SDK, its own cookie, its own network request pattern, its own privacy footprint. There's no single place to audit what data is leaving your app.

---

### Existing approaches — and why they still fall short

**Google Tag Manager / other tag managers**
Load vendor scripts dynamically, but the scripts still run on the main thread and still phone home to vendor servers directly. You've added an abstraction layer, not solved the problem.

**Segment / RudderStack**
A server-side CDP gives you a single integration point, but you still need a vendor JS SDK in the browser to capture events (`analytics.js` is ~70kb), and you're adding another SaaS layer with its own pricing, data retention terms, and privacy surface.

**Rolling your own proxy**
Some teams build a thin API route to forward events. It works, but you end up hand-rolling PII sanitization, dedup, retry logic, geo enrichment, and adapter-specific payload translation for every vendor — over and over.

---

## How Backshift aims to solve this

The core idea: **vendor SDKs are the problem, so don't run them in the browser at all.** Instead, a tiny client fires a single beacon to your own subdomain. An edge worker — running in Rust, on infrastructure you control — translates that event into every vendor's format and fans it out server-to-server.

```
Browser                    Edge                    Vendors
───────                    ────                    ───────
@backshift/client         backshift-edge         GA4
  <2kb gzipped             (Rust / WASM)           Mixpanel
  sendBeacon() ──────────► /ingest ──────────────► PostHog
  zero blocking            ↓                       Sentry
                           PII sanitize            Amplitude
                           Dedup                   Segment
                           Enrich (IP, UA, geo)    Facebook CAPI
                           Fan-out (parallel)      TikTok
                           Retry on failure        Webhook
```

**The client** (`@backshift/client`, <2kb gzipped) is a typed TypeScript SDK. It batches events, captures UTM params and referrer automatically, and fires them via `navigator.sendBeacon()` — a non-blocking browser API designed exactly for this. No vendor SDK ever loads in the browser. No API keys exposed. No third-party domains contacted.

**The edge worker** runs on a first-party subdomain (e.g. `telemetry.yourdomain.com`). It enriches events with IP-derived geo data, strips PII before any vendor sees it, deduplicates beacon retries, and fans out to every configured vendor in parallel — with exponential backoff retry on transient failures. All in Rust, with no cold-start penalty on Cloudflare Workers.

---

## Features

- **< 2kb gzipped** TypeScript SDK — strict generic types, zero runtime dependencies
- **`navigator.sendBeacon()`** transport — zero main-thread blocking, designed to survive tab close
- **Auto-capture** — UTM params, referrer, page title, and viewport collected on every event without configuration
- **Auto-pageview** — opt-in `Page_Viewed` tracking that works with SPA navigation (patches `history.pushState`)
- **Smart batching** — flushes on 5s timer, 20-event queue, or tab close
- **PII sanitization** — emails and API tokens stripped from all event fields before fan-out
- **Dedup** — per-request in-memory dedup; persistent cross-request dedup via Cloudflare KV when bound
- **Retry with backoff** — transient vendor failures (5xx, network errors, 429) retried up to 3× with exponential backoff; 4xx failures dropped immediately
- **Ad-blocker bypass** — runs on your own subdomain, not a third-party analytics domain
- **GDPR/CCPA ready** — IP addresses used only for geo enrichment then stripped before any vendor receives the event
- **Offline resilience** — IndexedDB queue for mobile users losing connectivity; drained on next init
- **Multi-platform** — deploys to Cloudflare Workers (recommended), standalone Axum server, or Docker

### Supported Adapters

| Adapter | Events | Status |
|---|---|---|
| Google Analytics 4 | track, error | ✅ |
| Sentry | error (Envelope API) | ✅ |
| Mixpanel | track, identify, error | ✅ |
| PostHog | track, identify, error | ✅ |
| Webhook | all (generic JSON POST) | ✅ |
| Amplitude | track, identify, error | ✅ |
| Segment | track, identify, error | ✅ |
| Facebook Conversions API | track, error | ✅ |
| TikTok Events API | track, error | ✅ |
| FullStory | identify, custom events¹ | Planned |

¹ FullStory's session replay requires its browser SDK to run in-page (DOM capture can't be proxied). The Backshift FullStory adapter covers the server-side portion: forwarding `identify` calls to the [FullStory Identity API](https://developer.fullstory.com/server/v2/users/set-user-properties/) and custom events to the [Events API](https://developer.fullstory.com/server/v2/events/create-events/) for cross-device user stitching.

---

## Quick Start

### 1. Add the client SDK

```bash
npm install @backshift/client
```

```tsx
// app/providers.tsx (Next.js App Router)
'use client';
import { useEffect } from 'react';
import { Backshift } from '@backshift/client';

export function BackshiftProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    Backshift.init({
      endpoint: 'https://telemetry.yourdomain.com/ingest',
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION,
    });
  }, []);
  return <>{children}</>;
}
```

```tsx
// Anywhere in your app
import { Backshift } from '@backshift/client';

Backshift.track('Checkout_Started', { cartValue: 150, currency: 'USD' });
Backshift.identify('user_123', { plan: 'premium' });
Backshift.error(new Error('Payment gateway timeout'));
```

**Type-safe event schemas** — define your event map once:

```typescript
type MyEvents = {
  Checkout_Started: { cartValue: number; currency: string };
  Button_Clicked: { buttonName: string };
};

const client = Backshift.init<MyEvents>({ endpoint: '...' });
client.track('Checkout_Started', { cartValue: 150, currency: 'USD' }); // ✅
client.track('Unknown_Event', {});                                      // ❌ type error
client.track('Checkout_Started', { cartValue: 'oops' });               // ❌ type error
```

### 2. Deploy the edge worker

**Option A: Cloudflare Workers** (recommended)

```bash
cd crates/backshift-worker
npx wrangler secret put GA4_MEASUREMENT_ID
npx wrangler secret put GA4_API_SECRET
npx wrangler secret put SENTRY_DSN
npx wrangler secret put MIXPANEL_TOKEN
npx wrangler secret put POSTHOG_API_KEY
npx wrangler deploy
```

**Option B: Standalone Axum server** (Docker / VPS)

```bash
cargo build -p backshift-server --release

GA4_MEASUREMENT_ID=G-XXXXXXXX \
GA4_API_SECRET=your_secret \
SENTRY_DSN=https://key@o123.ingest.sentry.io/456 \
MIXPANEL_TOKEN=your_token \
POSTHOG_API_KEY=phc_your_key \
./target/release/backshift-server
```

**Option C: Local development**

```bash
cargo run -p backshift-server
# Server starts on http://localhost:8080

# Point your client at it:
NEXT_PUBLIC_BACKSHIFT_ENDPOINT=http://localhost:8080/ingest
```

---

## Environment Variables

| Variable | Description | Required For |
|---|---|---|
| `GA4_MEASUREMENT_ID` | GA4 Measurement ID (G-XXXXXXXX) | GA4 adapter |
| `GA4_API_SECRET` | GA4 Measurement Protocol API Secret | GA4 adapter |
| `SENTRY_DSN` | Sentry DSN | Sentry adapter |
| `SENTRY_RELEASE` | Release version tag | Sentry (optional) |
| `SENTRY_ENVIRONMENT` | e.g. `production` | Sentry (optional) |
| `MIXPANEL_TOKEN` | Mixpanel Project Token | Mixpanel adapter |
| `POSTHOG_API_KEY` | PostHog API Key (phc_...) | PostHog adapter |
| `POSTHOG_ENDPOINT` | Self-hosted PostHog URL | PostHog (optional) |
| `WEBHOOK_URL` | Generic webhook endpoint | Webhook adapter |
| `WEBHOOK_SECRET` | Value for X-Webhook-Secret header | Webhook (optional) |
| `PORT` | HTTP port (default: 8080) | Server only |
| `DEDUP_TTL_SECS` | Dedup window in seconds (default: 30) | All targets |

---

## Architecture

### Repository Structure

```
backshift/
├── packages/
│   ├── schema/     # @backshift/schema — canonical JSON Schema + TypeScript types
│   └── client/     # @backshift/client — <2kb TypeScript SDK
├── crates/
│   ├── backshift-core/      # Rust types, PII sanitizer, dedup cache
│   ├── backshift-adapters/  # GA4, Sentry, Mixpanel, PostHog, Webhook adapters
│   ├── backshift-server/    # Standalone Axum HTTP server
│   ├── backshift-worker/    # Cloudflare Workers target (worker-rs)
│   └── backshift-vercel/    # Vercel Edge Functions target (WASM)
└── examples/
    └── nextjs-demo/          # Next.js 15 App Router demo
```

### Event Schema

All events share a single canonical schema defined in `packages/schema/src/event.schema.json`. TypeScript types are generated from this schema. Rust serde structs mirror it exactly, with a roundtrip fixture test enforcing parity.

```json
{
  "batch": [{
    "type": "track | identify | error",
    "event": "Checkout_Started",
    "properties": { "cartValue": 150 },
    "context": {
      "viewport": "390x844",
      "url": "/checkout",
      "sessionId": "anon_abc123",
      "appVersion": "v1.2.0",
      "timestamp": 1700000000000
    }
  }]
}
```

### Security Model

- **Secrets never touch the browser.** All vendor API keys live in edge environment variables.
- **PII is stripped before fan-out.** Emails and token patterns are redacted by regex in `backshift-core/pii.rs` before any adapter receives the event.
- **IP addresses are stripped.** Client IPs are enriched server-side for geo-lookup and then removed before vendor fan-out.
- **First-party domain.** Deploy on `telemetry.yourdomain.com` — ad-blockers only block known third-party analytics domains.

---

## Development

```bash
# Install dependencies
pnpm install

# Run all Rust tests
cargo test -p backshift-core -p backshift-adapters -p backshift-server

# Run TypeScript tests
pnpm --filter @backshift/client test

# Build everything
pnpm build

# Start local demo
cargo run -p backshift-server &
pnpm --filter nextjs-demo dev
# Open http://localhost:3000
```

---

## Contributing

Adapters are the most impactful contribution. See `crates/backshift-adapters/src/adapter.rs` for the `Adapter` trait — implementing a new vendor is ~80 lines of Rust.

Planned: Plausible, FullStory (server-side identify + custom events only — session replay requires in-browser DOM capture and cannot be proxied).

---

## License

MIT
