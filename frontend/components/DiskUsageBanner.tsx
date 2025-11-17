'use client';

import { useEffect, useState } from 'react';

interface DiskUsageBannerProps {
  usagePercent: number;
  onManage?: () => void;
}

export function DiskUsageBanner({ usagePercent, onManage }: DiskUsageBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [usagePercent]);

  if (usagePercent < 90 || dismissed) {
    return null;
  }

  return (
    <div className="mb-6 rounded-lg border border-danger bg-danger/20 p-4 text-sm text-red-100">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="font-semibold text-red-200">Storage pressure</p>
          <p>
            Demo storage is at <strong>{usagePercent.toFixed(1)}%</strong>. Consider exporting or deleting old demos to
            avoid interruptions.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            className="rounded bg-primary px-4 py-2 text-black font-semibold"
            onClick={() => {
              setDismissed(true);
              onManage?.();
            }}
          >
            Manage demos
          </button>
          <button
            className="rounded border border-red-300 px-4 py-2 text-red-200 hover:bg-red-500/20"
            onClick={() => setDismissed(true)}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
