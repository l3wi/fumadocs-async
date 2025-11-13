interface OperationBadgeProps {
  direction: 'publish' | 'subscribe'
  className?: string
}

const baseClasses =
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-mono uppercase tracking-wide'

const palette: Record<OperationBadgeProps['direction'], string> = {
  publish:
    'border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-500/60 dark:bg-emerald-500/10 dark:text-emerald-200',
  subscribe:
    'border-sky-300/70 bg-sky-50 text-sky-700 dark:border-sky-500/60 dark:bg-sky-500/10 dark:text-sky-200',
}

export function OperationBadge({ direction, className }: OperationBadgeProps) {
  const label = direction === 'publish' ? 'Publish' : 'Subscribe'

  return (
    <span className={[baseClasses, palette[direction], className].filter(Boolean).join(' ')}>
      {label}
    </span>
  )
}
