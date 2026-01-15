# Legal Review Checklist - Settleright.ai

## Document Overview

This checklist identifies all user-facing copy that requires legal counsel review before production launch.

## Review Status

- [ ] Attorney review initiated
- [ ] Terms of Service approved
- [ ] Privacy Policy approved
- [ ] Procedural Rules approved
- [ ] Submission Agreement approved
- [ ] User-facing copy approved
- [ ] GDPR/CCPA compliance verified

---

## 1. Legal Documents (Requiring Full Attorney Review)

| Document | Location | Version | Status |
|----------|----------|---------|--------|
| Terms of Service | `/legal/terms-of-service.md` | 1.0 | TEMPLATE - Needs Review |
| Privacy Policy | `/legal/privacy-policy.md` | 1.0 | TEMPLATE - Needs Review |
| Procedural Rules | `/legal/procedural-rules.md` | 1.0 | TEMPLATE - Needs Review |
| Submission Agreement | `/legal/submission-agreement.md` | 1.0 | TEMPLATE - Needs Review |

**Note:** All documents contain a disclaimer stating they are templates for development purposes and require attorney review before use.

---

## 2. Agreement Generation System

### 2.1 Generated Agreement Content

**File:** `/src/lib/services/agreement.ts`
**Function:** `generateAgreementContent()`

Contains critical legal language:
- **Section 1: MUTUAL CONSENT TO ARBITRATE** - Binding arbitration agreement
- **Section 2: WAIVER OF JURY TRIAL** - Explicit jury trial waiver
- **Section 3: WAIVER OF CLASS ACTION** - Class action prohibition
- **Section 4: GOVERNING LAW** - Federal Arbitration Act reference
- **Section 5: AI-ASSISTED ARBITRATION DISCLOSURE** - AI disclosure requirements
- **Section 6: FINALITY OF AWARD** - Award finality statement
- **Section 7: CONFIDENTIALITY** - Confidentiality clause
- **Section 8: FEES AND COSTS** - Fee allocation provisions
- **Section 9: PROCEDURAL RULES** - Incorporation by reference
- **Section 10: ELECTRONIC SIGNATURES** - E-signature acknowledgment

### 2.2 Consent Text

**File:** `/src/lib/services/agreement.ts`
**Function:** `generateConsentText()`

Explicit consent language users agree to when signing:
- Role-specific language (Claimant/Respondent)
- Case reference inclusion
- Waiver acknowledgments
- Binding agreement confirmation

---

## 3. Email Templates

### 3.1 Award Issued Email (CRITICAL)

**File:** `/src/lib/services/email.ts`
**Function:** `sendAwardIssuedEmail()`

Contains:
- "This award is final and legally binding" statement
- Award summary presentation
- Enforcement information

### 3.2 Case Invitation Email

**File:** `/src/lib/services/email.ts`
**Function:** `sendCaseInvitationEmail()`

Contains:
- "binding arbitration to resolve this dispute" language
- Platform commitment statements

### 3.3 Other Email Templates

- Welcome email
- Evidence notification
- Deadline reminders
- Statement notifications

---

## 4. SMS/Notification Templates

**File:** `/src/lib/services/sms.ts`
**Object:** `SmsTemplates`

Templates requiring review:
| Template | Content Description |
|----------|---------------------|
| `invitationSent` | Arbitration invitation |
| `agreementReady` | Signature request |
| `awardIssued` | Award notification |
| `deadlineWarning24h` | 24-hour deadline notice |
| `deadlinePassed` | Missed deadline notice |
| `kycApproved` | Identity verification success |
| `kycFailed` | Identity verification failure |

---

## 5. UI Copy - Agreement Signing

### 5.1 Agreement Signing Form

**File:** `/src/app/(dashboard)/dashboard/cases/[id]/agreement/agreement-signing-form.tsx`

**Mandatory checkboxes (legally binding acknowledgments):**
1. "I have read and understand the Submission Agreement for Binding Arbitration. I agree to be bound by its terms, including the Settleright.ai Procedural Rules."
2. "I understand and voluntarily waive my right to a jury trial and my right to participate in any class action related to this dispute."
3. "I acknowledge that AI will assist in analyzing this case, with final decisions reviewed and approved by a human arbitrator."

**Warning banner:**
- "This is a legally binding agreement. Once signed, this agreement cannot be revoked. The arbitration award will be final and binding."

**Signature disclaimer:**
- "Your signature will be recorded with timestamp, IP address, and device information for legal purposes."

---

## 6. UI Copy - Case Creation

### 6.1 New Case Form

**File:** `/src/app/(dashboard)/dashboard/cases/new/new-case-form.tsx`

Contains:
- Terms of Service agreement checkbox
- Procedural Rules agreement checkbox
- Dispute type descriptions

### 6.2 Onboarding Form

**File:** `/src/app/(auth)/onboarding/onboarding-form.tsx`

Contains:
- Terms of Service acceptance
- Privacy Policy acceptance

---

## 7. UI Copy - Invitation Flow

### 7.1 Invitation Page

**File:** `/src/app/invitation/[token]/page.tsx`

Contains:
- "You've Been Invited to Respond" messaging
- Process explanation (5 steps)
- Binding arbitration description
- Footer: "Settleright.ai provides binding online arbitration services"

### 7.2 Invitation Actions

**File:** `/src/app/invitation/[token]/invitation-actions.tsx`

Contains:
- Terms of Service agreement on account creation
- Privacy Policy agreement link

---

## 8. Enforcement Documents

**File:** `/src/lib/enforcement/documents.ts`

Contains:
- Proof of Service certificate language
- Filing instructions (jurisdiction-specific)
- Arbitrator credentials document

**Disclaimer:**
> "DISCLAIMER: This document provides general guidance only and does not constitute legal advice. Filing requirements may vary and are subject to change. Consult with a licensed attorney in your jurisdiction for specific legal advice regarding your situation."

---

## 9. Priority Order for Attorney Review

### High Priority (Blocking Launch)
1. `/legal/terms-of-service.md` - Terms of Service
2. `/legal/privacy-policy.md` - Privacy Policy
3. `/legal/submission-agreement.md` - Submission Agreement
4. `/legal/procedural-rules.md` - Procedural Rules
5. `/src/lib/services/agreement.ts` - Generated agreement content

### Medium Priority
6. `/src/lib/services/email.ts` - Email templates (especially award issuance)
7. `/src/lib/services/sms.ts` - SMS notification templates
8. Agreement signing form checkboxes and warnings

### Lower Priority
9. Form validation messages
10. Dashboard text and instructions
11. Error messages

---

## 10. Action Items

- [ ] Schedule initial attorney consultation
- [ ] Provide all files in this document to legal counsel
- [ ] Review and customize all template documents
- [ ] Verify FAA compliance for arbitration provisions
- [ ] Verify class action waiver enforceability
- [ ] Review AI disclosure adequacy
- [ ] Assess GDPR/CCPA compliance for Privacy Policy
- [ ] Review jury trial waiver language
- [ ] Verify electronic signature compliance (E-SIGN Act)
- [ ] Final sign-off before production launch
