import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TeleRadiology Billing',
  description: 'Automated billing system for teleradiology operations',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("font-sans")} suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
