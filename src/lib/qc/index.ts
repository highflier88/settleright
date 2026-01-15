/**
 * Quality Control Module
 *
 * Provides comprehensive QC capabilities for arbitration awards:
 * - Citation verification
 * - Consistency analysis
 * - Bias detection
 * - Random audit sampling
 */

// Citation Verification
export {
  verifyCitation,
  verifyCitations,
  verifyCitationFormat,
  checkCitationExists,
  getCitationVerificationReport,
  type CitationVerificationResult,
  type CitationReport,
} from './citation-verification';

// Consistency Analysis
export {
  analyzeConsistency,
  findSimilarAwards,
  getConsistencyReport,
  type ConsistencyAnalysisResult,
  type SimilarAward,
  type DamageConsistencyAnalysis,
  type ReasoningConsistencyAnalysis,
  type OutlierFlag,
  type SimilarCaseComparison,
} from './consistency-analysis';

// Bias Detection
export {
  detectBias,
  generateBiasReport,
  getBiasMetrics,
  type BiasDetectionResult,
  type BiasReport,
  type BiasMetrics,
  type BiasFlag,
  type WinRateAnalysis,
  type AwardDistributionAnalysis,
  type TimingAnalysis,
} from './bias-detection';

// Audit Sampling
export {
  selectAuditSample,
  createAuditTask,
  getAuditQueue,
  completeAuditTask,
  getAuditStats,
  type AuditSample,
  type AuditTask,
  type AuditStats,
  type AuditFindings,
  type AuditStatus,
  type AuditPriority,
  type SelectionReason,
} from './audit-sampling';

// QC Service
export {
  runQualityCheck,
  getQCDashboardData,
  type QualityCheckResult,
  type QCDashboardData,
  type QualityIssue,
  type QCCheckType,
} from './qc-service';
