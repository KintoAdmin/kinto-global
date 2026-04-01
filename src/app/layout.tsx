// @ts-nocheck
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kinto Global — Diagnostic Platform',
  description: 'Business diagnostic and transformation intelligence platform'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
