/**
 * Digital Signature Service
 *
 * Provides cryptographic signing capabilities for arbitration awards:
 * - Key pair generation and management
 * - X.509 certificate generation
 * - PKCS#7/CMS document signing
 * - Signature verification
 * - RFC 3161 timestamping integration
 */

export {
  generateKeyPair,
  generateCertificate,
  signDocument,
  verifySignature,
  getSigningCredentials,
  type KeyPair,
  type SigningCertificate,
  type SignatureResult,
  type VerificationResult,
} from './signature-service';

export {
  requestTimestamp,
  verifyTimestamp,
  type TimestampRequest,
  type TimestampResponse,
} from './timestamping';

export {
  signPdfDocument,
  verifyPdfSignature,
  type PdfSignatureOptions,
  type PdfSignatureResult,
} from './pdf-signing';
