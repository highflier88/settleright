'use client';

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      Print this document
    </button>
  );
}
