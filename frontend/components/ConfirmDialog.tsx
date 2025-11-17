'use client';

import { useState } from 'react';

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  confirmValue: string;
  onConfirm: () => Promise<void> | void;
  tone?: 'danger' | 'default';
  secondaryPrompt?: string;
  secondaryConfirmValue?: string;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  confirmValue,
  onConfirm,
  tone = 'default',
  secondaryPrompt,
  secondaryConfirmValue,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [secondaryValue, setSecondaryValue] = useState('');
  const [busy, setBusy] = useState(false);
  const danger = tone === 'danger';

  async function handleConfirm() {
    if (value !== confirmValue) {
      return;
    }
    if (secondaryPrompt && secondaryConfirmValue && secondaryValue !== secondaryConfirmValue) {
      return;
    }
    setBusy(true);
    await onConfirm();
    setBusy(false);
    setOpen(false);
    setValue('');
    setSecondaryValue('');
  }

  return (
    <div>
      <button
        className={`rounded px-4 py-2 font-semibold ${danger ? 'bg-danger text-white' : 'bg-secondary text-white'}`}
        onClick={() => setOpen(true)}
      >
        {title}
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-lg border border-secondary bg-surface p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-gray-300">{description}</p>
            </div>
            <div className="space-y-3">
              <label className="block text-sm text-gray-300">
                Type <code className="font-semibold">{confirmValue}</code> to continue
                <input
                  className="mt-2 w-full rounded border border-secondary bg-background p-2"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                />
              </label>
              {secondaryPrompt && secondaryConfirmValue ? (
                <label className="block text-sm text-gray-300">
                  {secondaryPrompt}
                  <input
                    className="mt-2 w-full rounded border border-secondary bg-background p-2"
                    value={secondaryValue}
                    onChange={(event) => setSecondaryValue(event.target.value)}
                  />
                </label>
              ) : null}
            </div>
            <div className="flex justify-end gap-3">
              <button className="rounded border border-secondary px-4 py-2" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button
                className={`rounded px-4 py-2 font-semibold ${danger ? 'bg-danger text-white' : 'bg-primary text-black'}`}
                onClick={handleConfirm}
                disabled={
                  busy ||
                  value !== confirmValue ||
                  (secondaryPrompt && secondaryConfirmValue ? secondaryValue !== secondaryConfirmValue : false)
                }
              >
                {busy ? 'Working...' : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
