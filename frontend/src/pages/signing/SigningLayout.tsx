import { Toaster } from '@/components/ui/sonner';

interface SigningLayoutProps {
  children: React.ReactNode;
}

export function SigningLayout({ children }: SigningLayoutProps) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="pt-8 pb-4 text-center">
        <h1 className="text-2xl font-bold text-[#2E7D32]">Sunset Services</h1>
        <p className="text-sm text-muted-foreground">Landscaping &amp; Property Maintenance</p>
      </header>

      {/* Main content */}
      <main className="flex-1 w-full max-w-[720px] mx-auto px-4 pb-16">
        {children}
      </main>

      {/* Footer */}
      <footer className="py-4 text-center">
        <p className="text-xs text-gray-400">Powered by Canopy CRM</p>
      </footer>

      <Toaster position="top-center" richColors />
    </div>
  );
}
