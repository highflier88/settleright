/**
 * Arbitrator Management Module
 *
 * Comprehensive arbitrator lifecycle management:
 * - Onboarding and profile setup
 * - Credential verification
 * - Compensation calculation and tracking
 * - Stripe Connect payment integration
 * - Performance analytics
 */

// Onboarding
export {
  initializeOnboarding,
  completeOnboarding,
  saveOnboardingProgress,
  getOnboardingProgress,
  getArbitratorProfile,
  canBecomeArbitrator,
  getAvailableJurisdictions,
  getAvailableSpecialties,
  US_STATES,
  type ArbitratorOnboardingInput,
  type ArbitratorOnboardingResult,
  type OnboardingProgress,
} from './onboarding';

// Credentials
export {
  submitCredentials,
  verifyCredentials,
  getCredentialStatus,
  areCredentialsValid,
  getPendingVerifications,
  getExpiringCredentials,
  getBarVerificationUrl,
  expireCredentials,
  type CredentialVerificationResult,
  type CredentialSubmission,
  type AdminVerificationInput,
} from './credentials';

// Compensation
export {
  calculateCompensation,
  createCompensationRecord,
  approveCompensation,
  markCompensationPaid,
  disputeCompensation,
  getEarningsSummary,
  getCompensationHistory,
  getPendingCompensations,
  updateCompensationRates,
  type CompensationCalculation,
  type CompensationBreakdown,
  type CompensationRecord,
  type EarningsSummary,
} from './compensation';

// Stripe Connect
export {
  createConnectAccount,
  generateOnboardingLink,
  generateDashboardLink,
  getAccountStatus,
  getDetailedAccountStatus,
  createTransfer,
  processPendingPayouts,
  handleConnectWebhook,
  isStripeConnectConfigured,
  type ConnectAccountResult,
  type AccountStatus,
  type TransferResult,
} from './stripe-connect';

// Analytics
export {
  getPerformanceMetrics,
  getWorkloadMetrics,
  getEarningsTrends,
  getQualityMetrics,
  getArbitratorDashboardData,
  getRecentActivity,
  type PerformanceMetrics,
  type WorkloadMetrics,
  type EarningsTrends,
  type QualityMetrics,
  type ArbitratorDashboardData,
  type RecentActivity,
} from './analytics';
