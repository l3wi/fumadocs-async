import type { ReactNode } from 'react'

interface SectionCardProps {
  title: string
  children: ReactNode
  className?: string
  titleSuffix?: ReactNode
}

export function SectionCard({ title, children, className, titleSuffix }: SectionCardProps) {
  if (isEmptyNode(children)) return null

  return (
    <section
      className={cn(
        'rounded-xl border border-border bg-card/40 p-4 backdrop-blur supports-[backdrop-filter]:bg-card/30',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        {titleSuffix}
      </div>
      <div className="mt-3 text-sm text-foreground">{children}</div>
    </section>
  )
}

function isEmptyNode(node: ReactNode | null | undefined): boolean {
  if (node === null || node === undefined || node === false) return true
  if (Array.isArray(node)) {
    return node.every((child) => isEmptyNode(child))
  }
  return false
}

function cn(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(' ')
}
