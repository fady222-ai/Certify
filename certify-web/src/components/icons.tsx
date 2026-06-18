import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps) => ({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

export const IconBolt = (p: IconProps) => (
  <svg {...base(p)}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></svg>
);
export const IconShield = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" /><path d="m9 12 2 2 4-4" /></svg>
);
export const IconUsers = (p: IconProps) => (
  <svg {...base(p)}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" /><path d="M16 6a3 3 0 0 1 0 6M21 20c0-2.5-1.5-4-3.5-4.5" /></svg>
);
export const IconSparkle = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="m6 6 2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" /></svg>
);
export const IconLinkedin = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M7 10v7M7 7v.01M11 17v-4a2 2 0 0 1 4 0v4M11 11v6" /></svg>
);
export const IconQr = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M21 14v.01M17 21h4M21 17v4M14 21v-2" /></svg>
);
export const IconUpload = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 16V4M8 8l4-4 4 4" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
);
export const IconPalette = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.5 0-.5-.3-.8-.5-1.2-.2-.3-.5-.6-.5-1 0-.7.6-1.3 1.3-1.3H15a5 5 0 0 0 5-5c0-4.4-3.6-8-8-8Z" /><circle cx="7.5" cy="11.5" r="1" fill="currentColor" /><circle cx="10.5" cy="7.5" r="1" fill="currentColor" /><circle cx="15" cy="8" r="1" fill="currentColor" /></svg>
);
export const IconChart = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 4v16h16" /><path d="M8 16v-4M12 16V8M16 16v-6" /></svg>
);
export const IconCheck = (p: IconProps) => (
  <svg {...base(p)}><path d="m5 12 5 5L20 7" /></svg>
);
export const IconArrow = (p: IconProps) => (
  <svg {...base(p)}><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
);
export const IconClock = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
export const IconBadge = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="9" r="6" /><path d="M9 14.5 7.5 22l4.5-2.5L16.5 22 15 14.5" /></svg>
);
export const IconMail = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
);
export const IconLock = (p: IconProps) => (
  <svg {...base(p)}><rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
);
export const IconSettings = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></svg>
);
export const IconSearch = (p: IconProps) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const IconTrash = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6" /></svg>
);
export const IconBan = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></svg>
);
export const IconDownload = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 4v12M8 12l4 4 4-4" /><path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" /></svg>
);
export const IconBuilding = (p: IconProps) => (
  <svg {...base(p)}><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M9 21v-4h6v4" /><path d="M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01" /></svg>
);
export const IconCreditCard = (p: IconProps) => (
  <svg {...base(p)}><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 9.5h19M6 15h4" /></svg>
);
export const IconGoogle = (p: IconProps) => (
  <svg viewBox="0 0 24 24" {...p}>
    <path fill="#4285F4" d="M22 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.6a4.8 4.8 0 0 1-2 3.2v2.6h3.3c1.9-1.8 3-4.4 3-7.6Z" />
    <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.3-2.6c-.9.6-2 1-3.3 1-2.6 0-4.7-1.7-5.5-4.1H3.1v2.6A10 10 0 0 0 12 22Z" />
    <path fill="#FBBC05" d="M6.5 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9l3.4-2.6Z" />
    <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5l3.4 2.6C7.3 7.6 9.4 5.9 12 5.9Z" />
  </svg>
);
