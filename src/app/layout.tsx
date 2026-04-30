import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ContaSaaS - Automacao Documental para Contabilidade',
  description: 'Plataforma SaaS para automacao de processos contabilisticos em Portugal',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-PT">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
