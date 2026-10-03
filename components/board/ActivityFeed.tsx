"use client";

import { useBoardStore } from "@/features/whiteboard/store/board-store";

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

/** Session log of board changes. Entries only exist client-side, so SSR markup is always the empty state. */
export function ActivityFeed() {
  const activity = useBoardStore((s) => s.activity);

  if (activity.length === 0) {
    return (
      <p className="px-4 py-5 text-sm leading-relaxed text-ink-muted">
        Changes made on this board during the session will appear here.
      </p>
    );
  }

  return (
    <ol aria-label="Recent activity" className="divide-y divide-line border-b border-line">
      {activity.map((entry) => (
        <li key={entry.id} className="flex items-baseline gap-3 px-4 py-2.5">
          <p className="min-w-0 flex-1 text-sm text-ink">
            <span className="font-medium">You</span> <span className="text-ink-muted">{lowerFirst(entry.message)}</span>
          </p>
          <time dateTime={new Date(entry.at).toISOString()} className="shrink-0 text-xs text-ink-faint tabular-nums">
            {timeFormat.format(entry.at)}
          </time>
        </li>
      ))}
    </ol>
  );
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
