import type { Metadata } from 'next';
import { Newsreader, IBM_Plex_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-serif',
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Retsspillet – Interaktivt 3D Retssalsspil',
  description:
    'Interaktivt dansk 3D-retssalsspil hvor logisk kohærens, bevisvægt og skarp argumentation afgør sagen foran AI-jury og dommer.',
  openGraph: {
    title: 'Retsspillet – Interaktivt 3D Retssalsspil',
    description:
      'Interaktivt dansk 3D-retssalsspil hvor logisk kohærens, bevisvægt og skarp argumentation afgør sagen foran AI-jury og dommer.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Retsspillet – Interaktivt 3D Retssalsspil',
    description:
      'Interaktivt dansk 3D-retssalsspil hvor logisk kohærens, bevisvægt og skarp argumentation afgør sagen foran AI-jury og dommer.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="da"
      className={`${newsreader.variable} ${ibmPlexSans.variable} ${jetbrainsMono.variable}`}
    >
      <body
        data-state="title"
        suppressHydrationWarning
        className="font-sans antialiased bg-[#1E1A16] text-[#1C1917] overflow-hidden select-none"
      >
        {children}
      </body>
    </html>
  );
}
