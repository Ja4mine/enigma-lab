import type { SVGProps } from "react";

/** Line icons drawn on a 20-unit grid, 1.5 stroke, so they match the ink rules. */
const base = (props: SVGProps<SVGSVGElement>) => ({
  width: 18,
  height: 18,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...props,
});

export const IconPrev = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12.5 4.5 7 10l5.5 5.5" />
  </svg>
);
export const IconNext = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M7.5 4.5 13 10l-5.5 5.5" />
  </svg>
);
export const IconPlay = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6.5 4.5v11l9-5.5z" fill="currentColor" />
  </svg>
);
export const IconPause = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M7 4.5v11M13 4.5v11" strokeWidth="2.2" />
  </svg>
);
export const IconReset = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4.5 10a5.5 5.5 0 1 0 1.7-4" />
    <path d="M4 3.8v3.4h3.4" />
  </svg>
);
export const IconFrame = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3.5 7V3.5H7M13 3.5h3.5V7M16.5 13v3.5H13M7 16.5H3.5V13" />
    <circle cx="10" cy="10" r="2.2" />
  </svg>
);
export const IconXray = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="10" cy="10" r="6.5" strokeDasharray="2.2 2" />
    <path d="M6.5 12.5c2-4 5-4 7-1M6 8.5c2.5 1 5 3 7.5 3" />
  </svg>
);
export const IconLabels = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="5" cy="6" r="2.2" />
    <path d="M7.2 6h9.3M5 12.5h11.5M5 16h7" />
  </svg>
);
export const IconSun = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="10" cy="10" r="3.4" />
    <path d="M10 2.5v1.8M10 15.7v1.8M2.5 10h1.8M15.7 10h1.8M4.7 4.7l1.3 1.3M14 14l1.3 1.3M4.7 15.3 6 14M14 6l1.3-1.3" />
  </svg>
);
export const IconMoon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M15.8 12.6A6.6 6.6 0 0 1 7.4 4.2a6.6 6.6 0 1 0 8.4 8.4z" />
  </svg>
);
export const IconInfo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="10" cy="10" r="7" />
    <path d="M10 9v4.8M10 6.3v.2" />
  </svg>
);
export const IconClose = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m5 5 10 10M15 5 5 15" />
  </svg>
);
export const IconUp = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M10 15.5v-11M5.5 9 10 4.5 14.5 9" />
  </svg>
);
export const IconShuffle = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3.5 6h3c3 0 4 8 7 8h3M3.5 14h3c1.2 0 2-1.2 2.6-2.6M11.4 8.6C12 7.2 12.8 6 14 6h2.5M14.5 4l2 2-2 2M14.5 12l2 2-2 2" />
  </svg>
);

/** The brand mark: a rotor face with 26 contacts. */
export const BrandMark = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    {Array.from({ length: 26 }, (_, i) => {
      const a = (i / 26) * Math.PI * 2;
      return (
        <circle
          key={i}
          cx={12 + Math.sin(a) * 7.4}
          cy={12 - Math.cos(a) * 7.4}
          r={i === 0 ? 1.25 : 0.62}
          fill="currentColor"
        />
      );
    })}
    <circle cx="12" cy="12" r="2.2" fill="currentColor" />
  </svg>
);
