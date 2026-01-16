# Settleright.ai - Developer Onboarding Guide

Welcome to the Settleright.ai codebase! This document will help you understand the architecture, patterns, and conventions used in this AI-powered binding arbitration platform.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Core Domain Models](#4-core-domain-models)
5. [Architectural Patterns](#5-architectural-patterns)
6. [Key Services](#6-key-services)
7. [API Routes](#7-api-routes)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [Core Workflows](#9-core-workflows)
10. [Development Setup](#10-development-setup)
11. [Testing](#11-testing)
12. [Common Tasks](#12-common-tasks)
13. [Key Files Reference](#13-key-files-reference)

---

## 1. Project Overview

Settleright.ai is an online dispute resolution (ODR) platform that provides legally binding arbitration for small claims ($500-$25,000). The platform:

- Allows claimants to initiate disputes and invite respondents
- Captures digital signatures on binding arbitration agreements
- Accepts evidence and statements from both parties
- Uses AI (Claude) to analyze facts, identify legal issues, and generate draft awards
- Enables human arbitrators to review, modify, and sign final awards
- Produces enforceable arbitration awards

### Development Status

| Phase   | Status      | Description                           |
| ------- | ----------- | ------------------------------------- |
| Phase 1 | ✅ Complete | Authentication, users, KYC            |
| Phase 2 | ✅ Complete | Case management, evidence, statements |
| Phase 3 | ✅ Complete | AI analysis engine, award generation  |
| Phase 4 | ✅ Complete | Arbitrator portal, human review       |
| Phase 5 | ✅ Complete | Compliance, enforcement, payments     |
| Phase 6 | ✅ Complete | Testing, QA, legal review setup       |

---

## 2. Technology Stack

### Frontend

| Technology      | Version | Purpose                      |
| --------------- | ------- | ---------------------------- |
| Next.js         | 14.2    | React framework (App Router) |
| React           | 18.3    | UI library                   |
| TypeScript      | 5.4     | Type safety                  |
| TailwindCSS     | 3.4     | Styling                      |
| Radix UI        | Latest  | Headless UI components       |
| React Hook Form | 7.51    | Form handling                |
| Zod             | 3.23    | Schema validation            |
| React Query     | 5.36    | Server state management      |

### Backend

| Technology         | Version | Purpose               |
| ------------------ | ------- | --------------------- |
| Next.js API Routes | 14.2    | API endpoints         |
| Prisma             | 5.14    | ORM / Database client |
| PostgreSQL         | -       | Primary database      |
| Vercel Blob        | -       | File storage          |
| Vercel KV          | -       | Redis cache           |

### External Services

| Service          | Purpose                            |
| ---------------- | ---------------------------------- |
| Clerk            | Authentication                     |
| Stripe           | Payments + KYC (Identity)          |
| SendGrid         | Transactional email                |
| Twilio           | SMS notifications                  |
| Anthropic Claude | AI analysis                        |
| Pinecone         | Vector database for legal research |
| Sentry           | Error tracking                     |

---

## 3. Project Structure

```
settleright/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Auth routes (sign-in, sign-up, onboarding)
│   │   ├── (dashboard)/       # Protected routes
│   │   │   ├── admin/         # Admin panel
│   │   │   ├── arbitrator/    # Arbitrator portal
│   │   │   └── dashboard/     # User dashboard
│   │   ├── api/               # API routes
│   │   │   ├── admin/         # Admin endpoints
│   │   │   ├── arbitrator/    # Arbitrator endpoints
│   │   │   ├── cases/         # Case management
│   │   │   ├── cron/          # Scheduled jobs
│   │   │   ├── user/          # User endpoints
│   │   │   └── webhooks/      # External webhooks
│   │   ├── invitation/        # Case invitation flow
│   │   └── legal/             # Legal document pages
│   │
│   ├── components/            # React components
│   │   ├── ui/               # Reusable UI primitives
│   │   ├── cases/            # Case-specific components
│   │   ├── forms/            # Form components
│   │   ├── layout/           # Layout components
│   │   └── providers/        # React context providers
│   │
│   ├── lib/                   # Core business logic
│   │   ├── services/         # Domain services
│   │   ├── analysis/         # AI fact analysis
│   │   ├── award/            # Award generation
│   │   ├── legal-analysis/   # Legal reasoning
│   │   ├── api/              # API utilities
│   │   ├── validations/      # Zod schemas
│   │   ├── storage/          # File storage
│   │   ├── payments/         # Stripe integration
│   │   ├── arbitrator/       # Arbitrator management
│   │   ├── compliance/       # Audit & compliance
│   │   ├── enforcement/      # Award enforcement
│   │   ├── signature/        # Digital signatures
│   │   └── qc/               # Quality control
│   │
│   ├── styles/               # Global styles
│   └── __tests__/            # Test files
│
├── prisma/
│   ├── schema.prisma         # Database schema
│   ├── migrations/           # Database migrations
│   └── seed.ts               # Seed data
│
├── e2e/                      # Playwright E2E tests
├── load-tests/               # k6 load tests
├── legal/                    # Legal document templates
├── docs/                     # Documentation
└── infrastructure/           # IaC configurations
```

---

## 4. Core Domain Models

### User & Identity

```
User
├── id, clerkId, email, name, phone
├── role: USER | ARBITRATOR | ADMIN
├── address: street, city, state, zip
├── KYC: IdentityVerification (VERIFIED, PENDING, FAILED)
└── For arbitrators: signingKeyPem, signingCertPem
```

### Case (Central Entity)

```
Case
├── referenceNumber: "ARB-2024-XXXXX"
├── status: DRAFT → PENDING_RESPONDENT → PENDING_AGREEMENT →
│           EVIDENCE_SUBMISSION → ANALYSIS_PENDING →
│           ANALYSIS_IN_PROGRESS → ARBITRATOR_REVIEW →
│           DECIDED → CLOSED
├── parties: claimantId, respondentId
├── content: description, amount, jurisdiction, disputeType
├── deadlines: responseDeadline, evidenceDeadline, rebuttalDeadline
└── relations: Invitation, Agreement, Evidence[], Statement[],
               AnalysisJob, DraftAward, Award
```

### Agreement & Signatures

```
Agreement
├── status: PENDING_CLAIMANT | PENDING_RESPONDENT | COMPLETE
├── documentUrl, documentHash
└── Signatures[] (one per party)

Signature
├── userId, role (CLAIMANT/RESPONDENT)
├── ipAddress, userAgent, deviceFingerprint
├── consentText, consentChecksum
└── signedAt (timestamp)
```

### Evidence & Statements

```
Evidence
├── fileName, fileType, fileSize, fileHash
├── storageKey (Vercel Blob URL)
├── processingStatus: PENDING → COMPLETED | FAILED
├── extractedText, summary, keyPoints
└── viewedByOpposingParty, viewedAt

Statement
├── type: INITIAL | REBUTTAL
├── content (rich text)
├── claimItems (JSON array)
└── submittedAt, version
```

### Award System

```
DraftAward (AI-generated)
├── findingsOfFact, conclusionsOfLaw (JSON)
├── decision, reasoning, awardAmount
├── confidence (0-1), modelUsed
└── reviewStatus: PENDING_REVIEW → APPROVED | MODIFIED | REJECTED

Award (Final, signed)
├── referenceNumber: "AWD-2024-XXXXX"
├── arbitratorId, signedAt
├── signatureValue, signatureCertificate (PKCS#7)
├── timestampToken (RFC 3161)
├── documentUrl, documentHash
└── claimantNotifiedAt, respondentNotifiedAt
```

---

## 5. Architectural Patterns

### API Route Pattern

All API routes use the `withAuth` middleware for consistent handling:

```typescript
// src/app/api/cases/route.ts
import { withAuth, AuthenticatedRequest } from '@/lib/api/with-auth';
import { successResponse, errorResponse } from '@/lib/api/response';

export const POST = withAuth(
  async (request: AuthenticatedRequest) => {
    const body = await request.json();
    // Business logic here
    return successResponse(data, 201);
  },
  {
    permissions: ['case:create'], // RBAC check
    rateLimit: 'api', // Rate limiting
    auditAction: AuditAction.CASE_CREATED, // Audit logging
  }
);
```

**What `withAuth` provides:**

- Authentication verification (via Clerk)
- RBAC permission checking
- Rate limiting (per IP)
- Automatic audit logging
- User context injection (`request.user`)
- Standardized error handling

### Service Pattern

Services in `/src/lib/services/` follow this structure:

```typescript
// Input/Output interfaces
export interface CreateCaseInput {
  description: string;
  amount: number;
  // ...
}

export interface CreateCaseResult {
  case: Case;
  invitation: Invitation;
}

// Main function with error handling
export async function createCase(
  input: CreateCaseInput
): Promise<CreateCaseResult> {
  // Validation
  // Business logic
  // Database operations
  // Audit logging
  return { case, invitation };
}
```

### Error Handling

Use custom error classes for consistent HTTP responses:

```typescript
import {
  BadRequestError, // 400
  UnauthorizedError, // 401
  ForbiddenError, // 403
  NotFoundError, // 404
  ConflictError, // 409
  ValidationError, // 422
  RateLimitError, // 429
  InternalServerError, // 500
} from '@/lib/api/errors';

// Usage
throw new NotFoundError('Case not found');
throw new ValidationError('Invalid input', { field: 'email', message: 'Required' });
```

### Database Access

Single Prisma instance via `/src/lib/db.ts`:

```typescript
import { prisma } from '@/lib/db';

// Always use transactions for multi-step operations
const result = await prisma.$transaction(async (tx) => {
  const case = await tx.case.create({ data: {...} });
  const invitation = await tx.invitation.create({ data: {...} });
  return { case, invitation };
});

// Soft deletes (don't use hard delete)
await prisma.case.update({
  where: { id },
  data: { deletedAt: new Date() }
});
```

---

## 6. Key Services

### Case Service (`/src/lib/services/case.ts`)

```typescript
createCase(input); // Create case + invitation
getCaseById(caseId); // Get single case
getCaseWithDetails(caseId); // Get with all relations
getUserCases(userId, options); // Paginated list
updateCaseStatus(caseId, status);
softDeleteCase(caseId);
userHasAccessToCase(userId, caseId);
calculateFilingFee(amount);
```

### Evidence Service (`/src/lib/services/evidence.ts`)

```typescript
uploadEvidence(input)          // Upload to Vercel Blob
getCaseEvidence(caseId, userId)
markEvidenceViewed(evidenceId, viewerId)
deleteEvidence(evidenceId, userId)
getEvidenceStats(caseId)

// Constants
ALLOWED_FILE_TYPES = ['application/pdf', 'image/*', ...]
MAX_FILE_SIZE = 25 * 1024 * 1024  // 25MB
MAX_FILES_PER_CASE = 50
```

### Agreement Service (`/src/lib/services/agreement.ts`)

```typescript
getAgreementForCase(caseId)
signAgreement(input)           // Capture signature
canSignAgreement(caseId, userId)
generateAgreementContent(case, claimant, respondent)
generateConsentText(role, caseRef)
```

### Audit Service (`/src/lib/services/audit.ts`)

```typescript
createAuditLog(entry);
verifyAuditLogIntegrity(); // SHA-256 chain verification
getAuditLogs(filters, pagination);
getCaseAuditLogs(caseId);
exportAuditLogs(filters, format);
```

### Notification Service (`/src/lib/services/notification-dispatcher.ts`)

```typescript
dispatchNotification({
  userId,
  type: NotificationType.CASE_INVITATION,
  channels: ['email', 'sms', 'inApp'],
  data: { ... }
})
```

---

## 7. API Routes

### Case Management

| Method | Route             | Description       |
| ------ | ----------------- | ----------------- |
| POST   | `/api/cases`      | Create new case   |
| GET    | `/api/cases`      | List user's cases |
| GET    | `/api/cases/[id]` | Get case details  |
| PATCH  | `/api/cases/[id]` | Update case       |
| DELETE | `/api/cases/[id]` | Soft delete case  |

### Evidence

| Method | Route                                   | Description     |
| ------ | --------------------------------------- | --------------- |
| POST   | `/api/cases/[id]/evidence`              | Upload evidence |
| GET    | `/api/cases/[id]/evidence`              | List evidence   |
| DELETE | `/api/cases/[id]/evidence/[evidenceId]` | Delete evidence |

### Agreement

| Method | Route                       | Description    |
| ------ | --------------------------- | -------------- |
| GET    | `/api/cases/[id]/agreement` | Get agreement  |
| POST   | `/api/cases/[id]/agreement` | Sign agreement |

### Awards

| Method | Route                            | Description         |
| ------ | -------------------------------- | ------------------- |
| POST   | `/api/cases/[id]/draft-award`    | Generate AI draft   |
| GET    | `/api/cases/[id]/draft-award`    | Get draft award     |
| PATCH  | `/api/cases/[id]/draft-award`    | Review/modify draft |
| POST   | `/api/cases/[id]/award`          | Issue final award   |
| GET    | `/api/cases/[id]/award/download` | Download PDF        |

### User

| Method | Route                       | Description      |
| ------ | --------------------------- | ---------------- |
| GET    | `/api/user/me`              | Get current user |
| POST   | `/api/user/profile`         | Update profile   |
| POST   | `/api/user/identity/start`  | Start KYC        |
| GET    | `/api/user/identity/status` | Check KYC status |

### Scheduled Jobs (Cron)

**Active cron jobs** (configured in `vercel.json`):

| Route                        | Schedule | Description                    |
| ---------------------------- | -------- | ------------------------------ |
| `/api/cron/check-deadlines`  | 6 AM UTC | Check and notify about deadlines |
| `/api/cron/send-reminders`   | 9 AM UTC | Send daily reminder notifications |

**Disabled cron jobs** (removed due to Vercel Hobby plan limit of 2 crons):

| Route                        | Previous Schedule | Description                    |
| ---------------------------- | ----------------- | ------------------------------ |
| `/api/cron/expire-invitations` | Midnight UTC    | Expire old case invitations    |
| `/api/cron/cleanup-sessions`   | 3 AM UTC        | Clean up expired sessions      |
| `/api/cron/check-expired-kyc`  | Midnight UTC    | Check for expired KYC verifications |

> **Note:** The disabled cron endpoints still exist and can be triggered manually or via an external scheduler (e.g., GitHub Actions, cron-job.org) if needed. Upgrade to Vercel Pro to re-enable all cron jobs.

---

## 8. Authentication & Authorization

### Authentication (Clerk)

```typescript
// Get authenticated user
import { getAuthUser, requireAuth } from '@/lib/auth';

const user = await getAuthUser(); // Returns null if not authenticated
const user = await requireAuth(); // Throws if not authenticated
```

### Authorization (RBAC)

Roles: `USER`, `ARBITRATOR`, `ADMIN`

```typescript
import { hasPermission, requirePermission } from '@/lib/rbac';

// Check permission
if (hasPermission(user.role, 'case:create')) {
  // allowed
}

// Require permission (throws ForbiddenError if denied)
requirePermission(user.role, 'arbitrator:sign');
```

**Key Permissions:**

- `case:create`, `case:read`, `case:update`, `case:delete`
- `evidence:upload`, `evidence:read`, `evidence:delete`
- `statement:submit`, `statement:read`
- `arbitrator:review`, `arbitrator:sign`, `arbitrator:assign`
- `admin:users`, `admin:cases`, `admin:audit`, `admin:payments`

---

## 9. Core Workflows

### Case Lifecycle

```
1. DRAFT
   └─ Claimant creates case, enters respondent email

2. PENDING_RESPONDENT
   └─ Email/SMS invitation sent
   └─ Respondent clicks link, creates account

3. PENDING_AGREEMENT
   └─ Both parties review & sign submission agreement
   └─ Digital signatures captured with IP, timestamp, device

4. EVIDENCE_SUBMISSION
   └─ 14-day window for evidence upload
   └─ Initial statements submitted
   └─ Documents processed (OCR, classification)

5. ANALYSIS_PENDING → ANALYSIS_IN_PROGRESS
   └─ AI analyzes facts, evidence, credibility
   └─ Legal analysis: issues, burden, damages
   └─ Draft award generated

6. ARBITRATOR_REVIEW
   └─ Human arbitrator assigned
   └─ Reviews AI draft, evidence, statements
   └─ Approves, modifies, rejects, or escalates

7. DECIDED
   └─ Final award digitally signed (PKCS#7 + RFC 3161)
   └─ Both parties notified

8. CLOSED
   └─ Case archived
```

### Award Generation Pipeline

```
Fact Analysis
├─ Extract facts from statements
├─ Parse claim items
├─ Compare disputed vs undisputed facts
├─ Build timeline
├─ Detect contradictions
└─ Assess credibility

Legal Analysis
├─ Classify legal issues
├─ Analyze burden of proof
├─ Calculate damages
└─ Generate conclusions of law

Draft Award
├─ Generate findings of fact
├─ Generate conclusions of law
├─ Determine prevailing party
├─ Calculate award amount
└─ Confidence scoring
```

---

## 10. Development Setup

### Prerequisites

- Node.js 20+
- PostgreSQL (or use Vercel Postgres)
- pnpm or npm

### Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
# Database
DATABASE_URL=postgresql://...

# Clerk (Auth)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Stripe (Payments)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# SendGrid (Email)
SENDGRID_API_KEY=SG...

# Twilio (SMS)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...

# Anthropic (AI)
ANTHROPIC_API_KEY=sk-ant-...

# Pinecone (Vector DB)
PINECONE_API_KEY=...
```

### Getting Started

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed database (optional)
npm run db:seed

# Start development server
npm run dev
```

### Useful Commands

```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run lint             # Run ESLint
npm run type-check       # TypeScript check
npm test                 # Run unit tests
npm run test:e2e         # Run E2E tests
npm run db:studio        # Open Prisma Studio
npm run db:push          # Push schema changes
```

---

## 11. Testing

### Test Structure

```
src/__tests__/
├── lib/
│   ├── services/        # Service unit tests
│   ├── analysis/        # AI analysis tests
│   ├── award/           # Award generation tests
│   └── ...
├── integration/
│   └── flows/           # Integration tests
├── contracts/           # API contract tests
└── factories/           # Test data factories
```

### Running Tests

```bash
npm test                           # All unit tests
npm test -- --watch               # Watch mode
npm test -- --coverage            # Coverage report
npm run test:e2e                  # Playwright E2E
npm run test:contracts            # Contract tests
npm run test:e2e:a11y             # Accessibility tests
```

### Writing Tests

```typescript
// Use factories for test data
import { createMockCase, createMockUser } from '../factories';

describe('CaseService', () => {
  it('should create a case', async () => {
    const user = createMockUser();
    const input = { description: 'Test', amount: 1000 };

    const result = await createCase(input);

    expect(result.case.status).toBe('DRAFT');
  });
});
```

---

## 12. Common Tasks

### Adding a New API Endpoint

1. Create route file: `src/app/api/[resource]/route.ts`
2. Use `withAuth` middleware
3. Add Zod validation schema
4. Add to audit actions if needed
5. Write tests

```typescript
// src/app/api/example/route.ts
import { withAuth } from '@/lib/api/with-auth';
import { successResponse } from '@/lib/api/response';
import { z } from 'zod';

const schema = z.object({ name: z.string() });

export const POST = withAuth(
  async (request) => {
    const body = schema.parse(await request.json());
    // Logic here
    return successResponse({ created: true }, 201);
  },
  { permissions: ['example:create'] }
);
```

### Adding a New Service Function

1. Add to appropriate service file in `/src/lib/services/`
2. Define input/output interfaces
3. Include error handling
4. Add audit logging
5. Write tests

### Adding a Database Model

1. Update `prisma/schema.prisma`
2. Run `npm run db:migrate`
3. Update relevant services
4. Add to seed data if needed

### Adding a New Page

1. Create page file in `/src/app/[route]/page.tsx`
2. Add to middleware if auth required
3. Create necessary components
4. Add route to navigation

---

## 13. Key Files Reference

| File                       | Description               |
| -------------------------- | ------------------------- |
| `prisma/schema.prisma`     | Complete database schema  |
| `src/lib/db.ts`            | Prisma client singleton   |
| `src/lib/auth.ts`          | Authentication helpers    |
| `src/lib/rbac.ts`          | Role-based access control |
| `src/lib/api/with-auth.ts` | API middleware            |
| `src/lib/api/response.ts`  | Response formatting       |
| `src/lib/api/errors.ts`    | Error classes             |
| `src/lib/services/*.ts`    | Business logic services   |
| `src/lib/validations/*.ts` | Zod schemas               |
| `src/app/api/**/*.ts`      | API endpoints             |
| `next.config.mjs`          | Next.js config            |
| `tailwind.config.ts`       | Tailwind config           |
| `.env.example`             | Environment template      |

---

## Need Help?

- **Documentation:** `/docs/` directory
- **Legal Review:** `/docs/LEGAL_REVIEW.md`
- **Privacy:** `/docs/PRIVACY_IMPACT_ASSESSMENT.md`
- **Development Plan:** `/development-plan.md`
- **API Contracts:** `src/__tests__/contracts/`

Happy coding! 🚀
