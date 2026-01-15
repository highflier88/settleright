'use client';

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      Print this document
    </button>
  );
}
