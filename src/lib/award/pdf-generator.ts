/**
 * Award PDF Generator
 *
 * Generates professional PDF documents for finalized arbitration awards
 * using pdf-lib for document composition.
 */

import { createHash } from 'crypto';

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import type { FindingOfFact, AwardConclusionOfLaw } from './types';

/**
 * Input for PDF generation
 */
export interface AwardPdfInput {
  referenceNumber: string;
  caseReference: string;
  claimantName: string;
  respondentName: string;
  findingsOfFact: FindingOfFact[];
  conclusionsOfLaw: AwardConclusionOfLaw[];
  decision: string;
  awardAmount: number;
  prevailingParty: 'claimant' | 'respondent' | 'split';
  reasoning: string;
  arbitratorName: string;
  signedAt: Date;
  jurisdiction: string;
}

/**
 * Result from PDF generation
 */
export interface AwardPdfResult {
  pdfBuffer: Buffer;
  documentHash: string;
  pageCount: number;
}

// PDF Layout constants
const PAGE_WIDTH = 612; // Letter size
const PAGE_HEIGHT = 792;
const MARGIN_LEFT = 72;
const MARGIN_RIGHT = 72;
const MARGIN_TOP = 72;
const MARGIN_BOTTOM = 72;
const LINE_HEIGHT = 14;
const SECTION_SPACING = 24;
const TEXT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

/**
 * Generate a professional PDF document for the award
 */
export async function generateAwardPdf(
  input: AwardPdfInput
): Promise<AwardPdfResult> {
  const pdfDoc = await PDFDocument.create();

  // Embed fonts
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const timesRomanItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  // Create first page
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let yPosition = PAGE_HEIGHT - MARGIN_TOP;

  // Helper function to add a new page if needed
  const ensureSpace = (neededHeight: number) => {
    if (yPosition - neededHeight < MARGIN_BOTTOM) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      yPosition = PAGE_HEIGHT - MARGIN_TOP;
    }
  };

  // Helper function to draw centered text
  const drawCenteredText = (
    text: string,
    fontSize: number,
    font = timesRoman
  ) => {
    ensureSpace(fontSize + 4);
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    page.drawText(text, {
      x: (PAGE_WIDTH - textWidth) / 2,
      y: yPosition,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
    yPosition -= fontSize + 4;
  };

  // Helper function to draw left-aligned text with word wrap
  const drawWrappedText = (
    text: string,
    fontSize: number,
    font = timesRoman,
    indent = 0
  ) => {
    const words = text.split(' ');
    let line = '';
    const effectiveWidth = TEXT_WIDTH - indent;

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);

      if (testWidth > effectiveWidth && line) {
        ensureSpace(LINE_HEIGHT);
        page.drawText(line, {
          x: MARGIN_LEFT + indent,
          y: yPosition,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
        yPosition -= LINE_HEIGHT;
        line = word;
      } else {
        line = testLine;
      }
    }

    if (line) {
      ensureSpace(LINE_HEIGHT);
      page.drawText(line, {
        x: MARGIN_LEFT + indent,
        y: yPosition,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
      yPosition -= LINE_HEIGHT;
    }
  };

  // Helper function to draw a horizontal line
  const drawHorizontalLine = () => {
    ensureSpace(20);
    yPosition -= 10;
    page.drawLine({
      start: { x: MARGIN_LEFT, y: yPosition },
      end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: yPosition },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    });
    yPosition -= 10;
  };

  // ========================================
  // DOCUMENT HEADER
  // ========================================

  drawCenteredText('ARBITRATION AWARD', 18, timesRomanBold);
  yPosition -= 8;

  drawCenteredText(`Case No.: ${input.referenceNumber}`, 12, timesRoman);
  yPosition -= 4;

  drawHorizontalLine();

  // ========================================
  // CAPTION
  // ========================================

  yPosition -= 8;
  drawWrappedText(input.claimantName + ',', 12, timesRoman);
  drawWrappedText('Claimant,', 12, timesRomanItalic, 36);
  yPosition -= 8;

  drawCenteredText('v.', 12, timesRoman);
  yPosition -= 8;

  drawWrappedText(input.respondentName + ',', 12, timesRoman);
  drawWrappedText('Respondent.', 12, timesRomanItalic, 36);

  drawHorizontalLine();

  // ========================================
  // PROCEDURAL STATEMENT
  // ========================================

  yPosition -= 8;
  const proceduralText = `This arbitration arose from a dispute between ${input.claimantName} ("Claimant") and ${input.respondentName} ("Respondent") pursuant to the arbitration agreement between the parties. The arbitrator, having reviewed all evidence, statements, and arguments submitted by both parties, hereby issues this final and binding award.`;
  drawWrappedText(proceduralText, 11, timesRoman);

  yPosition -= SECTION_SPACING;

  // ========================================
  // FINDINGS OF FACT
  // ========================================

  drawCenteredText('FINDINGS OF FACT', 14, timesRomanBold);
  yPosition -= 12;

  for (const finding of input.findingsOfFact) {
    const basisLabel =
      finding.basis === 'undisputed'
        ? '(Undisputed)'
        : finding.basis === 'credibility'
          ? '(Based on credibility determination)'
          : '(Proven by preponderance of evidence)';

    const findingText = `${finding.number}. ${finding.finding} ${basisLabel}`;
    drawWrappedText(findingText, 11, timesRoman);

    if (finding.credibilityNote) {
      drawWrappedText(finding.credibilityNote, 10, timesRomanItalic, 24);
    }

    yPosition -= 8;
  }

  yPosition -= SECTION_SPACING / 2;
  drawHorizontalLine();

  // ========================================
  // CONCLUSIONS OF LAW
  // ========================================

  yPosition -= 8;
  drawCenteredText('CONCLUSIONS OF LAW', 14, timesRomanBold);
  yPosition -= 12;

  for (const conclusion of input.conclusionsOfLaw) {
    const conclusionText = `${conclusion.number}. ${conclusion.conclusion}`;
    drawWrappedText(conclusionText, 11, timesRoman);

    if (conclusion.legalBasis.length > 0) {
      const citations = conclusion.legalBasis.join('; ');
      drawWrappedText(`Legal Basis: ${citations}`, 10, timesRomanItalic, 24);
    }

    if (conclusion.supportingFindings.length > 0) {
      const refs = conclusion.supportingFindings
        .map((n) => `Finding No. ${n}`)
        .join(', ');
      drawWrappedText(`See ${refs}.`, 10, timesRomanItalic, 24);
    }

    yPosition -= 8;
  }

  yPosition -= SECTION_SPACING / 2;
  drawHorizontalLine();

  // ========================================
  // ORDER AND AWARD
  // ========================================

  yPosition -= 8;
  drawCenteredText('ORDER AND AWARD', 14, timesRomanBold);
  yPosition -= 12;

  // Split decision text into paragraphs and render
  const decisionParagraphs = input.decision.split('\n\n');
  for (const paragraph of decisionParagraphs) {
    if (paragraph.trim()) {
      drawWrappedText(paragraph.trim(), 11, timesRoman);
      yPosition -= 8;
    }
  }

  yPosition -= SECTION_SPACING / 2;
  drawHorizontalLine();

  // ========================================
  // SIGNATURE BLOCK
  // ========================================

  yPosition -= 16;

  const dateStr = input.signedAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  drawWrappedText(`DATED: ${dateStr}`, 11, timesRoman);
  yPosition -= 24;

  // Signature line
  page.drawLine({
    start: { x: MARGIN_LEFT, y: yPosition },
    end: { x: MARGIN_LEFT + 200, y: yPosition },
    thickness: 0.5,
    color: rgb(0, 0, 0),
  });
  yPosition -= 12;

  drawWrappedText(input.arbitratorName, 11, timesRoman);
  drawWrappedText('Arbitrator', 10, timesRomanItalic);
  yPosition -= 8;

  const signedTimeStr = input.signedAt.toISOString();
  drawWrappedText(
    `Digitally signed on ${signedTimeStr}`,
    9,
    timesRomanItalic
  );

  yPosition -= SECTION_SPACING;
  drawHorizontalLine();

  // ========================================
  // FOOTER / LEGAL NOTICES
  // ========================================

  yPosition -= 8;

  const legalNotice = `This award is final and binding upon the parties pursuant to the arbitration agreement and applicable law. This award may be entered in any court having jurisdiction thereof.`;
  drawWrappedText(legalNotice, 10, timesRoman);

  yPosition -= 12;

  drawWrappedText(`Jurisdiction: ${input.jurisdiction}`, 9, timesRomanItalic);
  drawWrappedText(
    `Original Case Reference: ${input.caseReference}`,
    9,
    timesRomanItalic
  );

  // Serialize PDF to bytes
  const pdfBytes = await pdfDoc.save();
  const pdfBuffer = Buffer.from(pdfBytes);

  // Calculate SHA-256 hash
  const documentHash = createHash('sha256').update(pdfBuffer).digest('hex');

  return {
    pdfBuffer,
    documentHash,
    pageCount: pdfDoc.getPageCount(),
  };
}

/**
 * Format currency for display in PDF
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Generate a unique award reference number
 */
export function generateReferenceNumber(sequence: number): string {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const seqStr = String(sequence).padStart(5, '0');
  return `AWD-${dateStr}-${seqStr}`;
}

/**
 * Input for certificate generation
 */
export interface AwardCertificateInput {
  referenceNumber: string;
  caseReference: string;
  claimantName: string;
  respondentName: string;
  awardAmount: number | null;
  prevailingParty: 'CLAIMANT' | 'RESPONDENT' | 'SPLIT';
  arbitratorName: string;
  signedAt: Date;
  issuedAt: Date;
  jurisdiction: string;
  documentHash: string;
  signatureAlgorithm: string;
  certificateFingerprint: string;
  timestampGranted: boolean;
  timestampTime: Date | null;
}

/**
 * Result from certificate generation
 */
export interface AwardCertificateResult {
  pdfBuffer: Buffer;
  documentHash: string;
}

/**
 * Generate an award certificate (summary document for verification)
 *
 * This is a one-page summary certificate that can be used to verify
 * the authenticity of an award without sharing the full document.
 */
export async function generateAwardCertificate(
  input: AwardCertificateInput
): Promise<AwardCertificateResult> {
  const pdfDoc = await PDFDocument.create();

  // Embed fonts
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Create single page
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let yPosition = PAGE_HEIGHT - MARGIN_TOP;

  // Helper function to draw centered text
  const drawCentered = (
    text: string,
    fontSize: number,
    font = helvetica
  ) => {
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    page.drawText(text, {
      x: (PAGE_WIDTH - textWidth) / 2,
      y: yPosition,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
    yPosition -= fontSize + 6;
  };

  // Helper function to draw labeled value
  const drawLabelValue = (
    label: string,
    value: string,
    fontSize: number = 11
  ) => {
    page.drawText(label, {
      x: MARGIN_LEFT,
      y: yPosition,
      size: fontSize,
      font: helveticaBold,
      color: rgb(0.3, 0.3, 0.3),
    });
    page.drawText(value, {
      x: MARGIN_LEFT + 180,
      y: yPosition,
      size: fontSize,
      font: helvetica,
      color: rgb(0, 0, 0),
    });
    yPosition -= fontSize + 8;
  };

  // Helper function to draw a horizontal line
  const drawLine = () => {
    yPosition -= 8;
    page.drawLine({
      start: { x: MARGIN_LEFT, y: yPosition },
      end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: yPosition },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    yPosition -= 16;
  };

  // ========================================
  // HEADER
  // ========================================

  // Border rectangle
  page.drawRectangle({
    x: MARGIN_LEFT - 10,
    y: MARGIN_BOTTOM - 10,
    width: TEXT_WIDTH + 20,
    height: PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM + 20,
    borderColor: rgb(0.2, 0.4, 0.6),
    borderWidth: 2,
  });

  yPosition -= 10;
  drawCentered('CERTIFICATE OF ARBITRATION AWARD', 18, helveticaBold);
  yPosition -= 10;
  drawCentered('SettleRight Arbitration Platform', 11, helvetica);
  yPosition -= 20;

  drawLine();

  // ========================================
  // AWARD DETAILS
  // ========================================

  drawCentered('AWARD DETAILS', 12, helveticaBold);
  yPosition -= 16;

  drawLabelValue('Award Reference:', input.referenceNumber);
  drawLabelValue('Case Reference:', input.caseReference);
  drawLabelValue('Jurisdiction:', input.jurisdiction);

  yPosition -= 8;

  drawLabelValue('Claimant:', input.claimantName);
  drawLabelValue('Respondent:', input.respondentName);

  yPosition -= 8;

  const prevailingPartyDisplay =
    input.prevailingParty === 'CLAIMANT'
      ? input.claimantName
      : input.prevailingParty === 'RESPONDENT'
        ? input.respondentName
        : 'Split Decision';
  drawLabelValue('Prevailing Party:', prevailingPartyDisplay);

  if (input.awardAmount !== null) {
    drawLabelValue('Award Amount:', formatCurrency(input.awardAmount));
  }

  drawLine();

  // ========================================
  // SIGNATURE DETAILS
  // ========================================

  drawCentered('SIGNATURE INFORMATION', 12, helveticaBold);
  yPosition -= 16;

  drawLabelValue('Arbitrator:', input.arbitratorName);
  drawLabelValue(
    'Signed At:',
    input.signedAt.toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'long',
    })
  );
  drawLabelValue(
    'Issued At:',
    input.issuedAt.toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'long',
    })
  );

  yPosition -= 8;

  drawLabelValue('Signature Algorithm:', input.signatureAlgorithm);
  drawLabelValue('Certificate Fingerprint:', input.certificateFingerprint.slice(0, 32) + '...');

  if (input.timestampGranted && input.timestampTime) {
    drawLabelValue(
      'RFC 3161 Timestamp:',
      input.timestampTime.toLocaleString('en-US', {
        dateStyle: 'full',
        timeStyle: 'long',
      })
    );
  } else {
    drawLabelValue('RFC 3161 Timestamp:', 'Not available');
  }

  drawLine();

  // ========================================
  // DOCUMENT INTEGRITY
  // ========================================

  drawCentered('DOCUMENT INTEGRITY', 12, helveticaBold);
  yPosition -= 16;

  drawLabelValue('Document Hash (SHA-256):', '');
  yPosition += 4;

  // Draw hash in monospace-style (smaller, full width)
  const hashLine1 = input.documentHash.slice(0, 32);
  const hashLine2 = input.documentHash.slice(32);

  page.drawText(hashLine1, {
    x: MARGIN_LEFT + 20,
    y: yPosition,
    size: 10,
    font: helvetica,
    color: rgb(0.2, 0.2, 0.2),
  });
  yPosition -= 14;
  page.drawText(hashLine2, {
    x: MARGIN_LEFT + 20,
    y: yPosition,
    size: 10,
    font: helvetica,
    color: rgb(0.2, 0.2, 0.2),
  });
  yPosition -= 24;

  drawLine();

  // ========================================
  // VERIFICATION NOTICE
  // ========================================

  yPosition -= 8;
  const verificationNotice = 'This certificate confirms the issuance of a binding arbitration award. The award document bears a digital signature and RFC 3161 timestamp that can be independently verified. The document hash above can be used to verify the integrity of the original award document.';

  const words = verificationNotice.split(' ');
  let line = '';
  const fontSize = 9;
  const effectiveWidth = TEXT_WIDTH - 40;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const testWidth = helvetica.widthOfTextAtSize(testLine, fontSize);

    if (testWidth > effectiveWidth && line) {
      page.drawText(line, {
        x: MARGIN_LEFT + 20,
        y: yPosition,
        size: fontSize,
        font: helvetica,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPosition -= fontSize + 4;
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) {
    page.drawText(line, {
      x: MARGIN_LEFT + 20,
      y: yPosition,
      size: fontSize,
      font: helvetica,
      color: rgb(0.3, 0.3, 0.3),
    });
    yPosition -= fontSize + 4;
  }

  yPosition -= 24;

  // Verification URL
  drawCentered('Verify at: https://settleright.ai/verify', 10, helvetica);

  // ========================================
  // FOOTER
  // ========================================

  // Generated timestamp at bottom
  const generatedAt = new Date().toISOString();
  page.drawText(`Certificate generated: ${generatedAt}`, {
    x: MARGIN_LEFT,
    y: MARGIN_BOTTOM + 10,
    size: 8,
    font: helvetica,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Serialize PDF to bytes
  const pdfBytes = await pdfDoc.save();
  const pdfBuffer = Buffer.from(pdfBytes);

  // Calculate SHA-256 hash
  const documentHash = createHash('sha256').update(pdfBuffer).digest('hex');

  return {
    pdfBuffer,
    documentHash,
  };
}
