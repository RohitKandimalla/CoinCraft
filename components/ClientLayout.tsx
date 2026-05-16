'use client';

import { ReactNode } from 'react';
import { ThemeProvider } from './ThemeProvider';
import { Navigation } from './Navigation';

export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-white dark:bg-gray-950">
        <Navigation />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </ThemeProvider>
  );
}
