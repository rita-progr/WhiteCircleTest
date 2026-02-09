'use client';

import { memo } from 'react';
import { Spoiler as SpoiledSpoiler } from 'spoiled';

interface SpoilerProps {
  children: React.ReactNode;
}

export const Spoiler = memo(function Spoiler({ children }: SpoilerProps) {
  return (
    <SpoiledSpoiler
      theme="dark"
      fps={15}
      density={0.12}
    >
      {children}
    </SpoiledSpoiler>
  );
});
