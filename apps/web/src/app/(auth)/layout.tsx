import Link from 'next/link';
import { Logo } from '@/components/brand/icons';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6">
        <Link href="/" aria-label="Math Adventure home">
          <Logo />
        </Link>
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:pt-12">
        <div className="w-full max-w-md rounded-[2rem] bg-paper p-6 shadow-[0_6px_0_0_var(--color-line)] sm:p-8">{children}</div>
      </main>
    </div>
  );
}
