/**
 * Enforcement Document Generators
 *
 * Generates PDF documents needed for enforcing arbitration awards:
 * - Proof of Service Certificate
 * - Arbitrator Credentials Document
 * - Procedural Compliance Certificate
 * - Filing Instructions
 */

import { createHash } from 'crypto';

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import type {
  ProofOfServiceData,
  ArbitratorCredentialsData,
  ProceduralComplianceData,
  FilingInstructionsData,
  EnforcementDocument,
} from './types';

// PDF Layout constants
const PAGE_WIDTH = 612; // Letter size
const PAGE_HEIGHT = 792;
const MARGIN = 72;
const TEXT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 14;

/**
 * Generate Proof of Service Certificate
 */
export async function generateProofOfService(
  data: ProofOfServiceData
): Promise<EnforcementDocument> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  // Helper functions
  const drawCentered = (text: string, fontSize: number, font = helvetica) => {
    const width = font.widthOfTextAtSize(text, fontSize);
    page.drawText(text, {
      x: (PAGE_WIDTH - width) / 2,
      y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
    y -= fontSize + 8;
  };

  const drawText = (text: string, fontSize: number, font = helvetica, indent = 0) => {
    page.drawText(text, {
      x: MARGIN + indent,
      y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
    y -= fontSize + 6;
  };

  const drawLine = () => {
    y -= 8;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 16;
  };

  // Title
  drawCentered('PROOF OF SERVICE', 18, helveticaBold);
  drawCentered('CERTIFICATE OF DELIVERY OF ARBITRATION AWARD', 12, helvetica);
  y -= 16;
  drawLine();

  // Award Information
  drawText('AWARD INFORMATION', 12, helveticaBold);
  y -= 8;
  drawText(`Award Reference: ${data.awardReference}`, 11);
  drawText(`Case Reference: ${data.caseReference}`, 11);
  drawText(`Award Issued: ${data.awardIssuedAt.toLocaleDateString('en-US', { dateStyle: 'full' })}`, 11);
  drawText(`Platform: ${data.platformName}`, 11);
  y -= 8;
  drawLine();

  // Claimant Service
  drawText('SERVICE TO CLAIMANT', 12, helveticaBold);
  y -= 8;
  drawText(`Name: ${data.claimant.name}`, 11);
  drawText(`Email: ${data.claimant.email}`, 11);
  if (data.claimant.notifiedAt) {
    drawText(`Served On: ${data.claimant.notifiedAt.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'long' })}`, 11);
    drawText('Service Status: COMPLETED', 11, helveticaBold);
  } else {
    drawText('Service Status: PENDING', 11);
  }
  y -= 8;
  drawLine();

  // Respondent Service
  drawText('SERVICE TO RESPONDENT', 12, helveticaBold);
  y -= 8;
  drawText(`Name: ${data.respondent.name}`, 11);
  drawText(`Email: ${data.respondent.email}`, 11);
  if (data.respondent.notifiedAt) {
    drawText(`Served On: ${data.respondent.notifiedAt.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'long' })}`, 11);
    drawText('Service Status: COMPLETED', 11, helveticaBold);
  } else {
    drawText('Service Status: PENDING', 11);
  }
  y -= 8;
  drawLine();

  // Delivery Method
  drawText('METHOD OF SERVICE', 12, helveticaBold);
  y -= 8;
  const methodText = data.deliveryMethod === 'EMAIL'
    ? 'Electronic mail to the email address on file'
    : data.deliveryMethod === 'IN_APP'
      ? 'In-app notification through the arbitration platform'
      : 'Electronic mail and in-app notification';
  drawText(methodText, 11);
  y -= 16;

  // Certification
  drawLine();
  drawText('CERTIFICATION', 12, helveticaBold);
  y -= 8;

  const certText = `I hereby certify that a true and correct copy of the Arbitration Award referenced above was served upon the parties named herein by the method indicated. This service was conducted through the ${data.platformName} platform, and records of delivery are maintained in the platform's audit logs.`;

  // Word wrap the certification text
  const words = certText.split(' ');
  let line = '';
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const width = helvetica.widthOfTextAtSize(testLine, 10);
    if (width > TEXT_WIDTH && line) {
      page.drawText(line, { x: MARGIN, y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
      y -= LINE_HEIGHT;
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) {
    page.drawText(line, { x: MARGIN, y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    y -= LINE_HEIGHT;
  }

  y -= 24;
  drawText(`Generated: ${new Date().toISOString()}`, 9);

  // Serialize
  const pdfBytes = await pdfDoc.save();
  const buffer = Buffer.from(pdfBytes);
  const hash = createHash('sha256').update(buffer).digest('hex');

  return {
    type: 'PROOF_OF_SERVICE',
    name: 'Proof of Service Certificate',
    fileName: `${data.awardReference}-proof-of-service.pdf`,
    contentType: 'application/pdf',
    buffer,
    hash,
  };
}

/**
 * Generate Arbitrator Credentials Document
 */
export async function generateArbitratorCredentials(
  data: ArbitratorCredentialsData
): Promise<EnforcementDocument> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const drawCentered = (text: string, fontSize: number, font = helvetica) => {
    const width = font.widthOfTextAtSize(text, fontSize);
    page.drawText(text, { x: (PAGE_WIDTH - width) / 2, y, size: fontSize, font, color: rgb(0, 0, 0) });
    y -= fontSize + 8;
  };

  const drawText = (text: string, fontSize: number, font = helvetica) => {
    page.drawText(text, { x: MARGIN, y, size: fontSize, font, color: rgb(0, 0, 0) });
    y -= fontSize + 6;
  };

  const drawLabelValue = (label: string, value: string) => {
    page.drawText(label, { x: MARGIN, y, size: 10, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(value, { x: MARGIN + 160, y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    y -= 16;
  };

  const drawLine = () => {
    y -= 8;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= 16;
  };

  // Title
  drawCentered('ARBITRATOR CREDENTIALS', 18, helveticaBold);
  drawCentered('CERTIFICATE OF QUALIFICATION', 12, helvetica);
  y -= 16;
  drawLine();

  // Case Information
  drawText('CASE INFORMATION', 12, helveticaBold);
  y -= 8;
  drawLabelValue('Award Reference:', data.awardReference);
  drawLabelValue('Case Reference:', data.caseReference);
  drawLabelValue('Jurisdiction:', data.jurisdiction);
  drawLine();

  // Arbitrator Information
  drawText('ARBITRATOR INFORMATION', 12, helveticaBold);
  y -= 8;
  drawLabelValue('Name:', data.arbitrator.name);
  drawLabelValue('Email:', data.arbitrator.email);

  if (data.arbitrator.barNumber && data.arbitrator.barState) {
    drawLabelValue('Bar Number:', data.arbitrator.barNumber);
    drawLabelValue('Bar State:', data.arbitrator.barState);
  }

  if (data.arbitrator.isRetiredJudge) {
    drawLabelValue('Status:', 'Retired Judge');
  }

  if (data.arbitrator.yearsExperience) {
    drawLabelValue('Years of Experience:', `${data.arbitrator.yearsExperience} years`);
  }

  if (data.arbitrator.lawSchool) {
    drawLabelValue('Law School:', data.arbitrator.lawSchool);
    if (data.arbitrator.graduationYear) {
      drawLabelValue('Graduation Year:', data.arbitrator.graduationYear.toString());
    }
  }

  if (data.arbitrator.jurisdictions.length > 0) {
    drawLabelValue('Licensed Jurisdictions:', data.arbitrator.jurisdictions.join(', '));
  }

  drawLine();

  // Verification Status
  drawText('VERIFICATION STATUS', 12, helveticaBold);
  y -= 8;

  if (data.arbitrator.credentialVerifiedAt) {
    drawLabelValue('Credentials Verified:', 'YES');
    drawLabelValue('Verified On:', data.arbitrator.credentialVerifiedAt.toLocaleDateString('en-US', { dateStyle: 'full' }));
  } else {
    drawLabelValue('Credentials Verified:', 'PENDING');
  }

  if (data.arbitrator.onboardedAt) {
    drawLabelValue('Platform Onboarded:', data.arbitrator.onboardedAt.toLocaleDateString('en-US', { dateStyle: 'full' }));
  }

  drawLine();

  // Assignment Details
  drawText('CASE ASSIGNMENT', 12, helveticaBold);
  y -= 8;
  drawLabelValue('Assigned On:', data.assignedAt.toLocaleDateString('en-US', { dateStyle: 'full' }));
  if (data.reviewCompletedAt) {
    drawLabelValue('Review Completed:', data.reviewCompletedAt.toLocaleDateString('en-US', { dateStyle: 'full' }));
  }
  drawLabelValue('Award Signed:', data.signedAt.toLocaleDateString('en-US', { dateStyle: 'full' }));

  y -= 16;
  drawLine();

  // Certification
  drawText('CERTIFICATION', 11, helveticaBold);
  y -= 8;

  const certText = `This document certifies that the above-named arbitrator was qualified and authorized to serve as arbitrator in the referenced case. The arbitrator's credentials were verified by the platform prior to case assignment, and the arbitrator has executed the award in accordance with applicable arbitration rules and procedures.`;

  const words = certText.split(' ');
  let line = '';
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const width = helvetica.widthOfTextAtSize(testLine, 9);
    if (width > TEXT_WIDTH && line) {
      page.drawText(line, { x: MARGIN, y, size: 9, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
      y -= 12;
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) {
    page.drawText(line, { x: MARGIN, y, size: 9, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
  }

  y -= 24;
  page.drawText(`Generated: ${new Date().toISOString()}`, { x: MARGIN, y, size: 8, font: helvetica, color: rgb(0.5, 0.5, 0.5) });

  const pdfBytes = await pdfDoc.save();
  const buffer = Buffer.from(pdfBytes);
  const hash = createHash('sha256').update(buffer).digest('hex');

  return {
    type: 'ARBITRATOR_CREDENTIALS',
    name: 'Arbitrator Credentials Certificate',
    fileName: `${data.awardReference}-arbitrator-credentials.pdf`,
    contentType: 'application/pdf',
    buffer,
    hash,
  };
}

/**
 * Generate Procedural Compliance Certificate
 */
export async function generateProceduralCompliance(
  data: ProceduralComplianceData
): Promise<EnforcementDocument> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const drawCentered = (text: string, fontSize: number, font = helvetica) => {
    const width = font.widthOfTextAtSize(text, fontSize);
    page.drawText(text, { x: (PAGE_WIDTH - width) / 2, y, size: fontSize, font, color: rgb(0, 0, 0) });
    y -= fontSize + 8;
  };

  const drawText = (text: string, fontSize: number, font = helvetica) => {
    page.drawText(text, { x: MARGIN, y, size: fontSize, font, color: rgb(0, 0, 0) });
    y -= fontSize + 6;
  };

  const drawCheckItem = (text: string, checked: boolean) => {
    const checkmark = checked ? '✓' : '✗';
    const color = checked ? rgb(0, 0.5, 0) : rgb(0.7, 0, 0);
    page.drawText(checkmark, { x: MARGIN, y, size: 12, font: helvetica, color });
    page.drawText(text, { x: MARGIN + 20, y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    y -= 16;
  };

  const drawLine = () => {
    y -= 8;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= 16;
  };

  // Title
  drawCentered('PROCEDURAL COMPLIANCE CERTIFICATE', 18, helveticaBold);
  drawCentered('CERTIFICATION OF ARBITRATION PROCEDURES', 12, helvetica);
  y -= 16;
  drawLine();

  // Case Information
  drawText('CASE INFORMATION', 12, helveticaBold);
  y -= 8;
  drawText(`Award Reference: ${data.awardReference}`, 10);
  drawText(`Case Reference: ${data.caseReference}`, 10);
  drawText(`Jurisdiction: ${data.jurisdiction}`, 10);
  drawText(`Claimant: ${data.claimantName}`, 10);
  drawText(`Respondent: ${data.respondentName}`, 10);
  drawLine();

  // Timeline
  drawText('PROCEDURAL TIMELINE', 12, helveticaBold);
  y -= 8;
  drawText(`Case Initiated: ${data.caseCreatedAt.toLocaleDateString('en-US', { dateStyle: 'full' })}`, 10);
  if (data.agreementSignedAt) {
    drawText(`Agreement Signed: ${data.agreementSignedAt.toLocaleDateString('en-US', { dateStyle: 'full' })}`, 10);
  }
  if (data.analysisCompletedAt) {
    drawText(`Analysis Completed: ${data.analysisCompletedAt.toLocaleDateString('en-US', { dateStyle: 'full' })}`, 10);
  }
  drawText(`Award Issued: ${data.awardIssuedAt.toLocaleDateString('en-US', { dateStyle: 'full' })}`, 10);
  drawLine();

  // Compliance Checklist
  drawText('PROCEDURAL COMPLIANCE CHECKLIST', 12, helveticaBold);
  y -= 12;

  drawCheckItem('Both parties agreed to binding arbitration', data.bothPartiesAgreedToArbitrate);
  drawCheckItem('Both parties had opportunity to submit evidence', data.bothPartiesHadOpportunityToSubmitEvidence);
  drawCheckItem('Both parties had opportunity to submit statements', data.bothPartiesHadOpportunityToSubmitStatements);
  drawCheckItem('Neutral arbitrator was assigned', data.neutralArbitratorAssigned);
  drawCheckItem('Award based on evidence in the record', data.awardBasedOnRecordEvidence);
  drawCheckItem('Award issued within required timeframe', data.awardIssuedWithinTimeframe);

  drawLine();

  // Platform Information
  drawText('PLATFORM INFORMATION', 12, helveticaBold);
  y -= 8;
  drawText(`Platform: ${data.platformName}`, 10);
  drawText(`Procedural Rules Version: ${data.platformRulesVersion}`, 10);
  y -= 16;

  // Certification
  drawLine();
  drawText('CERTIFICATION', 11, helveticaBold);
  y -= 8;

  const certText = `This certificate confirms that the arbitration proceedings referenced above were conducted in accordance with the platform's procedural rules and applicable arbitration law. All parties were afforded due process, including notice, opportunity to be heard, and the right to present evidence. The arbitration was conducted by a qualified neutral arbitrator whose decision was based solely on the evidence and arguments presented.`;

  const words = certText.split(' ');
  let line = '';
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const width = helvetica.widthOfTextAtSize(testLine, 9);
    if (width > TEXT_WIDTH && line) {
      page.drawText(line, { x: MARGIN, y, size: 9, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
      y -= 12;
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) {
    page.drawText(line, { x: MARGIN, y, size: 9, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
  }

  y -= 24;
  page.drawText(`Generated: ${new Date().toISOString()}`, { x: MARGIN, y, size: 8, font: helvetica, color: rgb(0.5, 0.5, 0.5) });

  const pdfBytes = await pdfDoc.save();
  const buffer = Buffer.from(pdfBytes);
  const hash = createHash('sha256').update(buffer).digest('hex');

  return {
    type: 'PROCEDURAL_COMPLIANCE',
    name: 'Procedural Compliance Certificate',
    fileName: `${data.awardReference}-procedural-compliance.pdf`,
    contentType: 'application/pdf',
    buffer,
    hash,
  };
}

/**
 * Generate Filing Instructions Document
 */
export async function generateFilingInstructions(
  data: FilingInstructionsData
): Promise<EnforcementDocument> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  const drawCentered = (text: string, fontSize: number, font = helvetica) => {
    ensureSpace(fontSize + 10);
    const width = font.widthOfTextAtSize(text, fontSize);
    page.drawText(text, { x: (PAGE_WIDTH - width) / 2, y, size: fontSize, font, color: rgb(0, 0, 0) });
    y -= fontSize + 8;
  };

  const drawText = (text: string, fontSize: number, font = helvetica, indent = 0) => {
    ensureSpace(fontSize + 6);
    page.drawText(text, { x: MARGIN + indent, y, size: fontSize, font, color: rgb(0, 0, 0) });
    y -= fontSize + 6;
  };

  const drawWrappedText = (text: string, fontSize: number, font = helvetica, indent = 0) => {
    const effectiveWidth = TEXT_WIDTH - indent;
    const words = text.split(' ');
    let line = '';
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, fontSize);
      if (width > effectiveWidth && line) {
        ensureSpace(fontSize + 4);
        page.drawText(line, { x: MARGIN + indent, y, size: fontSize, font, color: rgb(0, 0, 0) });
        y -= fontSize + 4;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      ensureSpace(fontSize + 4);
      page.drawText(line, { x: MARGIN + indent, y, size: fontSize, font, color: rgb(0, 0, 0) });
      y -= fontSize + 4;
    }
  };

  const drawLine = () => {
    ensureSpace(24);
    y -= 8;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= 16;
  };

  // Title
  drawCentered('FILING INSTRUCTIONS', 18, helveticaBold);
  drawCentered('Guide to Confirming Your Arbitration Award', 12, helvetica);
  y -= 16;
  drawLine();

  // Award Summary
  drawText('AWARD SUMMARY', 12, helveticaBold);
  y -= 8;
  drawText(`Award Reference: ${data.awardReference}`, 10);
  drawText(`Case Reference: ${data.caseReference}`, 10);
  drawText(`Jurisdiction: ${data.jurisdiction}`, 10);
  drawText(`Claimant: ${data.claimantName}`, 10);
  drawText(`Respondent: ${data.respondentName}`, 10);
  if (data.awardAmount) {
    drawText(`Award Amount: $${data.awardAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 10);
  }
  const prevailingText = data.prevailingParty === 'CLAIMANT'
    ? data.claimantName
    : data.prevailingParty === 'RESPONDENT'
      ? data.respondentName
      : 'Split Decision';
  drawText(`Prevailing Party: ${prevailingText}`, 10);
  drawLine();

  // Court Information
  drawText('WHERE TO FILE', 12, helveticaBold);
  y -= 8;
  drawText(`Court: ${data.courtName}`, 10);
  drawWrappedText(`Address: ${data.courtAddress}`, 10);
  drawText(`Estimated Filing Fee: ${data.filingFeeEstimate}`, 10);
  drawText(`Filing Deadline: ${data.filingDeadline}`, 10, helveticaBold);
  drawLine();

  // Required Documents
  drawText('REQUIRED DOCUMENTS', 12, helveticaBold);
  y -= 8;
  for (let i = 0; i < data.requiredDocuments.length; i++) {
    drawText(`${i + 1}. ${data.requiredDocuments[i]}`, 10, helvetica, 10);
  }
  drawLine();

  // Filing Procedure
  drawText('FILING PROCEDURE', 12, helveticaBold);
  y -= 8;
  for (const step of data.filingProcedure) {
    drawWrappedText(step, 10, helvetica, 10);
    y -= 4;
  }
  drawLine();

  // Additional Notes
  if (data.additionalNotes.length > 0) {
    drawText('IMPORTANT NOTES', 12, helveticaBold);
    y -= 8;
    for (const note of data.additionalNotes) {
      drawText('•', 10, helvetica);
      y += 10; // Move back up to align bullet
      drawWrappedText(note, 10, helvetica, 15);
      y -= 4;
    }
    drawLine();
  }

  // Disclaimer
  y -= 8;
  const disclaimer = 'DISCLAIMER: This document provides general guidance only and does not constitute legal advice. Filing requirements may vary and are subject to change. Consult with a licensed attorney in your jurisdiction for specific legal advice regarding your situation.';
  drawWrappedText(disclaimer, 8, helvetica);

  y -= 16;
  page.drawText(`Generated: ${new Date().toISOString()}`, { x: MARGIN, y, size: 8, font: helvetica, color: rgb(0.5, 0.5, 0.5) });

  const pdfBytes = await pdfDoc.save();
  const buffer = Buffer.from(pdfBytes);
  const hash = createHash('sha256').update(buffer).digest('hex');

  return {
    type: 'FILING_INSTRUCTIONS',
    name: 'Filing Instructions',
    fileName: `${data.awardReference}-filing-instructions.pdf`,
    contentType: 'application/pdf',
    buffer,
    hash,
  };
}
