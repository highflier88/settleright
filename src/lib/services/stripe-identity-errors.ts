// Stripe Identity error code mappings for user-friendly messages
// Reference: https://stripe.com/docs/identity/verification-sessions#failed-checks

export interface ErrorDetails {
  message: string;
  tip: string;
  retryable: boolean;
  category: 'document' | 'selfie' | 'consent' | 'fraud' | 'technical' | 'unknown';
}

export const STRIPE_IDENTITY_ERROR_MAP: Record<string, ErrorDetails> = {
  // Document-related errors
  document_expired: {
    message: 'Your document has expired',
    tip: 'Please use a valid, non-expired government-issued ID such as a passport, driver\'s license, or national ID card.',
    retryable: true,
    category: 'document',
  },
  document_type_not_supported: {
    message: 'Document type not supported',
    tip: 'Please use a passport, driver\'s license, or government-issued ID card. Other document types are not accepted.',
    retryable: true,
    category: 'document',
  },
  document_unverified_other: {
    message: 'Could not verify your document',
    tip: 'Ensure all information on your document is clearly visible and the document is not damaged.',
    retryable: true,
    category: 'document',
  },
  document_country_not_supported: {
    message: 'Document from unsupported country',
    tip: 'Please use a document issued by a supported country. US, Canada, and most European countries are supported.',
    retryable: true,
    category: 'document',
  },

  // Selfie-related errors
  selfie_document_missing_photo: {
    message: 'Could not match selfie to document photo',
    tip: 'Ensure good lighting and face the camera directly. Remove glasses, hats, or anything covering your face.',
    retryable: true,
    category: 'selfie',
  },
  selfie_face_mismatch: {
    message: 'Selfie does not match document photo',
    tip: 'The person in the selfie must be the same as the photo on the ID document. Please try again with the correct document.',
    retryable: true,
    category: 'selfie',
  },
  selfie_manipulated: {
    message: 'Selfie appears to be manipulated',
    tip: 'Please take a real-time selfie without any filters or editing. Do not use a screenshot or pre-existing photo.',
    retryable: true,
    category: 'selfie',
  },
  selfie_unverified_other: {
    message: 'Could not verify your selfie',
    tip: 'Make sure you are in a well-lit area and looking directly at the camera. Avoid backlighting.',
    retryable: true,
    category: 'selfie',
  },

  // ID number errors
  id_number_insufficient_document_data: {
    message: 'Could not read ID number from document',
    tip: 'Ensure your entire document is visible and the ID number is clearly readable.',
    retryable: true,
    category: 'document',
  },
  id_number_mismatch: {
    message: 'ID number does not match records',
    tip: 'The ID number on your document could not be verified. Please ensure you are using a valid, official document.',
    retryable: true,
    category: 'document',
  },
  id_number_unverified_other: {
    message: 'Could not verify ID number',
    tip: 'Please try again with a different government-issued ID if available.',
    retryable: true,
    category: 'document',
  },

  // DOB errors
  dob_mismatch: {
    message: 'Date of birth could not be verified',
    tip: 'The date of birth on your document does not match our records. Please use your official government ID.',
    retryable: true,
    category: 'document',
  },

  // Name errors
  name_mismatch: {
    message: 'Name on document does not match',
    tip: 'Please use a document with your legal name as it appears in your account.',
    retryable: true,
    category: 'document',
  },

  // Address errors
  address_mismatch: {
    message: 'Address could not be verified',
    tip: 'The address on your document does not match the address you provided. Please ensure consistency.',
    retryable: true,
    category: 'document',
  },

  // Consent and fraud errors
  consent_declined: {
    message: 'Consent was declined',
    tip: 'You must consent to the verification process to continue. Please restart and accept the terms.',
    retryable: true,
    category: 'consent',
  },
  under_supported_age: {
    message: 'Below minimum age requirement',
    tip: 'You must be at least 18 years old to use this service.',
    retryable: false,
    category: 'fraud',
  },
  suspected_fraud: {
    message: 'Verification could not be completed',
    tip: 'If you believe this is an error, please contact support for assistance.',
    retryable: false,
    category: 'fraud',
  },

  // Technical errors
  verification_abandoned: {
    message: 'Verification was not completed',
    tip: 'Please complete the entire verification process in one session. Start a new verification to try again.',
    retryable: true,
    category: 'technical',
  },
  verification_requires_input: {
    message: 'Additional information required',
    tip: 'Please provide all requested information to complete the verification.',
    retryable: true,
    category: 'technical',
  },
};

// Default error for unknown codes
const DEFAULT_ERROR: ErrorDetails = {
  message: 'Verification failed',
  tip: 'Please try again with a valid government-issued ID. If the problem persists, contact support.',
  retryable: true,
  category: 'unknown',
};

/**
 * Get user-friendly error details for a Stripe Identity error code
 */
export function getErrorDetails(stripeErrorCode: string | null | undefined): ErrorDetails {
  if (!stripeErrorCode) {
    return DEFAULT_ERROR;
  }

  return STRIPE_IDENTITY_ERROR_MAP[stripeErrorCode] ?? DEFAULT_ERROR;
}

/**
 * Determine if we should notify admin based on failure count
 * Returns true if user has failed 3 or more times
 */
export function shouldNotifyAdmin(failureCount: number): boolean {
  return failureCount >= 3;
}

/**
 * Get the appropriate retry guidance based on error category
 */
export function getRetryGuidance(category: ErrorDetails['category']): string[] {
  switch (category) {
    case 'document':
      return [
        'Use a passport, driver\'s license, or government ID card',
        'Ensure the document is not expired',
        'Place the document on a flat, dark surface',
        'Make sure all four corners are visible',
        'Avoid glare and shadows on the document',
      ];
    case 'selfie':
      return [
        'Find a well-lit area with natural light if possible',
        'Face the camera directly',
        'Remove glasses, hats, or face coverings',
        'Hold the camera at eye level',
        'Keep a neutral expression',
      ];
    case 'consent':
      return [
        'Read and accept the verification terms',
        'You must consent to proceed with verification',
      ];
    case 'fraud':
      return [
        'Contact support if you believe this is an error',
        'You may need to provide additional documentation',
      ];
    case 'technical':
      return [
        'Use a stable internet connection',
        'Complete the process in one session',
        'Try using a different browser if issues persist',
      ];
    default:
      return [
        'Try again with a valid government ID',
        'Contact support if the issue persists',
      ];
  }
}
