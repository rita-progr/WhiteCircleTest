'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface SpoilerProps {
  children: React.ReactNode;
  label?: string;
  className?: string;
}

export function Spoiler({ children, label, className }: SpoilerProps) {
  const [isRevealed, setIsRevealed] = useState(false);

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => setIsRevealed(!isRevealed)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsRevealed(!isRevealed);
        }
      }}
      className={cn(
        'inline cursor-pointer rounded px-0.5 transition-all duration-200 ease-out',
        !isRevealed && 'bg-neutral-500/30',
        className
      )}
      style={{
        filter: isRevealed ? 'none' : 'blur(8px)',
      }}
      title={isRevealed ? 'Click to hide' : label ? `${label} - Click to reveal` : 'Click to reveal'}
    >
      {children}
    </span>
  );
}
