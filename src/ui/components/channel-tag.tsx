interface ChannelTagProps {
  channelName: string
  href?: string
  className?: string
}

const baseClasses = 'rounded-full bg-sky-500/20 px-2 py-0.5 text-[11px] font-semibold text-sky-500 no-underline'

export function ChannelTag({ channelName, href, className }: ChannelTagProps) {
  const displayName = channelName.toUpperCase()
  
  if (href) {
    return (
      <a 
        href={href} 
        className={[baseClasses, className].filter(Boolean).join(' ')}
      >
        {displayName}
      </a>
    )
  }
  
  return (
    <span className={[baseClasses, className].filter(Boolean).join(' ')}>
      {displayName}
    </span>
  )
}