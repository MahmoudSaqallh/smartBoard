import { initials, PARTICIPANTS, type Participant } from "@/features/whiteboard/data/participants";
import { cn } from "@/lib/cn";

function Avatar({ participant, size = "md" }: { participant: Participant; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        size === "sm" ? "size-7 text-[10px]" : "size-8 text-[11px]",
      )}
      style={{ backgroundColor: participant.color }}
    >
      {initials(participant.name)}
    </span>
  );
}

/** Compact overlapping avatars for the top bar. */
export function AvatarStack({ max = 3 }: { max?: number }) {
  const visible = PARTICIPANTS.slice(0, max);
  const hidden = PARTICIPANTS.length - visible.length;
  const label = `${PARTICIPANTS.length} people on this board: ${PARTICIPANTS.map((p) => p.name).join(", ")}`;

  return (
    <div role="img" aria-label={label} className="flex items-center -space-x-1.5">
      {visible.map((participant) => (
        <span key={participant.id} className="rounded-full ring-2 ring-surface">
          <Avatar participant={participant} size="sm" />
        </span>
      ))}
      {hidden > 0 && (
        <span
          aria-hidden
          className="inline-flex size-7 items-center justify-center rounded-full bg-subtle text-[11px] font-medium text-ink-muted ring-2 ring-surface"
        >
          +{hidden}
        </span>
      )}
    </div>
  );
}

/** Roster for the side panel. Status is written out, not just colour-coded. */
export function ParticipantsList() {
  const online = PARTICIPANTS.filter((p) => p.status === "online").length;

  return (
    <div>
      <p className="px-4 pb-2 text-xs text-ink-faint">
        {PARTICIPANTS.length} people · {online} online
      </p>
      <ul className="divide-y divide-line border-y border-line">
        {PARTICIPANTS.map((participant) => (
          <li key={participant.id} className="flex items-center gap-3 px-4 py-2.5">
            <Avatar participant={participant} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{participant.name}</p>
              <p className="text-xs text-ink-faint">{participant.role}</p>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-ink-muted">
              <span
                aria-hidden
                className={cn(
                  "size-1.5 rounded-full",
                  participant.status === "online" ? "bg-online" : "border border-ink-faint",
                )}
              />
              {participant.status === "online" ? "Online" : "Invited"}
            </span>
          </li>
        ))}
      </ul>
      <p className="px-4 pt-3 text-xs leading-relaxed text-ink-faint">
        Live presence and invitations arrive with real-time collaboration. This list is a preview.
      </p>
    </div>
  );
}
