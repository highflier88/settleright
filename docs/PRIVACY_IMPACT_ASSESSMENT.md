# Privacy Impact Assessment - Settleright.ai

## Document Overview

This document catalogs all data collection, processing, and retention practices in the Settleright.ai platform to support privacy compliance reviews.

---

## 1. Data Collection Inventory

### 1.1 Account Information

| Data Type       | Collection Point | Purpose                       | Retention        |
| --------------- | ---------------- | ----------------------------- | ---------------- |
| Full legal name | Onboarding       | Identity, legal documents     | Account lifetime |
| Email address   | Registration     | Communication, authentication | Account lifetime |
| Phone number    | Onboarding       | SMS notifications, 2FA        | Account lifetime |
| Mailing address | Onboarding       | Legal service, jurisdiction   | Account lifetime |

### 1.2 Identity Verification Data

| Data Type               | Collection Point | Purpose               | Retention           |
| ----------------------- | ---------------- | --------------------- | ------------------- |
| Government ID documents | KYC flow         | Identity verification | Per provider policy |
| Photographs             | KYC flow         | Identity matching     | Per provider policy |
| Date of birth           | KYC flow         | Age verification      | Account lifetime    |
| Verification status     | KYC result       | Access control        | Account lifetime    |

**Third-party processor:** Stripe Identity

### 1.3 Case Information

| Data Type            | Collection Point     | Purpose                  | Retention                       |
| -------------------- | -------------------- | ------------------------ | ------------------------------- |
| Dispute descriptions | Case creation        | AI analysis, arbitration | Case lifetime + legal retention |
| Statements           | Statement submission | Evidence for arbitration | Case lifetime + legal retention |
| Evidence documents   | Evidence upload      | Arbitration analysis     | Case lifetime + legal retention |
| Claim amounts        | Case creation        | Award calculation        | Case lifetime + legal retention |

### 1.4 Technical Data (Signature Capture)

| Data Type          | Collection Point  | Purpose                | Retention |
| ------------------ | ----------------- | ---------------------- | --------- |
| IP address         | Agreement signing | Legal authenticity     | Permanent |
| User agent         | Agreement signing | Device identification  | Permanent |
| Device fingerprint | Agreement signing | Signature verification | Permanent |
| Timestamp          | Agreement signing | Legal records          | Permanent |

### 1.5 Usage Data

| Data Type  | Collection Point   | Purpose               | Retention           |
| ---------- | ------------------ | --------------------- | ------------------- |
| Audit logs | All actions        | Compliance, debugging | 7 years minimum     |
| Page views | Analytics          | Platform improvement  | Per provider policy |
| Error logs | Application errors | Debugging             | 90 days             |

---

## 2. Data Processing Activities

### 2.1 AI Processing

**Purpose:** Automated analysis of disputes to generate draft awards

**Data processed:**

- Dispute descriptions
- Party statements
- Evidence documents
- Applicable law citations

**Processor:** Anthropic Claude API

**Safeguards:**

- Human arbitrator review required
- AI does not make final decisions
- Disclosed to users before agreement signing

### 2.2 Email Communications

**Purpose:** Transactional notifications

**Data processed:**

- Email addresses
- Names
- Case reference numbers
- Award summaries

**Processor:** SendGrid

### 2.3 SMS Notifications

**Purpose:** Time-sensitive alerts

**Data processed:**

- Phone numbers
- Case reference numbers

**Processor:** Twilio

### 2.4 Payment Processing

**Purpose:** Filing fee collection

**Data processed:**

- Payment card information
- Billing addresses

**Processor:** Stripe

**Note:** Card details never stored on platform

---

## 3. Third-Party Data Processors

| Processor       | Service        | Data Shared              | DPA Status |
| --------------- | -------------- | ------------------------ | ---------- |
| Clerk           | Authentication | Email, name              | Required   |
| Stripe          | Payments       | Payment info             | Required   |
| Stripe Identity | KYC            | ID documents, photos     | Required   |
| SendGrid        | Email          | Email addresses, content | Required   |
| Twilio          | SMS            | Phone numbers, content   | Required   |
| Anthropic       | AI Analysis    | Case content             | Required   |
| Vercel          | Hosting        | All platform data        | Required   |
| Sentry          | Error tracking | Error context            | Required   |

**Action Required:** Execute Data Processing Agreements (DPAs) with all processors.

---

## 4. Data Retention Policies

### 4.1 Current Implementation

| Data Category   | Retention Period       | Basis                 |
| --------------- | ---------------------- | --------------------- |
| Account data    | Until account deletion | Consent               |
| Case data       | Permanent              | Legal requirement     |
| Audit logs      | 7 years minimum        | Legal requirement     |
| Payment records | 7 years                | Tax/legal requirement |
| Signatures      | Permanent              | Legal evidence        |

### 4.2 Deletion Requests

Current implementation uses soft delete:

- User records marked as deleted
- Data retained for legal compliance
- Anonymous after retention period

**Action Required:** Document right-to-deletion limitations due to legal holds.

---

## 5. Data Subject Rights

### 5.1 GDPR Rights (EU Users)

| Right                        | Implementation Status    |
| ---------------------------- | ------------------------ |
| Right to access              | ❌ Not implemented       |
| Right to rectification       | ❌ Not implemented       |
| Right to erasure             | ⚠️ Partial (soft delete) |
| Right to restrict processing | ❌ Not implemented       |
| Right to data portability    | ❌ Not implemented       |
| Right to object              | ❌ Not implemented       |

**Action Required:** Implement data subject rights endpoints if serving EU users.

### 5.2 CCPA Rights (California Users)

| Right                       | Implementation Status    |
| --------------------------- | ------------------------ |
| Right to know               | ❌ Not implemented       |
| Right to delete             | ⚠️ Partial (soft delete) |
| Right to opt-out of sale    | N/A (no data sale)       |
| Right to non-discrimination | ✅ Implemented           |

**Action Required:** Implement CCPA compliance if serving California users.

---

## 6. Security Measures

### 6.1 Technical Safeguards

- [x] HTTPS/TLS encryption in transit
- [x] Database encryption at rest (Vercel Postgres)
- [x] Password hashing (via Clerk)
- [x] Session management (via Clerk)
- [x] MFA support (via Clerk)
- [x] Document hash verification (SHA-256)

### 6.2 Access Controls

- [x] Role-based access control (RBAC)
- [x] Authentication required for all protected routes
- [x] Audit logging of all actions
- [ ] Admin access logging
- [ ] Periodic access reviews

---

## 7. Compliance Action Items

### High Priority

- [ ] Execute DPAs with all third-party processors
- [ ] Review and approve Privacy Policy with legal counsel
- [ ] Document lawful basis for each processing activity
- [ ] Implement cookie consent (if using tracking cookies)

### Medium Priority

- [ ] Implement data subject access request workflow
- [ ] Create data retention policy documentation
- [ ] Review AI processing disclosure adequacy
- [ ] Conduct security penetration testing

### Lower Priority

- [ ] Implement automated data retention enforcement
- [ ] Create privacy training for staff
- [ ] Document cross-border data transfer safeguards
- [ ] Conduct annual privacy review

---

## 8. Key Files for Privacy Review

| File                         | Content                        |
| ---------------------------- | ------------------------------ |
| `/legal/privacy-policy.md`   | Privacy Policy document        |
| `/src/lib/services/email.ts` | Email data handling            |
| `/src/lib/services/sms.ts`   | SMS data handling              |
| `/src/lib/kyc.ts`            | Identity verification handling |
| `/src/lib/audit.ts`          | Audit logging implementation   |
| `/prisma/schema.prisma`      | Data model definitions         |
