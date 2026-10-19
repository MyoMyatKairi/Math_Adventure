import { ParentHeader } from '@/components/parent/header';

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <ParentHeader />
      <main id="main" className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
