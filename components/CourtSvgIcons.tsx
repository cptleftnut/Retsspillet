import React from 'react';

export function RetsspilletCrestSvg({ className = 'w-12 h-12' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="2"
        fill="#1C1917"
        stroke="#A87C2D"
        strokeWidth="2"
      />
      <path
        d="M32 13V48M22 48H42M16 22H48"
        stroke="#F4EFE6"
        strokeWidth="2.4"
        strokeLinecap="square"
      />
      <path
        d="M16 22L11 35H21L16 22Z"
        fill="#A87C2D"
        fillOpacity="0.28"
        stroke="#A87C2D"
        strokeWidth="1.8"
      />
      <path
        d="M48 22L43 35H53L48 22Z"
        fill="#A87C2D"
        fillOpacity="0.28"
        stroke="#A87C2D"
        strokeWidth="1.8"
      />
      <circle cx="32" cy="14" r="2.8" fill="#A87C2D" />
    </svg>
  );
}

export function GavelIconSvg({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M14 4L20 10L17 13L11 7L14 4Z"
        fill="currentColor"
        fillOpacity="0.22"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M12.5 11.5L4.5 19.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" />
      <path d="M12 20H21" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
    </svg>
  );
}

export function SpeakerIconSvg({
  active,
  className = 'w-4 h-4',
}: {
  active: boolean;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 9H8L13 5V19L8 15H4V9Z"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.25 : 0}
        stroke="currentColor"
        strokeWidth="1.8"
      />
      {active ? (
        <>
          <path d="M16.5 8.5C17.6 9.6 18.2 10.8 18.2 12C18.2 13.2 17.6 14.4 16.5 15.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M19 6C20.8 7.8 21.6 9.8 21.6 12C21.6 14.2 20.8 16.2 19 18" stroke="currentColor" strokeWidth="1.8" />
        </>
      ) : (
        <path d="M16.5 9.5L21 14M21 9.5L16.5 14" stroke="currentColor" strokeWidth="1.8" />
      )}
    </svg>
  );
}

export function BookIconSvg({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 5.5C4 4.7 4.7 4 5.5 4H12V19H5.5C4.7 19 4 19.7 4 20.5V5.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M20 5.5C20 4.7 19.3 4 18.5 4H12V19H18.5C19.3 19 20 19.7 20 20.5V5.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function PauseIconSvg({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" fill="currentColor" />
    </svg>
  );
}
