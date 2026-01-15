export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-muted/20">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]">
        {children}
      </div>
    </div>
  );
}
