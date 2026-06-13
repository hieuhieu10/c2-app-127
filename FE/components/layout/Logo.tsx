export default function Logo() {
  return (
    <div className="site-logo">
      <div className="site-logo-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <path d="M9 7h7M9 11h5" />
        </svg>
      </div>
      <span className="site-logo-text">Veridoc</span>
    </div>
  );
}
