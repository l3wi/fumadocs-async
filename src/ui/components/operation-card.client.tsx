'use client'

import { useEffect, useState } from 'react'
import type { OperationCardRenderData } from './operation-card.types'
import { MessageDefinitionPanel } from './message-definition.client'
import { ChannelTag } from './channel-tag'

interface OperationCardProps {
  operation: OperationCardRenderData
}

export function OperationCard({ operation }: OperationCardProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const tabs = operation.tabs
  useEffect(() => {
    if (activeIndex >= tabs.length) {
      setActiveIndex(0)
    }
  }, [activeIndex, tabs.length])

  if (!tabs.length) {
    return null
  }

  const activeTab = tabs[activeIndex] ?? tabs[0]
  const filteredTags = operation.tags.filter((tag) => {
    const normalized = tag.toLowerCase()
    return normalized !== 'subscribe' && normalized !== 'publish'
  })

  return (
    <div className="space-y-5 rounded-2xl border border-border/60 bg-card/50 p-6 text-sm shadow-sm">
      <header className="space-y-3">
        {operation.direction === 'publish' && (
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              Publish
            </span>
          </div>
        )}
        <div className="space-y-1">
          <h3 className="text-xl font-semibold leading-tight">{operation.title}</h3>
          {operation.description && <p className="text-sm text-muted-foreground">{operation.description}</p>}
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-semibold uppercase tracking-wide">Channel:</span>
            <ChannelTag channelName={operation.channelName} href={operation.channelHref || `#channel-${operation.channelName}`} />
          </div>
          {filteredTags.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-semibold uppercase tracking-wide">
                {filteredTags.length > 1 ? 'Tags:' : 'Tag:'}
              </span>
              <div className="flex flex-wrap gap-2">
                {filteredTags.map((tag) => (
                  <span key={tag} className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 border-b border-border">
          {tabs.map((tab, index) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`relative flex items-center gap-2 px-4 py-2 text-xs font-medium transition-colors ${
                activeIndex === index ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{tab.name}</span>
              <span
                className={`rounded-full border px-1.5 py-0 text-[10px] font-semibold ${
                  tab.type === 'message'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                }`}
              >
                {tab.type.toUpperCase()}
              </span>
              {activeIndex === index && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}
            </button>
          ))}
        </div>

        <MessageDefinitionPanel
          tab={activeTab}
          channelName={operation.channelName}
          allowLoad
        />
      </div>
    </div>
  )
}
