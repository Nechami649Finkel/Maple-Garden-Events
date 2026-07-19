import type { ReactNode } from 'react';
import type { NavIconName } from '@shared/i18n/navigationLookups';

const ICONS: Record<NavIconName, ReactNode> = {
  dashboard: (
    <path
      fill="currentColor"
      d="M3 3h8v8H3V3zm10 0h8v5h-8V3zM3 13h5v8H3v-8zm7 0h11v8H10v-8z"
    />
  ),
  calendar: (
    <path
      fill="currentColor"
      d="M7 2v2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zm12 8H5v8h14v-8z"
    />
  ),
  settings: (
    <path
      fill="currentColor"
      d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.94 3a7.96 7.96 0 0 0 .06-.94 7.96 7.96 0 0 0-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a8.05 8.05 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.5.42l-.36 2.54a8.05 8.05 0 0 0-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.6 8.84a.5.5 0 0 0 .12.64L4.75 11a7.96 7.96 0 0 0-.06.94c0 .32.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.39 1.05.7 1.63.94l.36 2.54A.5.5 0 0 0 10 22h4a.5.5 0 0 0 .5-.42l.36-2.54c.58-.24 1.13-.55 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64L19.25 13c.04-.31.06-.62.06-.94z"
    />
  ),
  clipboard: (
    <path
      fill="currentColor"
      d="M9 2a1 1 0 0 0 0 2h2a1 1 0 1 0 0-2H9zm-2 2a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3h1a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1zm0 2v14h12V6H7z"
    />
  ),
  bookings: (
    <path
      fill="currentColor"
      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2 5 5h-5V4zM8 12h8v2H8v-2zm0 4h8v2H8v-2z"
    />
  ),
  star: (
    <path
      fill="currentColor"
      d="M12 2l2.47 5.01L20 7.9l-4 3.9.94 5.5L12 15.77 7.06 17.3 8 11.8 4 7.9l5.53-.89L12 2z"
    />
  ),
  chart: (
    <path
      fill="currentColor"
      d="M3 3v18h18V3H3zm16 16H5V5h14v14zM7 15h2V9H7v6zm4 0h2V7h-2v8zm4 0h2v-4h-2v4z"
    />
  ),
  mail: (
    <path
      fill="currentColor"
      d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5L4 8V6l8 5 8-5v2z"
    />
  ),
  event: (
    <path
      fill="currentColor"
      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"
    />
  ),
};

export interface IconProps {
  name: NavIconName;
  size?: number;
  className?: string;
  label?: string;
}

export function Icon({ name, size = 20, className, label }: IconProps) {
  const path = ICONS[name];
  if (!path) return null;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    >
      {path}
    </svg>
  );
}
