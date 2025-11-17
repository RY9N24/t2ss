'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const links = [
  { href: '/live', label: 'Live' },
  { href: '/history', label: 'History' },
  { href: '/servers', label: 'Servers' },
  { href: '/disk', label: 'Disk' },
  { href: '/settings', label: 'Settings' },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-surface border-r border-secondary p-6 space-y-6 hidden md:block">
      <div>
        <h1 className="text-2xl font-semibold tracking-wide text-primary">MatchZy Panel</h1>
        <p className="text-sm text-gray-400 mt-1">CS2 tournaments &amp; MatchZy ingestion</p>
      </div>
      <nav className="space-y-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={clsx(
              'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname?.startsWith(link.href)
                ? 'bg-primary text-black'
                : 'text-gray-200 hover:bg-secondary hover:text-white',
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
