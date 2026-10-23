let uid = 0;

/** SOLARIS mark: a planet whose ring slips in front of it. White on whatever is behind. */
export function Logo({ title = 'SOLARIS' }: { title?: string }) {
  const id = `lg${uid++}`;
  return (
    <svg viewBox="0 0 48 48" role="img" aria-label={title}>
      <defs>
        <mask id={id}>
          <rect width="48" height="48" fill="#fff" />
          <path d="M3.2 29.6 A21 7 0 0 0 44.8 18.4" transform="rotate(-24 24 24) translate(0 -0.2)" fill="none" stroke="#000" strokeWidth="7" strokeLinecap="round" />
        </mask>
      </defs>
      <circle cx="24" cy="24" r="11.6" fill="#fff" mask={`url(#${id})`} />
      <ellipse cx="24" cy="24" rx="21" ry="7" transform="rotate(-24 24 24)" fill="none" stroke="#fff" strokeWidth="2.7" />
    </svg>
  );
}
