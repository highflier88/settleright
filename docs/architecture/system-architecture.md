# Settleright.ai System Architecture

## Overview

This document describes the high-level system architecture for Settleright.ai, an AI-powered online dispute resolution platform that facilitates binding arbitration.

---

## Architecture Principles

1. **Security First** - All data is encrypted, access is authenticated, actions are audited
2. **Compliance by Design** - Architecture supports legal requirements for binding arbitration
3. **Scalability** - Horizontal scaling for growing user base
4. **Reliability** - High availability with graceful degradation
5. **Maintainability** - Clear separation of concerns, modular design

---

## System Context Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL ACTORS                                 │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌─────────┐     ┌─────────┐     ┌───────────┐     ┌─────────┐
    │Claimant │     │Respondent│    │ Arbitrator│     │  Admin  │
    └────┬────┘     └────┬────┘     └─────┬─────┘     └────┬────┘
         │               │                │                 │
         └───────────────┴────────────────┴─────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SETTLERIGHT.AI PLATFORM                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                           WEB APPLICATION                              │  │
│  │                         (Next.js Frontend)                             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│                                    ▼                                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                            API GATEWAY                                 │  │
│  │              (Authentication, Rate Limiting, Routing)                  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│         ┌──────────────────────────┼──────────────────────────┐             │
│         ▼                          ▼                          ▼             │
│  ┌─────────────┐          ┌─────────────┐          ┌─────────────────┐     │
│  │    USER     │          │    CASE     │          │   ARBITRATION   │     │
│  │   SERVICE   │          │   SERVICE   │          │     SERVICE     │     │
│  └─────────────┘          └─────────────┘          └─────────────────┘     │
│                                    │                          │             │
│                                    ▼                          ▼             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         SHARED SERVICES                                │  │
│  │    Notification │ Audit │ Document │ Payment │ Queue                  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│                                    ▼                                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                           DATA LAYER                                   │  │
│  │         PostgreSQL │ Redis │ S3 │ Pinecone                            │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL SERVICES                                   │
│    Clerk │ Stripe │ SendGrid │ Twilio │ Anthropic │ Stripe Identity        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### Frontend (Next.js)

```
┌─────────────────────────────────────────────────────────────────┐
│                        NEXT.JS APPLICATION                       │
├─────────────────────────────────────────────────────────────────┤
│  PAGES (App Router)                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
│  │   /auth     │ │ /dashboard  │ │   /cases    │ │ /arbitrator│ │
│  │   - login   │ │   - home    │ │   - [id]    │ │  - queue   │ │
│  │   - signup  │ │   - cases   │ │   - new     │ │  - review  │ │
│  │   - verify  │ │   - profile │ │   - evidence│ │            │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  COMPONENTS                                                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Layout │ Forms │ Cards │ Modals │ Tables │ Navigation      ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  STATE & DATA                                                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ TanStack     │ │    Zustand   │ │   React      │            │
│  │ Query        │ │    (Global)  │ │   Context    │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
├─────────────────────────────────────────────────────────────────┤
│  API CLIENT                                                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Type-safe API Client (fetch wrapper)           ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Backend (Express API)

```
┌─────────────────────────────────────────────────────────────────┐
│                         EXPRESS API                              │
├─────────────────────────────────────────────────────────────────┤
│  MIDDLEWARE CHAIN                                                │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│  │ Helmet │→│  CORS  │→│  Auth  │→│Validate│→│  Audit │       │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘       │
├─────────────────────────────────────────────────────────────────┤
│  ROUTE HANDLERS                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ /api/v1/users    │ /api/v1/cases    │ /api/v1/evidence    │ │
│  │ /api/v1/awards   │ /api/v1/payments │ /api/v1/arbitration │ │
│  └────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  CONTROLLERS                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │    User      │ │     Case     │ │  Arbitration │            │
│  │  Controller  │ │  Controller  │ │  Controller  │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
├─────────────────────────────────────────────────────────────────┤
│  SERVICES (Business Logic)                                       │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │  Auth   │ │  Case   │ │Evidence │ │   AI    │ │  Award  │  │
│  │ Service │ │ Service │ │ Service │ │ Service │ │ Service │  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  DATA ACCESS (Prisma)                                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Prisma Client                            ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Service Descriptions

### User Service

**Responsibilities:**
- User registration and profile management
- Identity verification orchestration
- Role and permission management

**Key Operations:**
```typescript
interface UserService {
  register(data: RegisterInput): Promise<User>;
  getProfile(userId: string): Promise<UserProfile>;
  updateProfile(userId: string, data: UpdateProfileInput): Promise<User>;
  initiateKYC(userId: string): Promise<VerificationSession>;
  getKYCStatus(userId: string): Promise<VerificationStatus>;
}
```

### Case Service

**Responsibilities:**
- Case lifecycle management
- Invitation and response handling
- Status transitions and deadlines

**Key Operations:**
```typescript
interface CaseService {
  create(claimantId: string, data: CreateCaseInput): Promise<Case>;
  inviteRespondent(caseId: string, contact: ContactInfo): Promise<Invitation>;
  acceptInvitation(token: string, respondentId: string): Promise<Case>;
  getCase(caseId: string, userId: string): Promise<CaseDetail>;
  updateStatus(caseId: string, status: CaseStatus): Promise<Case>;
  checkDeadlines(): Promise<void>; // Scheduled job
}
```

### Evidence Service

**Responsibilities:**
- Evidence upload and storage
- File validation and processing
- Access control and viewing tracking

**Key Operations:**
```typescript
interface EvidenceService {
  upload(caseId: string, userId: string, file: File): Promise<Evidence>;
  getEvidence(evidenceId: string, userId: string): Promise<Evidence>;
  listEvidence(caseId: string, userId: string): Promise<Evidence[]>;
  markAsViewed(evidenceId: string, userId: string): Promise<void>;
  delete(evidenceId: string, userId: string): Promise<void>;
}
```

### Arbitration Service

**Responsibilities:**
- AI analysis pipeline orchestration
- Human arbitrator assignment
- Award generation and signing

**Key Operations:**
```typescript
interface ArbitrationService {
  initiateAnalysis(caseId: string): Promise<AnalysisJob>;
  getAnalysisStatus(caseId: string): Promise<AnalysisStatus>;
  generateDraftAward(caseId: string): Promise<DraftAward>;
  assignArbitrator(caseId: string): Promise<Assignment>;
  submitReview(caseId: string, arbitratorId: string, decision: ReviewDecision): Promise<Award>;
  signAward(awardId: string, arbitratorId: string, signature: Signature): Promise<SignedAward>;
}
```

### Notification Service

**Responsibilities:**
- Email and SMS delivery
- Notification preferences
- Delivery tracking

**Key Operations:**
```typescript
interface NotificationService {
  sendEmail(to: string, template: EmailTemplate, data: object): Promise<void>;
  sendSMS(to: string, template: SMSTemplate, data: object): Promise<void>;
  getPreferences(userId: string): Promise<NotificationPreferences>;
  updatePreferences(userId: string, prefs: NotificationPreferences): Promise<void>;
}
```

### Audit Service

**Responsibilities:**
- Immutable audit trail
- Action logging
- Compliance reporting

**Key Operations:**
```typescript
interface AuditService {
  log(event: AuditEvent): Promise<void>;
  getAuditTrail(caseId: string): Promise<AuditEntry[]>;
  generateComplianceReport(caseId: string): Promise<ComplianceReport>;
}
```

---

## Data Flow Diagrams

### Case Creation Flow

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│Claimant │     │   Web   │     │   API   │     │  Case   │     │  DB     │
│         │     │   App   │     │ Gateway │     │ Service │     │         │
└────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘
     │               │               │               │               │
     │ Fill form     │               │               │               │
     │──────────────>│               │               │               │
     │               │               │               │               │
     │               │ POST /cases   │               │               │
     │               │──────────────>│               │               │
     │               │               │               │               │
     │               │               │ Validate auth │               │
     │               │               │──────────────>│               │
     │               │               │               │               │
     │               │               │               │ Create case   │
     │               │               │               │──────────────>│
     │               │               │               │               │
     │               │               │               │   case_id     │
     │               │               │               │<──────────────│
     │               │               │               │               │
     │               │               │               │ Log event     │
     │               │               │               │──────────────>│
     │               │               │               │               │
     │               │   Case data   │               │               │
     │               │<──────────────│<──────────────│               │
     │               │               │               │               │
     │  Show success │               │               │               │
     │<──────────────│               │               │               │
     │               │               │               │               │
```

### AI Analysis Flow

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  Case   │     │  Queue  │     │   AI    │     │ Claude  │     │Pinecone │
│ Service │     │ (Bull)  │     │ Worker  │     │   API   │     │         │
└────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘
     │               │               │               │               │
     │ Queue job     │               │               │               │
     │──────────────>│               │               │               │
     │               │               │               │               │
     │               │ Process job   │               │               │
     │               │──────────────>│               │               │
     │               │               │               │               │
     │               │               │ Fetch case    │               │
     │               │               │ & evidence    │               │
     │               │               │               │               │
     │               │               │ Query legal KB│               │
     │               │               │──────────────────────────────>│
     │               │               │               │               │
     │               │               │ Relevant cases│               │
     │               │               │<──────────────────────────────│
     │               │               │               │               │
     │               │               │ Analyze case  │               │
     │               │               │──────────────>│               │
     │               │               │               │               │
     │               │               │ Draft award   │               │
     │               │               │<──────────────│               │
     │               │               │               │               │
     │               │ Job complete  │               │               │
     │<──────────────│<──────────────│               │               │
     │               │               │               │               │
```

### Award Signing Flow

```
┌──────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│Arbitrator│    │   Web   │    │   API   │    │ Award   │    │  S3     │
│          │    │   App   │    │ Gateway │    │ Service │    │         │
└────┬─────┘    └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘
     │               │               │               │               │
     │ Review draft  │               │               │               │
     │──────────────>│               │               │               │
     │               │               │               │               │
     │ Approve/Edit  │               │               │               │
     │──────────────>│               │               │               │
     │               │               │               │               │
     │               │ POST /sign    │               │               │
     │               │──────────────>│               │               │
     │               │               │               │               │
     │               │               │ Verify auth   │               │
     │               │               │ Capture sig   │               │
     │               │               │──────────────>│               │
     │               │               │               │               │
     │               │               │               │ Generate PDF  │
     │               │               │               │──────────────>│
     │               │               │               │               │
     │               │               │               │ Store award   │
     │               │               │               │──────────────>│
     │               │               │               │               │
     │               │               │               │ Notify parties│
     │               │               │               │               │
     │   Confirmed   │               │               │               │
     │<──────────────│<──────────────│<──────────────│               │
     │               │               │               │               │
```

---

## Database Architecture

### Entity Relationship Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              USERS                                       │
│  ┌─────────┐                                                            │
│  │  User   │───────────────────────────────────────────────┐            │
│  └─────────┘                                               │            │
│       │                                                    │            │
│       │ 1:1                                                │            │
│       ▼                                                    │            │
│  ┌─────────────────┐                                       │            │
│  │ IdentityVerif   │                                       │            │
│  └─────────────────┘                                       │            │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                              CASES                                       │
│                                                                          │
│  ┌─────────┐       ┌─────────────┐       ┌─────────┐                   │
│  │  Case   │──────>│  Agreement  │       │  Award  │                   │
│  └─────────┘       └─────────────┘       └─────────┘                   │
│       │                   │                   ▲                         │
│       │                   │                   │                         │
│       │ 1:N               │ 2:1              │                         │
│       ▼                   ▼                   │                         │
│  ┌─────────┐       ┌─────────────┐           │                         │
│  │Evidence │       │  Signature  │           │                         │
│  └─────────┘       └─────────────┘           │                         │
│       │                                       │                         │
│       │ 1:N                                   │                         │
│       ▼                                       │                         │
│  ┌─────────┐       ┌─────────────┐           │                         │
│  │Statement│       │  DraftAward │───────────┘                         │
│  └─────────┘       └─────────────┘                                     │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                              AUDIT                                       │
│  ┌─────────────┐                                                        │
│  │  AuditLog   │ (immutable, chained)                                  │
│  └─────────────┘                                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Infrastructure Architecture

### AWS Deployment

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              AWS CLOUD                                   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                         VPC                                      │   │
│  │                                                                   │   │
│  │  ┌─────────────────────────────────────────────────────────┐    │   │
│  │  │                   PUBLIC SUBNETS                         │    │   │
│  │  │                                                          │    │   │
│  │  │  ┌─────────────┐         ┌─────────────┐                │    │   │
│  │  │  │     ALB     │         │  NAT Gateway│                │    │   │
│  │  │  │(Load Balancer)        │             │                │    │   │
│  │  │  └─────────────┘         └─────────────┘                │    │   │
│  │  │         │                       │                        │    │   │
│  │  └─────────┼───────────────────────┼────────────────────────┘    │   │
│  │            │                       │                              │   │
│  │  ┌─────────┼───────────────────────┼────────────────────────┐    │   │
│  │  │         ▼     PRIVATE SUBNETS   ▼                        │    │   │
│  │  │                                                          │    │   │
│  │  │  ┌─────────────────────────────────────────────┐        │    │   │
│  │  │  │              ECS FARGATE                     │        │    │   │
│  │  │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐     │        │    │   │
│  │  │  │  │   Web   │  │   API   │  │  Worker │     │        │    │   │
│  │  │  │  │  (x2)   │  │  (x3)   │  │  (x2)   │     │        │    │   │
│  │  │  │  └─────────┘  └─────────┘  └─────────┘     │        │    │   │
│  │  │  └─────────────────────────────────────────────┘        │    │   │
│  │  │                        │                                 │    │   │
│  │  │  ┌─────────────────────┼─────────────────────────┐      │    │   │
│  │  │  │                     ▼                          │      │    │   │
│  │  │  │  ┌─────────┐  ┌───────────┐  ┌─────────────┐ │      │    │   │
│  │  │  │  │   RDS   │  │ElastiCache│  │     S3      │ │      │    │   │
│  │  │  │  │PostgreSQL│ │  (Redis)  │  │  (Evidence) │ │      │    │   │
│  │  │  │  └─────────┘  └───────────┘  └─────────────┘ │      │    │   │
│  │  │  │              DATA LAYER                       │      │    │   │
│  │  │  └───────────────────────────────────────────────┘      │    │   │
│  │  │                                                          │    │   │
│  │  └──────────────────────────────────────────────────────────┘    │   │
│  │                                                                   │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │   CloudFront    │  │    Route 53     │  │      WAF        │         │
│  │     (CDN)       │  │     (DNS)       │  │   (Firewall)    │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Container Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ECS SERVICES                                     │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      web-service                                 │   │
│  │  Image: settleright/web:latest                                  │   │
│  │  Port: 3000                                                      │   │
│  │  Replicas: 2 (auto-scaling: 2-10)                               │   │
│  │  CPU: 512, Memory: 1024                                          │   │
│  │  Health: /health                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      api-service                                 │   │
│  │  Image: settleright/api:latest                                  │   │
│  │  Port: 3001                                                      │   │
│  │  Replicas: 3 (auto-scaling: 3-20)                               │   │
│  │  CPU: 1024, Memory: 2048                                         │   │
│  │  Health: /api/health                                             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     worker-service                               │   │
│  │  Image: settleright/worker:latest                               │   │
│  │  Replicas: 2 (auto-scaling: 2-10)                               │   │
│  │  CPU: 2048, Memory: 4096                                         │   │
│  │  Queues: ai-analysis, notifications, document-processing        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Security Architecture

### Authentication & Authorization

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AUTHENTICATION FLOW                               │
│                                                                          │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐          │
│  │  User   │────>│  Clerk  │────>│ Session │────>│   API   │          │
│  │         │     │  Auth   │     │  Token  │     │ Gateway │          │
│  └─────────┘     └─────────┘     └─────────┘     └─────────┘          │
│                                                        │                │
│                                                        ▼                │
│                                                 ┌─────────────┐        │
│                                                 │    RBAC     │        │
│                                                 │   Check     │        │
│                                                 └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         AUTHORIZATION MATRIX                             │
│                                                                          │
│  Resource        │ Claimant │ Respondent │ Arbitrator │ Admin          │
│  ─────────────────┼──────────┼────────────┼────────────┼───────         │
│  Own Profile     │   RW     │     RW     │     RW     │  RW            │
│  Own Cases       │   RW     │     RW     │     R      │  RW            │
│  Case Evidence   │   RW*    │     RW*    │     R      │  R             │
│  Draft Awards    │   -      │     -      │     RW     │  R             │
│  Final Awards    │   R      │     R      │     R      │  R             │
│  Audit Logs      │   -      │     -      │     -      │  R             │
│  All Users       │   -      │     -      │     -      │  RW            │
│                                                                          │
│  * Only for cases where user is a party                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Security

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ENCRYPTION                                       │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    IN TRANSIT                                    │   │
│  │  - TLS 1.3 for all HTTPS traffic                               │   │
│  │  - Certificate managed by AWS ACM                               │   │
│  │  - HSTS enabled                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    AT REST                                       │   │
│  │  - RDS: AES-256 encryption                                      │   │
│  │  - S3: SSE-S3 (AES-256)                                         │   │
│  │  - Redis: Encrypted (ElastiCache)                               │   │
│  │  - Field-level encryption for PII (application layer)          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Scalability Considerations

### Horizontal Scaling

| Component | Scaling Trigger | Min | Max |
|-----------|-----------------|-----|-----|
| Web (ECS) | CPU > 70% | 2 | 10 |
| API (ECS) | CPU > 70% or Request count | 3 | 20 |
| Worker (ECS) | Queue depth | 2 | 10 |
| RDS | Manual (read replicas) | 1 | 5 |
| Redis | Memory > 75% | 1 | 3 |

### Performance Targets

| Metric | Target |
|--------|--------|
| API Response Time (p50) | < 100ms |
| API Response Time (p99) | < 500ms |
| Page Load Time | < 2s |
| Uptime | 99.9% |
| AI Analysis Time | < 5 min |

---

## Disaster Recovery

### Backup Strategy

| Data | Method | Frequency | Retention |
|------|--------|-----------|-----------|
| PostgreSQL | Automated snapshots | Daily | 30 days |
| PostgreSQL | Point-in-time recovery | Continuous | 7 days |
| S3 (Evidence) | Cross-region replication | Real-time | Permanent |
| Redis | Snapshots | Hourly | 24 hours |

### Recovery Objectives

| Metric | Target |
|--------|--------|
| RPO (Recovery Point Objective) | 1 hour |
| RTO (Recovery Time Objective) | 4 hours |

---

## Monitoring & Alerting

### Key Metrics

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MONITORING STACK                                 │
│                                                                          │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐   │
│  │    DataDog      │     │    Sentry       │     │   CloudWatch    │   │
│  │  - APM          │     │  - Errors       │     │  - AWS Metrics  │   │
│  │  - Metrics      │     │  - Performance  │     │  - Logs         │   │
│  │  - Logs         │     │                 │     │  - Alarms       │   │
│  │  - Dashboards   │     │                 │     │                 │   │
│  └─────────────────┘     └─────────────────┘     └─────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Alert Thresholds

| Alert | Condition | Severity |
|-------|-----------|----------|
| API Error Rate | > 1% for 5 min | Critical |
| API Latency | p99 > 1s for 5 min | Warning |
| Database Connections | > 80% | Warning |
| Queue Depth | > 100 for 10 min | Warning |
| Failed Payments | > 5 in 1 hour | Critical |
| Security Event | Any WAF block | Info |
