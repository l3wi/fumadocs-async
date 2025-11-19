'use client'

import { useCallback, useEffect, useState } from 'react'
import type { SVGProps } from 'react'

interface CopyButtonProps {
  text?: string
  getText?: () => string | Promise<string | null | undefined> | null | undefined
  className?: string
  activeClassName?: string
  ariaLabel?: string
  onCopy?: (copiedText: string) => void
}

const COPY_RESET_DELAY = 1600

export function CopyButton({
  text,
  getText,
  className,
  activeClassName,
  ariaLabel = 'Copy to clipboard',
  onCopy,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timeout = window.setTimeout(() => setCopied(false), COPY_RESET_DELAY)
    return () => window.clearTimeout(timeout)
  }, [copied])

  const resolveText = useCallback(async () => {
    if (typeof getText === 'function') {
      return await getText()
    }
    return text
  }, [getText, text])

  const handleCopy = useCallback(async () => {
    const value = await resolveText()
    if (!value) return

    const didCopy = await copyToClipboard(value)
    if (!didCopy) return

    setCopied(true)
    onCopy?.(value)
  }, [onCopy, resolveText])

  const classNames = [
    'asyncapi-copy-button',
    className,
    copied ? 'asyncapi-copy-button--active' : null,
    copied && activeClassName ? activeClassName : null,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button type="button" onClick={handleCopy} className={classNames} aria-label={ariaLabel}>
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  )
}

async function copyToClipboard(value: string): Promise<boolean> {
  if (typeof navigator === 'undefined') return false

  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = value
      textarea.style.position = 'fixed'
      textarea.style.top = '-1000px'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      const success = document.execCommand('copy')
      document.body.removeChild(textarea)
      return success
    } catch {
      return false
    }
  }
}

function CopyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      aria-hidden
      {...props}
    >
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  )
}

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      aria-hidden
      {...props}
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  )
}
