import type { Metadata } from 'next';
import '@/app/globals.css';
import { ClientLayout } from '@/components/ClientLayout';

export const metadata: Metadata = {
  title: 'CoinCraft - Portfolio Dashboard',
  description: 'A secure, local-first portfolio tracker for your investments',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
