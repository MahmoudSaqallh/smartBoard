/**
 * Placeholder roster. Realtime presence is out of scope for this phase;
 * these entries only demonstrate the participant UI and are marked as invited.
 */
export interface Participant {
  id: string;
  name: string;
  role: "Host" | "Co-teacher" | "Student";
  status: "online" | "invited";
  color: string;
}

export const PARTICIPANTS: Participant[] = [
  { id: "me", name: "You", role: "Host", status: "online", color: "#2952e3" },
  { id: "p1", name: "Maya Haddad", role: "Co-teacher", status: "invited", color: "#0f766e" },
  { id: "p2", name: "Omar Khalil", role: "Student", status: "invited", color: "#a1460a" },
  { id: "p3", name: "Lina Saeed", role: "Student", status: "invited", color: "#6d28d9" },
  { id: "p4", name: "Yusuf Nasser", role: "Student", status: "invited", color: "#be123c" },
];

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
