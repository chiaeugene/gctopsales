// Hand-rolled inline SVG icon set — no icon-package dependency, no emoji.
// Every icon: 20x20 viewBox, currentColor stroke, 1.6 weight, matches Apple's
// thin-line iconography instead of filled emoji glyphs.

import type { ReactNode } from "react";

type IconProps = { className?: string };
const base = "20";
const wrap = (children: ReactNode, className = "w-5 h-5") => (
  <svg viewBox={`0 0 ${base} ${base}`} fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    {children}
  </svg>
);
const stroke = { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const FlameIcon = ({ className }: IconProps) =>
  wrap(<path {...stroke} d="M10 2c1 3-2 4-2 7a3 3 0 106 0c0-1-.5-1.7-1-2 1.5 1 3 2.8 3 5.2A5.8 5.8 0 0110 18a5.8 5.8 0 01-5.8-5.8C4.2 8 7 6 10 2z" />, className);

export const SnowflakeIcon = ({ className }: IconProps) =>
  wrap(
    <g {...stroke}>
      <path d="M10 2v16M4 6l12 8M16 6L4 14" />
    </g>,
    className
  );

export const TrophyIcon = ({ className }: IconProps) =>
  wrap(
    <g {...stroke}>
      <path d="M6 3h8v5a4 4 0 01-8 0V3z" />
      <path d="M6 4H3.5A1.5 1.5 0 003 5.5V6a3 3 0 003 3M14 4h2.5A1.5 1.5 0 0118 5.5V6a3 3 0 01-3 3" />
      <path d="M10 12v3M7 17.5h6M8 17.5l.5-2.5h3l.5 2.5" />
    </g>,
    className
  );

export const CheckIcon = ({ className }: IconProps) => wrap(<path {...stroke} d="M4 10.5l4 4 8-9" />, className);

export const ArrowRightIcon = ({ className }: IconProps) => wrap(<path {...stroke} d="M4 10h12M11 5l5 5-5 5" />, className);

export const ChatIcon = ({ className }: IconProps) =>
  wrap(<path {...stroke} d="M3 5.5A1.5 1.5 0 014.5 4h11A1.5 1.5 0 0117 5.5v7A1.5 1.5 0 0115.5 14H8l-4 3v-3.2A1.5 1.5 0 013 12.3v-6.8z" />, className);

export const BoxIcon = ({ className }: IconProps) =>
  wrap(
    <g {...stroke}>
      <path d="M10 2.5l7 3.5-7 3.5-7-3.5 7-3.5z" />
      <path d="M3 6v8l7 3.5 7-3.5V6M10 9.5V17" />
    </g>,
    className
  );

export const UsersIcon = ({ className }: IconProps) =>
  wrap(
    <g {...stroke}>
      <circle cx="7" cy="7" r="2.5" />
      <path d="M2.5 16c.5-3 2.3-4.5 4.5-4.5s4 1.5 4.5 4.5" />
      <circle cx="14.5" cy="7.5" r="2" />
      <path d="M12.5 11.5c1.7.2 3 1.5 3.5 4" />
    </g>,
    className
  );

export const ChartIcon = ({ className }: IconProps) =>
  wrap(<path {...stroke} d="M3 17V9M8 17V3M13 17v-6M18 17V7" />, className);

export const AlertIcon = ({ className }: IconProps) =>
  wrap(
    <g {...stroke}>
      <path d="M10 3l8 14H2L10 3z" />
      <path d="M10 8.5v3.5M10 14.8v.1" />
    </g>,
    className
  );

export const MedalIcon = ({ className, rank }: IconProps & { rank: 1 | 2 | 3 }) => {
  const color = rank === 1 ? "#b8860b" : rank === 2 ? "#8a8f98" : "#a15c2e";
  return wrap(
    <g>
      <circle cx="10" cy="12" r="6" fill={color} opacity="0.15" />
      <circle cx="10" cy="12" r="6" stroke={color} strokeWidth="1.6" />
      <text x="10" y="15.5" textAnchor="middle" fontSize="7" fontWeight="700" fill={color} stroke="none">
        {rank}
      </text>
      <path stroke={color} strokeWidth="1.6" strokeLinecap="round" d="M7.5 7L6 2M12.5 7L14 2" />
    </g>,
    className
  );
};

export const StoreIcon = ({ className }: IconProps) =>
  wrap(
    <g {...stroke}>
      <path d="M3 7l1-4h12l1 4" />
      <path d="M3 7a2 2 0 004 0 2 2 0 004 0 2 2 0 004 0 2 2 0 004 0" />
      <path d="M4 8v8h12V8" />
    </g>,
    className
  );

export const DumbbellIcon = ({ className }: IconProps) =>
  wrap(
    <g {...stroke}>
      <path d="M2 9v2M4 7.5v5M16 7.5v5M18 9v2M4 10h12" />
    </g>,
    className
  );

export const ConnectIcon = ({ className }: IconProps) =>
  wrap(
    <g {...stroke}>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="14" cy="14" r="2.5" />
      <path d="M8 7.5L12.5 12.5" />
    </g>,
    className
  );

export const SettingsIcon = ({ className }: IconProps) =>
  wrap(
    <g {...stroke}>
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 3v2M10 15v2M17 10h-2M5 10H3M14.9 5.1l-1.4 1.4M6.5 13.5l-1.4 1.4M14.9 14.9l-1.4-1.4M6.5 6.5L5.1 5.1" />
    </g>,
    className
  );

export const MegaphoneIcon = ({ className }: IconProps) =>
  wrap(<path {...stroke} d="M3 9v2a1 1 0 001 1h1l2 4 1-.5-1.5-3.5H10l6 3V4l-6 3H4a1 1 0 00-1 1v1z" />, className);

export const FileIcon = ({ className }: IconProps) =>
  wrap(<path {...stroke} d="M6 2.5h6l3 3V17a.5.5 0 01-.5.5h-9A.5.5 0 015 17V3a.5.5 0 011-.5zM12 2.5V6h3.5" />, className);

export const StarIcon = ({ className }: IconProps) =>
  wrap(<path {...stroke} d="M10 2.5l2.2 4.7 5.1.6-3.8 3.5 1 5.1-4.5-2.5-4.5 2.5 1-5.1L2.7 7.8l5.1-.6L10 2.5z" />, className);

export const GridIcon = ({ className }: IconProps) =>
  wrap(
    <g {...stroke}>
      <rect x="3" y="3" width="6" height="6" rx="1.2" />
      <rect x="11" y="3" width="6" height="6" rx="1.2" />
      <rect x="3" y="11" width="6" height="6" rx="1.2" />
      <rect x="11" y="11" width="6" height="6" rx="1.2" />
    </g>,
    className
  );

export const AdminIcon = ({ className }: IconProps) =>
  wrap(<path {...stroke} d="M10 2l6 2.5v4.7c0 4-2.6 6.7-6 8.3-3.4-1.6-6-4.3-6-8.3V4.5L10 2z" />, className);
