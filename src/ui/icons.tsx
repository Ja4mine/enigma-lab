/** Icons come from lucide-react; only the brand mark is our own. */
export {
  ChevronLeft as IconPrev,
  ChevronRight as IconNext,
  Play as IconPlay,
  Pause as IconPause,
  RotateCcw as IconReset,
  Scan as IconFrame,
  Layers as IconXray,
  Tags as IconLabels,
  Sun as IconSun,
  Moon as IconMoon,
  Info as IconInfo,
  X as IconClose,
  ChevronUp as IconUp,
  Shuffle as IconShuffle,
} from "lucide-react";

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
