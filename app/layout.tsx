import type { Metadata, Viewport } from 'next';
import { Amiri, Fraunces, Outfit } from 'next/font/google';
import { Pwa } from '@/components/Pwa';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
});

const amiri = Amiri({
  subsets: ['arabic', 'latin'],
  weight: ['400', '700'],
  variable: '--font-amiri',
  display: 'swap',
});

export const metadata: Metadata = {
  applicationName: 'Salawat Challenge',
  title: {
    default: 'Salawat Challenge',
    template: '%s · Salawat Challenge',
  },
  description:
    'A group game for reciting salawat together. One login for the group, a profile for each person, and a daily goal with streaks and lives.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Salawat',
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  themeColor: '#07140f',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${fraunces.variable} ${amiri.variable}`}>
      <body>
        {children}
        <Pwa />
      </body>
    </html>
  );
}
