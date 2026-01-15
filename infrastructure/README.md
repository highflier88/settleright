# Settleright.ai Infrastructure

## Overview

Settleright.ai is deployed on **Vercel** with managed services for database, caching, and storage. This document covers the infrastructure setup, deployment process, and operational procedures.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VERCEL PLATFORM                                 │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         EDGE NETWORK (CDN)                           │   │
│  │                    Global distribution, SSL/TLS                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         SERVERLESS FUNCTIONS                         │   │
│  │                                                                       │   │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐    │   │
│  │   │  Next.js    │  │   API       │  │      Cron Jobs          │    │   │
│  │   │   Pages     │  │   Routes    │  │  (Scheduled Functions)  │    │   │
│  │   └─────────────┘  └─────────────┘  └─────────────────────────┘    │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│         ┌──────────────────────────┼──────────────────────────┐             │
│         ▼                          ▼                          ▼             │
│  ┌─────────────┐          ┌─────────────┐          ┌─────────────┐         │
│  │   Vercel    │          │   Vercel    │          │   Vercel    │         │
│  │  Postgres   │          │     KV      │          │    Blob     │         │
│  │ (Database)  │          │   (Redis)   │          │  (Storage)  │         │
│  └─────────────┘          └─────────────┘          └─────────────┘         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL SERVICES                                   │
│   Clerk │ Stripe │ SendGrid │ Twilio │ Anthropic │ Pinecone │ Sentry       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Environments

| Environment | Branch | URL | Purpose |
|-------------|--------|-----|---------|
| **Production** | `main` | `settleright.ai` | Live platform |
| **Staging** | `develop` | `staging.settleright.ai` | Pre-production testing |
| **Preview** | PR branches | `*.vercel.app` | PR review and testing |
| **Development** | Local | `localhost:3000` | Local development |

---

## Vercel Services

### Vercel Postgres

**Purpose:** Primary relational database for all application data.

**Specifications:**
- PostgreSQL 16 compatible
- Automatic connection pooling
- Point-in-time recovery (7 days)
- Automatic backups

**Connection:**
```typescript
// Uses Prisma with connection pooling
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});
```

**Alternatives:**
- [Neon](https://neon.tech) - Serverless Postgres with branching
- [Supabase](https://supabase.com) - Postgres with additional features
- [PlanetScale](https://planetscale.com) - MySQL with branching (if MySQL preferred)

### Vercel KV

**Purpose:** Redis-compatible key-value store for caching and sessions.

**Use Cases:**
- Session storage
- Rate limiting counters
- Cache frequently accessed data
- Real-time features (pub/sub)

**Connection:**
```typescript
import { kv } from '@vercel/kv';

// Set value
await kv.set('key', 'value', { ex: 3600 });

// Get value
const value = await kv.get('key');
```

### Vercel Blob

**Purpose:** Object storage for user-uploaded files.

**Use Cases:**
- Evidence documents (PDF, images, video)
- Signed agreements
- Generated awards
- User profile photos

**Connection:**
```typescript
import { put, del } from '@vercel/blob';

// Upload file
const blob = await put('evidence/case-123/doc.pdf', file, {
  access: 'public',
  addRandomSuffix: true,
});

// Delete file
await del(blob.url);
```

**Security:**
- All blobs are private by default
- Use signed URLs for temporary access
- Set appropriate cache headers

---

## Domain Configuration

### Production Domain

1. Add domain in Vercel Dashboard → Project → Settings → Domains
2. Add DNS records:
   ```
   Type    Name    Value
   A       @       76.76.21.21
   CNAME   www     cname.vercel-dns.com
   ```
3. SSL certificate is automatically provisioned

### Staging Domain

1. Add `staging.settleright.ai` as a domain
2. Assign to `develop` branch in domain settings
3. Configure same DNS as above for subdomain

---

## Deployment Process

### Automatic Deployments

| Trigger | Environment | Action |
|---------|-------------|--------|
| Push to `main` | Production | Full deployment |
| Push to `develop` | Staging | Full deployment |
| Open/Update PR | Preview | Preview deployment |

### Manual Deployment

```bash
# Install Vercel CLI
pnpm add -g vercel

# Login
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Deployment Pipeline

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│   Push   │───▶│   Lint   │───▶│   Test   │───▶│  Build   │───▶│  Deploy  │
│          │    │ & Types  │    │          │    │          │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                                      │
                                                                      ▼
                                                               ┌──────────┐
                                                               │  Verify  │
                                                               │  Health  │
                                                               └──────────┘
```

---

## Environment Variables

### Setting Variables

1. **Vercel Dashboard:** Project → Settings → Environment Variables
2. **CLI:** `vercel env add VARIABLE_NAME`
3. **Pull to local:** `vercel env pull .env.local`

### Variable Scopes

| Scope | Description |
|-------|-------------|
| Production | Only available in production deployments |
| Preview | Available in preview deployments |
| Development | Available when running `vercel dev` |

### Required Variables

See `.env.example` for the full list. Key variables:

| Variable | Required For |
|----------|--------------|
| `DATABASE_URL` | Database connection |
| `CLERK_SECRET_KEY` | Authentication |
| `STRIPE_SECRET_KEY` | Payments |
| `ANTHROPIC_API_KEY` | AI analysis |
| `SENDGRID_API_KEY` | Email notifications |

---

## Cron Jobs

Vercel Cron Jobs run serverless functions on a schedule.

### Configured Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| `/api/cron/check-deadlines` | Every 6 hours | Check case deadlines, trigger reminders |
| `/api/cron/send-reminders` | Daily 9 AM | Send deadline reminder emails |
| `/api/cron/expire-invitations` | Daily midnight | Mark expired invitations |
| `/api/cron/cleanup-sessions` | Daily 3 AM | Clean up expired sessions |

### Configuration

Defined in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/check-deadlines",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

### Security

Cron endpoints are protected with a secret:
```typescript
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... cron logic
}
```

---

## Monitoring

### Vercel Analytics

Automatically tracks:
- Page views and unique visitors
- Web Vitals (LCP, FID, CLS)
- Geographic distribution
- Device and browser breakdown

### Vercel Speed Insights

Real User Monitoring (RUM) for:
- Time to First Byte (TTFB)
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Cumulative Layout Shift (CLS)

### Sentry Integration

Error tracking and performance monitoring:
- Automatic error capture
- Source map upload
- Release tracking
- Performance tracing

### Log Drains

Configure log drains for external logging:
1. Vercel Dashboard → Project → Settings → Log Drains
2. Add drain for DataDog, Logflare, or other providers

---

## Scaling

### Automatic Scaling

Vercel automatically scales:
- Serverless functions scale to demand
- Edge network handles traffic globally
- No manual intervention required

### Limits

| Resource | Limit (Pro) |
|----------|-------------|
| Serverless Function Duration | 60s (default), 300s (configured) |
| Edge Function Duration | 30s |
| Serverless Function Size | 50 MB |
| Bandwidth | 1 TB/month |
| Builds | Unlimited |

### Optimization Tips

1. **Use Edge Runtime** for lightweight operations
2. **Enable ISR** for frequently accessed pages
3. **Optimize images** with `next/image`
4. **Cache API responses** in Vercel KV
5. **Use streaming** for long-running AI operations

---

## Disaster Recovery

### Database Backups

Vercel Postgres:
- Automatic daily backups
- 7-day point-in-time recovery
- Export: Use `pg_dump` with connection string

### Blob Storage

Vercel Blob:
- Stored redundantly across regions
- No automatic backups - implement your own if needed

### Recovery Procedures

1. **Database corruption:**
   - Restore from Vercel Postgres backup
   - Or use point-in-time recovery

2. **Deployment issues:**
   - Rollback to previous deployment in Vercel Dashboard
   - Or use `vercel rollback` CLI command

3. **Configuration issues:**
   - Environment variables are versioned with deployments
   - Rollback deployment to restore previous config

---

## Security

### SSL/TLS

- Automatic SSL certificates via Let's Encrypt
- TLS 1.3 enforced
- HSTS enabled

### DDoS Protection

- Built-in Vercel DDoS protection
- Rate limiting at edge
- Bot protection available

### Access Control

- Team-based access in Vercel Dashboard
- SSO available on Enterprise plan
- Audit logs for team actions

### Security Headers

Configured in `vercel.json` and `next.config.js`:
- Content Security Policy
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy

---

## Cost Estimation

### Vercel Pro Plan (~$20/user/month)

| Feature | Included |
|---------|----------|
| Bandwidth | 1 TB |
| Serverless Function Execution | 1000 GB-hours |
| Edge Function Execution | Unlimited |
| Builds | Unlimited |
| Preview Deployments | Unlimited |

### Additional Services

| Service | Estimated Cost |
|---------|----------------|
| Vercel Postgres | $0.10/GB storage + $0.10/M reads |
| Vercel KV | $0.50/M commands |
| Vercel Blob | $0.15/GB storage |

### External Services (Monthly Estimates)

| Service | Tier | Est. Cost |
|---------|------|-----------|
| Clerk | Pro | $25+ |
| Stripe | Pay as you go | 2.9% + $0.30/txn |
| SendGrid | Essentials | $19.95 (50K emails) |
| Twilio | Pay as you go | ~$0.0075/SMS |
| Anthropic Claude | Pay as you go | ~$15/M input tokens |
| Pinecone | Starter | Free, then $70+ |
| Sentry | Team | $26/month |

**Total Estimated Monthly Cost (Startup):** $200-500

---

## Troubleshooting

### Common Issues

**Build Failures:**
```bash
# Check build logs in Vercel Dashboard
# Or run locally:
pnpm build
```

**Function Timeouts:**
- Check function duration in vercel.json
- Optimize database queries
- Use background jobs for long operations

**Database Connection Issues:**
- Verify DATABASE_URL is set
- Check connection pooling settings
- Ensure Prisma client is generated

### Support Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Support](https://vercel.com/support)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
