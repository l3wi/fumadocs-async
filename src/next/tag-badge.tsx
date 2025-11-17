export function TagBadge({ tag, builder }: { tag: string; builder?: (tag: string) => string | undefined }) {
  const href = builder?.(tag)
  if (!href) {
    return (
      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        {tag}
      </span>
    )
  }
  return (
    <a
      href={href}
      className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-primary hover:border-primary no-underline"
    >
      {tag}
    </a>
  )
}
