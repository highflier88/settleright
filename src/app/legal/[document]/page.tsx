import { readFile } from 'fs/promises';
import path from 'path';

import { notFound } from 'next/navigation';

import matter from 'gray-matter';
import { FileText, Calendar, Hash } from 'lucide-react';
import { type Metadata } from 'next';

import { MarkdownRenderer } from '@/components/legal/markdown-renderer';
import { PrintButton } from '@/components/legal/print-button';


// Document configuration mapping
const LEGAL_DOCUMENTS = {
  'terms-of-service': {
    file: 'terms-of-service.md',
    title: 'Terms of Service',
    description: 'Terms of Service for Settleright.ai arbitration platform',
  },
  'privacy-policy': {
    file: 'privacy-policy.md',
    title: 'Privacy Policy',
    description: 'Privacy Policy for Settleright.ai',
  },
  'procedural-rules': {
    file: 'procedural-rules.md',
    title: 'Arbitration Rules',
    description: 'Procedural rules governing arbitration on Settleright.ai',
  },
  'submission-agreement': {
    file: 'submission-agreement.md',
    title: 'Submission Agreement',
    description: 'Binding arbitration submission agreement template',
  },
} as const;

type DocumentSlug = keyof typeof LEGAL_DOCUMENTS;

// Generate static params for all legal documents
export function generateStaticParams() {
  return Object.keys(LEGAL_DOCUMENTS).map((document) => ({
    document,
  }));
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ document: string }>;
}): Promise<Metadata> {
  const { document } = await params;
  const config = LEGAL_DOCUMENTS[document as DocumentSlug];

  if (!config) {
    return {
      title: 'Document Not Found',
    };
  }

  return {
    title: `${config.title} | Settleright.ai`,
    description: config.description,
  };
}

async function getDocumentContent(slug: string) {
  const config = LEGAL_DOCUMENTS[slug as DocumentSlug];

  if (!config) {
    return null;
  }

  try {
    const filePath = path.join(process.cwd(), 'legal', config.file);
    const fileContent = await readFile(filePath, 'utf-8');

    // Parse frontmatter if present
    const { content, data } = matter(fileContent) as { content: string; data: Record<string, unknown> };

    // Extract version from content if not in frontmatter
    let version: string = (data.version as string | undefined) || '1.0';
    const versionMatch = content.match(/\*\*Version:\*\*\s*(\d+\.\d+)/);
    if (versionMatch && versionMatch[1]) {
      version = versionMatch[1];
    }

    // Extract last updated from content if not in frontmatter
    let lastUpdated: string | null = (data.lastUpdated as string | undefined) || (data['last-updated'] as string | undefined) || null;
    const lastUpdatedMatch = content.match(
      /\*\*Last Updated:\*\*\s*([^\n*]+)/
    );
    if (lastUpdatedMatch && lastUpdatedMatch[1] && lastUpdatedMatch[1].trim() !== '[INSERT DATE]') {
      lastUpdated = lastUpdatedMatch[1].trim();
    }

    return {
      content,
      title: config.title,
      description: config.description,
      version,
      lastUpdated,
    };
  } catch {
    return null;
  }
}

export default async function LegalDocumentPage({
  params,
}: {
  params: Promise<{ document: string }>;
}) {
  const { document } = await params;
  const doc = await getDocumentContent(document);

  if (!doc) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Document header */}
      <div className="border-b pb-6">
        <h1 className="text-3xl font-bold tracking-tight">{doc.title}</h1>
        <p className="mt-2 text-muted-foreground">{doc.description}</p>

        {/* Metadata badges */}
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Hash className="h-4 w-4" />
            <span>Version {doc.version}</span>
          </div>
          {doc.lastUpdated && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>Last updated: {doc.lastUpdated}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            <span>Legal Document</span>
          </div>
        </div>
      </div>

      {/* Document content */}
      <MarkdownRenderer content={doc.content} />

      {/* Print button */}
      <div className="mt-8 flex justify-end border-t pt-6 print:hidden">
        <PrintButton />
      </div>
    </div>
  );
}
