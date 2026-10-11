import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dota 2 Team Drafter',
  description: 'Draft Dota 2 teams, find counter picks, and explore meta team compositions.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
