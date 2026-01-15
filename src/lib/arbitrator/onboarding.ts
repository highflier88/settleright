/**
 * Arbitrator Onboarding Service
 *
 * Handles the complete arbitrator onboarding process:
 * - Profile initialization
 * - Credential collection
 * - Terms agreement
 * - Status tracking
 */

import { prisma } from '@/lib/db';

import type { OnboardingStatus, CredentialVerificationStatus, DisputeType } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

export interface ArbitratorOnboardingInput {
  userId: string;
  barNumber: string;
  barState: string;
  isRetiredJudge: boolean;
  yearsExperience: number;
  lawSchool?: string;
  graduationYear?: number;
  biography?: string;
  jurisdictions: string[];
  specialties: DisputeType[];
  maxCasesPerWeek?: number;
  agreedToTerms: boolean;
}

export interface ArbitratorOnboardingResult {
  success: boolean;
  profileId: string;
  onboardingStatus: OnboardingStatus;
  credentialStatus: CredentialVerificationStatus;
  message: string;
}

export interface OnboardingProgress {
  status: OnboardingStatus;
  completedSteps: string[];
  pendingSteps: string[];
  percentComplete: number;
}

// US States for bar registration
export const US_STATES = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'DC',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
] as const;

// ============================================================================
// ONBOARDING SERVICE
// ============================================================================

/**
 * Initialize arbitrator onboarding for a user
 */
export async function initializeOnboarding(
  userId: string
): Promise<{ profileId: string; status: OnboardingStatus }> {
  // Check if user already has an arbitrator profile
  const existingProfile = await prisma.arbitratorProfile.findUnique({
    where: { userId },
  });

  if (existingProfile) {
    return {
      profileId: existingProfile.id,
      status: existingProfile.onboardingStatus,
    };
  }

  // Create new arbitrator profile with NOT_STARTED status
  const profile = await prisma.arbitratorProfile.create({
    data: {
      userId,
      onboardingStatus: 'NOT_STARTED',
      credentialStatus: 'PENDING',
      isActive: false, // Not active until onboarding complete
    },
  });

  return {
    profileId: profile.id,
    status: profile.onboardingStatus,
  };
}

/**
 * Complete arbitrator onboarding with provided information
 */
export async function completeOnboarding(
  input: ArbitratorOnboardingInput
): Promise<ArbitratorOnboardingResult> {
  const {
    userId,
    barNumber,
    barState,
    isRetiredJudge,
    yearsExperience,
    lawSchool,
    graduationYear,
    biography,
    jurisdictions,
    specialties,
    maxCasesPerWeek = 10,
    agreedToTerms,
  } = input;

  // Validate terms agreement
  if (!agreedToTerms) {
    throw new Error('Must agree to arbitrator terms and conditions');
  }

  // Validate bar state
  if (!US_STATES.includes(barState as (typeof US_STATES)[number])) {
    throw new Error('Invalid bar state');
  }

  // Validate jurisdictions
  for (const jurisdiction of jurisdictions) {
    if (!US_STATES.includes(jurisdiction as (typeof US_STATES)[number])) {
      throw new Error(`Invalid jurisdiction: ${jurisdiction}`);
    }
  }

  // Validate specialties
  const validSpecialties: DisputeType[] = ['CONTRACT', 'PAYMENT', 'SERVICE', 'GOODS', 'OTHER'];
  for (const specialty of specialties) {
    if (!validSpecialties.includes(specialty)) {
      throw new Error(`Invalid specialty: ${specialty}`);
    }
  }

  // Get or create profile
  let profile = await prisma.arbitratorProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    profile = await prisma.arbitratorProfile.create({
      data: {
        userId,
        onboardingStatus: 'IN_PROGRESS',
        credentialStatus: 'PENDING',
        isActive: false,
      },
    });
  }

  // Update profile with onboarding data
  const updatedProfile = await prisma.arbitratorProfile.update({
    where: { id: profile.id },
    data: {
      barNumber,
      barState,
      isRetiredJudge,
      yearsExperience,
      lawSchool,
      graduationYear,
      biography,
      jurisdictions,
      specialties,
      maxCasesPerWeek,
      onboardingStatus: 'COMPLETED',
      onboardedAt: new Date(),
      agreedToTermsAt: new Date(),
      credentialStatus: 'PENDING', // Will be verified separately
      // Not yet active - requires credential verification and Stripe Connect
      isActive: false,
    },
  });

  return {
    success: true,
    profileId: updatedProfile.id,
    onboardingStatus: updatedProfile.onboardingStatus,
    credentialStatus: updatedProfile.credentialStatus,
    message: 'Onboarding completed. Credentials pending verification.',
  };
}

/**
 * Save onboarding progress (partial save)
 */
export async function saveOnboardingProgress(
  userId: string,
  data: Partial<ArbitratorOnboardingInput>
): Promise<void> {
  let profile = await prisma.arbitratorProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    profile = await prisma.arbitratorProfile.create({
      data: {
        userId,
        onboardingStatus: 'IN_PROGRESS',
        credentialStatus: 'PENDING',
        isActive: false,
      },
    });
  }

  await prisma.arbitratorProfile.update({
    where: { id: profile.id },
    data: {
      ...(data.barNumber && { barNumber: data.barNumber }),
      ...(data.barState && { barState: data.barState }),
      ...(data.isRetiredJudge !== undefined && { isRetiredJudge: data.isRetiredJudge }),
      ...(data.yearsExperience && { yearsExperience: data.yearsExperience }),
      ...(data.lawSchool && { lawSchool: data.lawSchool }),
      ...(data.graduationYear && { graduationYear: data.graduationYear }),
      ...(data.biography && { biography: data.biography }),
      ...(data.jurisdictions && { jurisdictions: data.jurisdictions }),
      ...(data.specialties && { specialties: data.specialties }),
      ...(data.maxCasesPerWeek && { maxCasesPerWeek: data.maxCasesPerWeek }),
      onboardingStatus: 'IN_PROGRESS',
    },
  });
}

/**
 * Get onboarding progress for a user
 */
export async function getOnboardingProgress(userId: string): Promise<OnboardingProgress | null> {
  const profile = await prisma.arbitratorProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    return null;
  }

  const completedSteps: string[] = [];
  const pendingSteps: string[] = [];

  // Check each required field
  if (profile.barNumber && profile.barState) {
    completedSteps.push('bar_credentials');
  } else {
    pendingSteps.push('bar_credentials');
  }

  if (profile.yearsExperience !== null) {
    completedSteps.push('experience');
  } else {
    pendingSteps.push('experience');
  }

  if (profile.jurisdictions.length > 0) {
    completedSteps.push('jurisdictions');
  } else {
    pendingSteps.push('jurisdictions');
  }

  if (profile.specialties.length > 0) {
    completedSteps.push('specialties');
  } else {
    pendingSteps.push('specialties');
  }

  if (profile.agreedToTermsAt) {
    completedSteps.push('terms_agreement');
  } else {
    pendingSteps.push('terms_agreement');
  }

  const totalSteps = completedSteps.length + pendingSteps.length;
  const percentComplete =
    totalSteps > 0 ? Math.round((completedSteps.length / totalSteps) * 100) : 0;

  return {
    status: profile.onboardingStatus,
    completedSteps,
    pendingSteps,
    percentComplete,
  };
}

/**
 * Get arbitrator profile with onboarding status
 */
export async function getArbitratorProfile(userId: string) {
  return prisma.arbitratorProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      userId: true,
      onboardingStatus: true,
      onboardedAt: true,
      agreedToTermsAt: true,
      barNumber: true,
      barState: true,
      isRetiredJudge: true,
      yearsExperience: true,
      lawSchool: true,
      graduationYear: true,
      biography: true,
      jurisdictions: true,
      specialties: true,
      maxCasesPerWeek: true,
      credentialStatus: true,
      credentialVerifiedAt: true,
      stripeConnectStatus: true,
      stripeConnectOnboardedAt: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * Check if user can become an arbitrator
 * (e.g., has completed identity verification)
 */
export async function canBecomeArbitrator(userId: string): Promise<{
  eligible: boolean;
  reason?: string;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      identityVerification: true,
    },
  });

  if (!user) {
    return { eligible: false, reason: 'User not found' };
  }

  // Check if identity is verified
  if (!user.identityVerification || user.identityVerification.status !== 'VERIFIED') {
    return {
      eligible: false,
      reason: 'Identity verification required before becoming an arbitrator',
    };
  }

  return { eligible: true };
}

/**
 * Get list of available jurisdictions for selection
 */
export function getAvailableJurisdictions(): Array<{ code: string; name: string }> {
  const stateNames: Record<string, string> = {
    AL: 'Alabama',
    AK: 'Alaska',
    AZ: 'Arizona',
    AR: 'Arkansas',
    CA: 'California',
    CO: 'Colorado',
    CT: 'Connecticut',
    DE: 'Delaware',
    DC: 'District of Columbia',
    FL: 'Florida',
    GA: 'Georgia',
    HI: 'Hawaii',
    ID: 'Idaho',
    IL: 'Illinois',
    IN: 'Indiana',
    IA: 'Iowa',
    KS: 'Kansas',
    KY: 'Kentucky',
    LA: 'Louisiana',
    ME: 'Maine',
    MD: 'Maryland',
    MA: 'Massachusetts',
    MI: 'Michigan',
    MN: 'Minnesota',
    MS: 'Mississippi',
    MO: 'Missouri',
    MT: 'Montana',
    NE: 'Nebraska',
    NV: 'Nevada',
    NH: 'New Hampshire',
    NJ: 'New Jersey',
    NM: 'New Mexico',
    NY: 'New York',
    NC: 'North Carolina',
    ND: 'North Dakota',
    OH: 'Ohio',
    OK: 'Oklahoma',
    OR: 'Oregon',
    PA: 'Pennsylvania',
    RI: 'Rhode Island',
    SC: 'South Carolina',
    SD: 'South Dakota',
    TN: 'Tennessee',
    TX: 'Texas',
    UT: 'Utah',
    VT: 'Vermont',
    VA: 'Virginia',
    WA: 'Washington',
    WV: 'West Virginia',
    WI: 'Wisconsin',
    WY: 'Wyoming',
  };

  return US_STATES.map((code) => ({
    code,
    name: stateNames[code] || code,
  }));
}

/**
 * Get list of available specialties for selection
 */
export function getAvailableSpecialties(): Array<{
  value: DisputeType;
  label: string;
  description: string;
}> {
  return [
    {
      value: 'CONTRACT',
      label: 'Contract Disputes',
      description: 'Breach of contract, contract interpretation, formation issues',
    },
    {
      value: 'PAYMENT',
      label: 'Payment Disputes',
      description: 'Non-payment, partial payment, payment terms disagreements',
    },
    {
      value: 'SERVICE',
      label: 'Service Disputes',
      description: 'Service quality, scope of work, professional services',
    },
    {
      value: 'GOODS',
      label: 'Goods Disputes',
      description: 'Product quality, delivery issues, warranty claims',
    },
    {
      value: 'OTHER',
      label: 'Other Disputes',
      description: 'General civil disputes not covered by other categories',
    },
  ];
}
