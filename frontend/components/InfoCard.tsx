import clsx from 'clsx';

interface InfoCardProps {
  title: string;
  value: React.ReactNode;
  footer?: React.ReactNode;
  accent?: 'default' | 'success' | 'danger';
}

export function InfoCard({ title, value, footer, accent = 'default' }: InfoCardProps) {
  const borderColor =
    accent === 'success' ? 'border-success' : accent === 'danger' ? 'border-danger' : 'border-secondary';

  return (
    <div className={clsx('rounded-lg border bg-surface p-5 shadow-md transition-all hover:-translate-y-0.5', borderColor)}>
      <p className="text-sm uppercase tracking-wide text-gray-400">{title}</p>
      <div className="mt-3 text-2xl font-semibold">{value}</div>
      {footer ? <div className="mt-3 text-sm text-gray-400">{footer}</div> : null}
    </div>
  );
}
