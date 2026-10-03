/** Brand mark: a board frame with a single pen stroke. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" aria-hidden className={className}>
      <rect x="1" y="1" width="26" height="26" rx="7" fill="var(--color-accent)" />
      <path
        d="M7.5 17.5c2.2-4.6 4.4-6.9 6.2-6.9 2.6 0-.6 6.3 2 6.3 1.4 0 2.6-1.6 4.8-5"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M7.5 21h13" stroke="#fff" strokeOpacity=".45" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
