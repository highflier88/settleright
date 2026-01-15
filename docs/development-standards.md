# Settleright.ai Development Standards

## Overview

This document establishes coding standards, development environment setup, and best practices for the Settleright.ai engineering team.

---

## Development Environment Setup

### Prerequisites

| Tool    | Version  | Installation                                           |
| ------- | -------- | ------------------------------------------------------ |
| Node.js | 20.x LTS | [nodejs.org](https://nodejs.org) or nvm                |
| pnpm    | 8.x      | `npm install -g pnpm`                                  |
| Docker  | 24.x     | [docker.com](https://docker.com)                       |
| Git     | 2.40+    | [git-scm.com](https://git-scm.com)                     |
| VS Code | Latest   | [code.visualstudio.com](https://code.visualstudio.com) |

### Node.js Version Management

Use `nvm` (Node Version Manager) to manage Node.js versions:

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install and use correct Node version
nvm install 20
nvm use 20
nvm alias default 20
```

The project includes an `.nvmrc` file:

```
20
```

### Initial Setup

```bash
# Clone the repository
git clone git@github.com:settleright/settleright-platform.git
cd settleright-platform

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Start local services (PostgreSQL, Redis)
docker compose up -d

# Run database migrations
pnpm db:migrate

# Seed development data
pnpm db:seed

# Start development server
pnpm dev
```

### Environment Variables

Create `.env.local` from `.env.example`:

```bash
# Application
NODE_ENV=development
APP_URL=http://localhost:3000
API_URL=http://localhost:3001

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/settleright_dev

# Redis
REDIS_URL=redis://localhost:6379

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Payments (Stripe)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Email (SendGrid)
SENDGRID_API_KEY=SG...

# SMS (Twilio)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...

# AI (Anthropic)
ANTHROPIC_API_KEY=sk-ant-...

# Storage (AWS S3)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=settleright-dev

# Vector DB (Pinecone)
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=...
PINECONE_INDEX=settleright-legal

# Monitoring
SENTRY_DSN=https://...
```

**NEVER commit `.env.local` or any file containing secrets.**

---

## Project Structure

```
settleright-platform/
├── apps/
│   ├── web/                    # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/            # App router pages
│   │   │   ├── components/     # React components
│   │   │   ├── hooks/          # Custom hooks
│   │   │   ├── lib/            # Utilities
│   │   │   └── styles/         # Global styles
│   │   ├── public/             # Static assets
│   │   └── package.json
│   │
│   └── api/                    # Express backend
│       ├── src/
│       │   ├── routes/         # API routes
│       │   ├── controllers/    # Business logic
│       │   ├── services/       # Service layer
│       │   ├── middleware/     # Express middleware
│       │   ├── lib/            # Utilities
│       │   └── types/          # TypeScript types
│       └── package.json
│
├── packages/
│   ├── database/               # Prisma schema & client
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   └── package.json
│   │
│   ├── shared/                 # Shared types & utilities
│   │   ├── src/
│   │   │   ├── types/
│   │   │   ├── constants/
│   │   │   └── utils/
│   │   └── package.json
│   │
│   └── ui/                     # Shared UI components
│       ├── src/
│       │   └── components/
│       └── package.json
│
├── docker/                     # Docker configurations
├── docs/                       # Documentation
├── scripts/                    # Build & utility scripts
├── .github/                    # GitHub Actions workflows
├── docker-compose.yml          # Local development services
├── pnpm-workspace.yaml         # pnpm workspace config
├── turbo.json                  # Turborepo config
└── package.json                # Root package.json
```

---

## Coding Standards

### TypeScript

**Strict Mode Required:**

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

**Type Guidelines:**

- Prefer `interface` over `type` for object shapes
- Use `type` for unions, intersections, and primitives
- Avoid `any` - use `unknown` if type is truly unknown
- Export types from dedicated `types.ts` files
- Use `as const` for literal types

```typescript
// Good
interface User {
  id: string;
  email: string;
  role: UserRole;
}

type UserRole = 'claimant' | 'respondent' | 'arbitrator' | 'admin';

// Bad
const user: any = fetchUser();
```

### Naming Conventions

| Type               | Convention           | Example                 |
| ------------------ | -------------------- | ----------------------- |
| Variables          | camelCase            | `caseStatus`            |
| Functions          | camelCase            | `getCaseById`           |
| Classes            | PascalCase           | `CaseService`           |
| Interfaces         | PascalCase           | `CaseData`              |
| Types              | PascalCase           | `CaseStatus`            |
| Constants          | SCREAMING_SNAKE_CASE | `MAX_FILE_SIZE`         |
| Files (components) | PascalCase           | `CaseCard.tsx`          |
| Files (utilities)  | kebab-case           | `date-utils.ts`         |
| Database tables    | snake_case           | `audit_logs`            |
| API routes         | kebab-case           | `/api/v1/case-evidence` |

### File Organization

**Components:**

```typescript
// CaseCard.tsx
import { type FC } from 'react';
import { cn } from '@/lib/utils';
import type { Case } from '@/types';

interface CaseCardProps {
  case: Case;
  onClick?: () => void;
}

export const CaseCard: FC<CaseCardProps> = ({ case, onClick }) => {
  // Component logic
  return (
    <div className={cn('...')} onClick={onClick}>
      {/* JSX */}
    </div>
  );
};
```

**Services:**

```typescript
// case.service.ts
import { prisma } from '@/lib/prisma';
import type { Case, CreateCaseInput } from '@/types';

export class CaseService {
  async create(input: CreateCaseInput): Promise<Case> {
    // Implementation
  }

  async findById(id: string): Promise<Case | null> {
    // Implementation
  }
}

export const caseService = new CaseService();
```

### Import Order

Use the following import order (enforced by ESLint):

```typescript
// 1. React/Next.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 2. External packages
import { z } from 'zod';
import { format } from 'date-fns';

// 3. Internal packages (@settleright/*)
import { prisma } from '@settleright/database';
import { Button } from '@settleright/ui';

// 4. Relative imports
import { CaseCard } from '@/components/CaseCard';
import { formatCurrency } from '@/lib/utils';
import type { Case } from '@/types';
```

### Error Handling

**API Routes:**

```typescript
import { AppError } from '@/lib/errors';

// Throw typed errors
if (!case) {
  throw new AppError('CASE_NOT_FOUND', 'Case not found', 404);
}

// Error handler middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  // Log unexpected errors
  logger.error('Unexpected error', { error: err });

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
});
```

**Frontend:**

```typescript
// Use try-catch with typed errors
try {
  const result = await api.cases.create(data);
} catch (error) {
  if (error instanceof ApiError) {
    toast.error(error.message);
  } else {
    toast.error('An unexpected error occurred');
    Sentry.captureException(error);
  }
}
```

---

## Code Quality Tools

### ESLint Configuration

```javascript
// .eslintrc.js
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'next/core-web-vitals',
    'prettier',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-floating-promises': 'error',
    'react/prop-types': 'off',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
};
```

### Prettier Configuration

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

### Git Hooks (Husky)

```json
// package.json
{
  "scripts": {
    "prepare": "husky install"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

Pre-commit hook:

```bash
#!/bin/sh
pnpm lint-staged
pnpm type-check
```

Pre-push hook:

```bash
#!/bin/sh
pnpm test
```

---

## Testing Standards

### Unit Tests (Jest)

```typescript
// case.service.test.ts
import { CaseService } from './case.service';
import { prismaMock } from '@/test/mocks/prisma';

describe('CaseService', () => {
  let service: CaseService;

  beforeEach(() => {
    service = new CaseService();
  });

  describe('create', () => {
    it('should create a case with valid input', async () => {
      const input = {
        claimantId: 'user_123',
        description: 'Test dispute',
        amount: 1000,
      };

      prismaMock.case.create.mockResolvedValue({
        id: 'case_123',
        ...input,
        status: 'DRAFT',
      });

      const result = await service.create(input);

      expect(result.id).toBe('case_123');
      expect(result.status).toBe('DRAFT');
    });

    it('should throw error for invalid amount', async () => {
      const input = {
        claimantId: 'user_123',
        description: 'Test dispute',
        amount: -100,
      };

      await expect(service.create(input)).rejects.toThrow('Invalid amount');
    });
  });
});
```

### Integration Tests

```typescript
// cases.api.test.ts
import { createTestServer } from '@/test/utils';
import { seedTestUser, seedTestCase } from '@/test/fixtures';

describe('GET /api/v1/cases/:id', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterAll(async () => {
    await server.close();
  });

  it('should return case for authenticated owner', async () => {
    const user = await seedTestUser();
    const case = await seedTestCase({ claimantId: user.id });

    const response = await server
      .get(`/api/v1/cases/${case.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(case.id);
  });

  it('should return 404 for non-existent case', async () => {
    const user = await seedTestUser();

    const response = await server
      .get('/api/v1/cases/non_existent')
      .set('Authorization', `Bearer ${user.token}`);

    expect(response.status).toBe(404);
  });
});
```

### E2E Tests (Playwright)

```typescript
// case-creation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Case Creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  });

  test('should create a new case', async ({ page }) => {
    await page.click('[data-testid="new-case-button"]');
    await page.fill('[data-testid="dispute-description"]', 'Test dispute');
    await page.fill('[data-testid="claim-amount"]', '1000');
    await page.click('[data-testid="submit-case"]');

    await expect(page.locator('[data-testid="case-created-message"]')).toBeVisible();
  });
});
```

### Test Coverage Requirements

| Type              | Minimum Coverage |
| ----------------- | ---------------- |
| Unit Tests        | 80%              |
| Integration Tests | Critical paths   |
| E2E Tests         | Happy paths      |

---

## VS Code Configuration

### Recommended Extensions

```json
// .vscode/extensions.json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "prisma.prisma",
    "bradlc.vscode-tailwindcss",
    "formulahendry.auto-rename-tag",
    "streetsidesoftware.code-spell-checker",
    "eamodio.gitlens",
    "github.copilot"
  ]
}
```

### Workspace Settings

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "typescript.preferences.importModuleSpecifier": "non-relative",
  "tailwindCSS.experimental.classRegex": [["cn\\(([^)]*)\\)", "'([^']*)'"]]
}
```

---

## Docker Development

### docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: settleright_dev
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data

  mailhog:
    image: mailhog/mailhog
    ports:
      - '1025:1025' # SMTP
      - '8025:8025' # Web UI

volumes:
  postgres_data:
  redis_data:
```

### Common Commands

```bash
# Start services
docker compose up -d

# View logs
docker compose logs -f postgres

# Stop services
docker compose down

# Reset database
docker compose down -v
docker compose up -d
pnpm db:migrate
pnpm db:seed
```

---

## Scripts

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "start": "turbo run start",
    "lint": "turbo run lint",
    "lint:fix": "turbo run lint -- --fix",
    "type-check": "turbo run type-check",
    "test": "turbo run test",
    "test:watch": "turbo run test -- --watch",
    "test:coverage": "turbo run test -- --coverage",
    "test:e2e": "playwright test",
    "db:migrate": "prisma migrate dev",
    "db:push": "prisma db push",
    "db:seed": "prisma db seed",
    "db:studio": "prisma studio",
    "db:reset": "prisma migrate reset",
    "clean": "turbo run clean && rm -rf node_modules",
    "prepare": "husky install"
  }
}
```

---

## Security Practices

### Code Security

1. **Never hardcode secrets** - Use environment variables
2. **Validate all input** - Use Zod schemas
3. **Sanitize output** - Prevent XSS
4. **Use parameterized queries** - Prisma handles this
5. **Implement rate limiting** - On all public endpoints
6. **Enable CORS properly** - Whitelist specific origins
7. **Use HTTPS only** - In all environments except local
8. **Keep dependencies updated** - Run `pnpm audit` regularly

### Secrets Management

```bash
# Never do this
const API_KEY = 'sk-secret-key';

# Do this instead
const API_KEY = process.env.API_KEY;
if (!API_KEY) throw new Error('API_KEY is required');
```

### Dependency Security

```bash
# Check for vulnerabilities
pnpm audit

# Update dependencies
pnpm update --interactive --latest
```

---

## Performance Guidelines

### Frontend

1. Use `next/image` for all images
2. Lazy load below-the-fold content
3. Minimize client-side JavaScript
4. Use React Server Components where possible
5. Implement proper caching headers

### Backend

1. Use database indexes appropriately
2. Implement pagination for list endpoints
3. Cache frequently accessed data in Redis
4. Use connection pooling for database
5. Profile and optimize slow queries

### Database

1. Add indexes for frequently queried columns
2. Use `select` to fetch only needed fields
3. Avoid N+1 queries (use `include` in Prisma)
4. Implement soft deletes for audit trail
5. Partition large tables if needed

---

## Documentation

### Code Comments

- Write self-documenting code; avoid obvious comments
- Use JSDoc for public APIs and complex functions
- Explain "why", not "what"

```typescript
/**
 * Generates a draft award using AI analysis.
 *
 * @param caseId - The case to analyze
 * @returns Draft award document
 * @throws {AppError} If case is not ready for analysis
 */
async function generateDraftAward(caseId: string): Promise<DraftAward> {
  // Check both parties have submitted evidence
  // (AI analysis requires complete submissions)
  const case = await caseService.findById(caseId);

  if (!case.isReadyForAnalysis) {
    throw new AppError('CASE_NOT_READY', 'Both parties must submit evidence');
  }

  // ...
}
```

### README Files

Each package should have a README with:

- Purpose and responsibility
- Setup instructions
- Key APIs/exports
- Example usage

---

## Checklist for New Features

- [ ] TypeScript types defined
- [ ] Input validation with Zod
- [ ] Error handling implemented
- [ ] Unit tests written (80% coverage)
- [ ] Integration tests for API endpoints
- [ ] Audit logging for sensitive operations
- [ ] Documentation updated
- [ ] Code reviewed by at least one team member
- [ ] Security review for sensitive features
- [ ] Performance tested for data-heavy operations
