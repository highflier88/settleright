import { remark } from 'remark';
import html from 'remark-html';

interface MarkdownRendererProps {
  content: string;
}

export async function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const processedContent = await remark().use(html).process(content);
  const htmlContent = processedContent.toString();

  return (
    <article
      className="prose prose-slate dark:prose-invert prose-headings:scroll-mt-20
        prose-h1:text-3xl
        prose-h1:font-bold prose-h1:mb-4 prose-h2:text-2xl
        prose-h2:font-semibold prose-h2:mt-8 prose-h2:mb-4 prose-h2:border-b prose-h2:pb-2 prose-h3:text-xl
        prose-h3:font-medium prose-h3:mt-6 prose-h3:mb-3 prose-p:text-base
        prose-p:leading-7 prose-p:my-4 prose-ul:my-4
        prose-ul:list-disc prose-ul:pl-6 prose-ol:my-4
        prose-ol:list-decimal prose-ol:pl-6 prose-li:my-1
        prose-blockquote:border-l-4
        prose-blockquote:border-amber-500 prose-blockquote:bg-amber-50 dark:prose-blockquote:bg-amber-950/20 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:my-4 prose-blockquote:not-italic prose-strong:font-semibold
        prose-a:text-primary
        prose-a:underline prose-a:underline-offset-2 prose-hr:my-8
        prose-hr:border-border prose-table:border-collapse
        prose-table:w-full prose-th:border
        prose-th:border-border prose-th:px-4 prose-th:py-2 prose-th:bg-muted prose-td:border
        prose-td:border-border prose-td:px-4 prose-td:py-2 print:prose-sm
        max-w-none"
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}
