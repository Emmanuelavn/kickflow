// Icônes Material absentes de lucide-react
export function SoccerBall({ size = 24, color = 'currentColor', className }: { size?: number; color?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 7.2l4.3 3.1-1.6 5H9.3l-1.6-5z" fill={color} fillOpacity={0.9} />
      <path d="M12 7.2V2.2M16.3 10.3l4.7-1.5M14.7 15.3l2.9 4.1M9.3 15.3l-2.9 4.1M7.7 10.3L3 8.8" />
    </svg>
  )
}

/** Icône « jeton » (Icons.toll) */
export function Toll({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} aria-hidden="true">
      <circle cx="15" cy="12" r="7" />
      <path d="M8.5 5.3A7 7 0 0 0 8.5 18.7" />
      <path d="M4.5 6.5a7 7 0 0 0 0 11" />
    </svg>
  )
}
