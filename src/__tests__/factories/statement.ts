/**
 * Statement Factory
 *
 * Creates mock Statement objects for testing.
 */

import { generateId } from './utils';

export interface StatementFactoryOptions {
  id?: string;
  caseId?: string;
  userId?: string;
  type?: string;
  content?: string;
  isRebuttal?: boolean;
  version?: number;
  createdAt?: Date;
}

/**
 * Create a mock Statement
 */
export function createStatement(options: StatementFactoryOptions = {}) {
  const id = options.id ?? generateId();
  const createdAt = options.createdAt ?? new Date();
  const type = options.type ?? 'CLAIMANT';

  const defaultContent =
    type === 'CLAIMANT'
      ? 'CLAIMANT STATEMENT OF CLAIM: This is the claimant statement...'
      : 'RESPONDENT STATEMENT OF DEFENSE: This is the respondent statement...';

  return {
    id,
    caseId: options.caseId ?? generateId(),
    userId: options.userId ?? generateId(),
    type,
    content: options.content ?? defaultContent,
    isRebuttal: options.isRebuttal ?? false,
    version: options.version ?? 1,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  };
}

export const createClaimantStatement = (options: StatementFactoryOptions = {}) =>
  createStatement({ ...options, type: 'CLAIMANT' });

export const createRespondentStatement = (options: StatementFactoryOptions = {}) =>
  createStatement({ ...options, type: 'RESPONDENT' });

export const createClaimantRebuttal = (options: StatementFactoryOptions = {}) =>
  createStatement({ ...options, type: 'CLAIMANT', isRebuttal: true });

export const createRespondentRebuttal = (options: StatementFactoryOptions = {}) =>
  createStatement({ ...options, type: 'RESPONDENT', isRebuttal: true });

/**
 * Create a complete set of statements for a case
 */
export function createStatementSet(caseId: string, claimantId: string, respondentId: string) {
  return [
    createClaimantStatement({ caseId, userId: claimantId }),
    createRespondentStatement({ caseId, userId: respondentId }),
    createClaimantRebuttal({ caseId, userId: claimantId }),
    createRespondentRebuttal({ caseId, userId: respondentId }),
  ];
}
