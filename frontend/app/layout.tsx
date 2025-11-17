import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { SidebarNav } from '../components/SidebarNav';

export const metadata: Metadata = {
  title: 'MatchZy Tournament Panel',
  description: 'Live CS2 tournament operations and history overview.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="min-h-screen flex bg-background text-white">
            <SidebarNav />
            <main className="flex-1 p-8 overflow-y-auto">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
