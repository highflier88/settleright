# Settleright.ai Technology Stack

## Overview

This document defines the technology choices for the Settleright.ai platform. These decisions are based on requirements for security, scalability, compliance, and developer productivity.

---

## Stack Summary

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend** | Next.js | 14.x |
| **UI Framework** | React | 18.x |
| **Language** | TypeScript | 5.x |
| **Styling** | Tailwind CSS | 3.x |
| **Backend** | Next.js API Routes + Server Actions | 14.x |
| **Database** | Vercel Postgres (PostgreSQL) | 16.x |
| **ORM** | Prisma | 5.x |
| **Cache** | Vercel KV (Redis) | 7.x |
| **File Storage** | Vercel Blob | - |
| **Vector Database** | Pinecone | - |
| **Authentication** | Clerk | - |
| **Payments** | Stripe | - |
| **Email** | SendGrid | - |
| **SMS** | Twilio | - |
| **KYC** | Stripe Identity | - |
| **AI/LLM** | Anthropic Claude API | claude-3-opus/sonnet |
| **Infrastructure** | Vercel (Serverless) | - |
| **CI/CD** | GitHub Actions + Vercel | - |
| **Monitoring** | Vercel Analytics + Speed Insights | - |
| **Error Tracking** | Sentry | - |

---

## Frontend

### Next.js 14

**Rationale:**
- Server-side rendering for SEO and performance
- App Router for modern React patterns
- API routes for lightweight backend functions
- Excellent TypeScript support
- Built-in optimization (images, fonts, scripts)
- Middleware for auth/routing logic

**Configuration:**
```javascript
// next.config.js
module.exports = {
  reactStrictMode: true,
  images: {
    domains: ['settleright-assets.s3.amazonaws.com'],
  },
  experimental: {
    serverActions: true,
  },
}
```

### React 18

**Rationale:**
- Industry standard for component-based UIs
- Concurrent features for better UX
- Suspense for data fetching
- Large ecosystem of libraries

### TypeScript 5

**Rationale:**
- Type safety reduces runtime errors
- Better IDE support and autocomplete
- Self-documenting code
- Essential for large codebases

**Configuration:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Tailwind CSS 3

**Rationale:**
- Utility-first approach for rapid development
- Consistent design system
- Small production bundle (purged unused styles)
- Excellent responsive design support

### UI Component Libraries

| Library | Purpose |
|---------|---------|
| **shadcn/ui** | Base component library (Radix primitives) |
| **Radix UI** | Accessible, unstyled primitives |
| **Lucide React** | Icon library |
| **React Hook Form** | Form handling |
| **Zod** | Schema validation |
| **TanStack Query** | Data fetching and caching |
| **date-fns** | Date manipulation |

---

## Backend

### Next.js API Routes + Server Actions

**Rationale:**
- Unified codebase (frontend + backend in one project)
- Serverless architecture - scales automatically
- Server Actions for mutations (forms, data updates)
- API Routes for REST endpoints and webhooks
- Edge Runtime support for low-latency operations
- Built-in TypeScript support

**Alternative Considered:** Separate Express/FastAPI backend
- Pros: More traditional architecture, easier to scale independently
- Cons: Additional complexity, separate deployment, more infrastructure
- Decision: Next.js API routes for simplicity and Vercel integration

### Project Structure

```
/src
├── /app
│   ├── /api                    # API Routes
│   │   ├── /v1
│   │   │   ├── /users          # User endpoints
│   │   │   ├── /cases          # Case endpoints
│   │   │   ├── /evidence       # Evidence endpoints
│   │   │   └── /arbitration    # Arbitration endpoints
│   │   ├── /webhooks           # External service webhooks
│   │   │   ├── /clerk          # Clerk auth webhooks
│   │   │   ├── /stripe         # Stripe payment webhooks
│   │   │   └── /sendgrid       # Email status webhooks
│   │   └── /cron               # Scheduled jobs
│   ├── /(auth)                 # Auth pages (login, signup)
│   ├── /(dashboard)            # Authenticated pages
│   └── /(marketing)            # Public pages
├── /lib
│   ├── /actions                # Server Actions
│   ├── /services               # Business logic
│   ├── /db                     # Database utilities
│   └── /utils                  # Shared utilities
├── /components                 # React components
└── /types                      # TypeScript types
```

### Key Dependencies

```json
{
  "dependencies": {
    "next": "^14.x",
    "@prisma/client": "^5.x",
    "@vercel/postgres": "^0.x",
    "@vercel/kv": "^0.x",
    "@vercel/blob": "^0.x",
    "@clerk/nextjs": "^4.x",
    "stripe": "^14.x",
    "@sendgrid/mail": "^8.x",
    "twilio": "^4.x",
    "@anthropic-ai/sdk": "^0.x",
    "zod": "^3.x",
    "pdf-lib": "^1.x",
    "@sentry/nextjs": "^7.x"
  }
}
```

---

## Database

### Vercel Postgres (PostgreSQL 16)

**Rationale:**
- ACID compliance for financial/legal data
- Excellent JSON support for flexible schemas
- Full-text search capabilities
- Serverless-friendly connection pooling
- Proven reliability and performance
- Required for audit trail integrity

**Configuration:**
- Automatic connection pooling (built-in)
- Point-in-time recovery (7 days)
- Automatic daily backups
- Encrypted at rest

**Alternatives:**
- [Neon](https://neon.tech) - Serverless Postgres with database branching
- [Supabase](https://supabase.com) - Postgres with additional features (auth, storage)

### Prisma ORM

**Rationale:**
- Type-safe database access
- Automatic migrations
- Intuitive query API
- Excellent TypeScript integration
- Schema as source of truth

**Alternative Considered:** Drizzle ORM
- Pros: Lighter weight, SQL-like syntax
- Cons: Less mature, smaller community
- Decision: Prisma for maturity and tooling

---

## Caching

### Vercel KV (Redis-compatible)

**Rationale:**
- In-memory speed for session management
- Serverless-friendly (no connection management)
- Rate limiting storage
- Caching frequently accessed data
- Redis-compatible API

**Use Cases:**
| Use Case | TTL |
|----------|-----|
| Session tokens | 24 hours |
| Rate limit counters | 1 minute |
| Case summary cache | 5 minutes |
| User profile cache | 15 minutes |

**Usage:**
```typescript
import { kv } from '@vercel/kv';

// Set with expiration
await kv.set('user:123:profile', userData, { ex: 900 });

// Get value
const profile = await kv.get('user:123:profile');
```

---

## File Storage

### Vercel Blob

**Rationale:**
- Serverless object storage
- Simple SDK integration
- Automatic CDN distribution
- No bucket configuration required
- Encryption in transit

**Path Structure:**
```
evidence/
├── cases/
│   └── {case_id}/
│       ├── claimant/
│       │   └── {evidence_id}.pdf
│       └── respondent/
│           └── {evidence_id}.pdf
├── agreements/
│   └── {agreement_id}.pdf
├── awards/
│   └── {award_id}.pdf
└── identity/
    └── {user_id}/
        └── {verification_id}.jpg
```

**Usage:**
```typescript
import { put, del, list } from '@vercel/blob';

// Upload file
const blob = await put(`evidence/cases/${caseId}/${filename}`, file, {
  access: 'public', // or 'private' for signed URLs
});

// Delete file
await del(blob.url);
```

**Security:**
- Private buckets (no public access)
- Pre-signed URLs with expiration (15 minutes)
- Separate buckets per environment
- Encryption: AES-256 (SSE-S3)

---

## Vector Database

### Pinecone

**Rationale:**
- Purpose-built for vector similarity search
- Managed service (no operations overhead)
- Low latency queries
- Scales horizontally
- Metadata filtering

**Use Cases:**
- Legal case law retrieval (RAG)
- Statute and regulation search
- Similar case matching

**Alternative Considered:** Weaviate, pgvector
- Pinecone chosen for managed simplicity and performance

---

## Authentication

### Clerk

**Rationale:**
- Complete auth solution (signup, login, MFA, SSO)
- Pre-built UI components
- Session management
- User management dashboard
- Webhook support
- SOC 2 Type II certified

**Features Used:**
- Email/password authentication
- Multi-factor authentication (TOTP)
- Session tokens (JWT)
- Organization management (for B2B)
- Webhooks for user events

**Alternative Considered:** Auth0
- Both excellent; Clerk chosen for developer experience

---

## Payments

### Stripe

**Rationale:**
- Industry-leading payment processor
- Strong API and documentation
- Built-in fraud prevention
- Support for multiple payment methods
- Connect for arbitrator payouts
- Invoicing capabilities

**Features Used:**
- Checkout Sessions (filing fees)
- Payment Intents (custom flows)
- Stripe Connect (arbitrator payments)
- Webhooks (payment status)
- Stripe Identity (KYC)

---

## Communication

### SendGrid (Email)

**Rationale:**
- High deliverability
- Transactional email API
- Template management
- Delivery tracking
- DKIM/SPF support

**Email Types:**
| Template | Trigger |
|----------|---------|
| Welcome | Account creation |
| Case Invitation | Claimant invites respondent |
| Evidence Notification | New evidence uploaded |
| Deadline Reminder | Approaching deadline |
| Award Issued | Arbitration complete |

### Twilio (SMS)

**Rationale:**
- Global SMS coverage
- Programmable messaging API
- Delivery status callbacks
- Phone verification

**SMS Types:**
- Case invitation (with link)
- Deadline reminders
- Award notification

---

## AI/LLM

### Anthropic Claude API

**Rationale:**
- State-of-the-art reasoning capabilities
- Long context window (200k tokens)
- Strong instruction following
- Constitutional AI (safety)
- Excellent for legal analysis

**Models Used:**
| Model | Use Case |
|-------|----------|
| claude-3-opus | Complex legal analysis, award generation |
| claude-3-sonnet | Document summarization, entity extraction |
| claude-3-haiku | Classification, quick tasks |

**Integration Pattern:**
```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const response = await anthropic.messages.create({
  model: 'claude-3-opus-20240229',
  max_tokens: 4096,
  system: LEGAL_ANALYSIS_SYSTEM_PROMPT,
  messages: [{ role: 'user', content: caseContext }],
});
```

---

## Infrastructure

### Vercel Platform

| Service | Purpose |
|---------|---------|
| **Vercel Serverless** | Application hosting (auto-scaling) |
| **Vercel Edge Network** | Global CDN, SSL/TLS |
| **Vercel Postgres** | Managed PostgreSQL database |
| **Vercel KV** | Managed Redis cache |
| **Vercel Blob** | Object storage |
| **Vercel Cron** | Scheduled jobs |
| **Vercel Analytics** | Web analytics |
| **Vercel Speed Insights** | Performance monitoring (RUM) |

### Environment Strategy

| Environment | Purpose | Infrastructure |
|-------------|---------|----------------|
| **Development** | Local development | Docker (Postgres, Redis) |
| **Preview** | PR review | Vercel Preview Deployments |
| **Staging** | Pre-production testing | Vercel (develop branch) |
| **Production** | Live service | Vercel (main branch) |

### Serverless Benefits

- **Auto-scaling:** Scales to zero when idle, scales up under load
- **No infrastructure management:** No servers, containers, or Kubernetes
- **Global distribution:** Edge network in 100+ locations
- **Cost-effective:** Pay only for what you use

---

## CI/CD

### GitHub Actions + Vercel

**Rationale:**
- Native GitHub and Vercel integration
- Automatic preview deployments on PRs
- Free for public repos, generous limits
- Environment secrets management

**Workflows:**
| Workflow | Trigger | Actions |
|----------|---------|---------|
| `ci.yml` | Push, PR | Lint, test, type-check, build |
| `preview.yml` | PR opened | Deploy preview, comment URL |
| `production.yml` | Push to `main` | Deploy production, health check |
| (Vercel built-in) | All pushes | Automatic deployment |

---

## Monitoring & Observability

### Vercel Analytics + Speed Insights

**Rationale:**
- Built-in web analytics
- Real User Monitoring (RUM)
- Core Web Vitals tracking
- No additional setup required

**Metrics:**
- Page views and unique visitors
- Time to First Byte (TTFB)
- Largest Contentful Paint (LCP)
- Cumulative Layout Shift (CLS)
- First Input Delay (FID)

### Sentry

**Rationale:**
- Exception tracking with context
- Source map support
- Release tracking
- Performance monitoring
- Issue grouping and trends

**Configuration:**
```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  integrations: [
    new Sentry.Integrations.Prisma({ client: prisma }),
  ],
});
```

---

## Security Tools

| Tool | Purpose |
|------|---------|
| **Helmet.js** | HTTP security headers |
| **express-rate-limit** | Rate limiting |
| **csurf** | CSRF protection |
| **express-validator / Zod** | Input validation |
| **bcrypt** | Password hashing (if needed) |
| **AWS WAF** | Web application firewall |
| **Snyk / Dependabot** | Dependency vulnerability scanning |

---

## Development Tools

| Tool | Purpose |
|------|---------|
| **ESLint** | JavaScript/TypeScript linting |
| **Prettier** | Code formatting |
| **Husky** | Git hooks |
| **lint-staged** | Run linters on staged files |
| **Jest** | Unit testing |
| **Playwright** | E2E testing |
| **Prisma Studio** | Database GUI |
| **Docker** | Local development containers |

---

## Package Managers

| Tool | Scope |
|------|-------|
| **pnpm** | Node.js packages (faster, efficient) |
| **Docker** | Container images |
| **Terraform** | Infrastructure as code |

---

## Version Requirements

```
Node.js: >=20.0.0
pnpm: >=8.0.0
PostgreSQL: >=16.0
Redis: >=7.0
Docker: >=24.0
```

---

## Decision Log

| Decision | Alternatives Considered | Rationale |
|----------|------------------------|-----------|
| Next.js over Remix | Remix, Astro | Larger ecosystem, better Next.js familiarity |
| Prisma over Drizzle | Drizzle, TypeORM, Knex | Maturity, type safety, migrations |
| Clerk over Auth0 | Auth0, Supabase Auth | Developer experience, pricing |
| Pinecone over pgvector | pgvector, Weaviate | Managed service, performance |
| Claude over GPT-4 | OpenAI GPT-4, Gemini | Reasoning quality, context length |
| AWS over GCP | GCP, Azure | Team familiarity, service breadth |
| pnpm over npm/yarn | npm, yarn | Speed, disk efficiency |
