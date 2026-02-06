'use client';

import { Spoiler as SpoiledSpoiler } from 'spoiled';

interface SpoilerProps {
  children: React.ReactNode;
}

export function Spoiler({ children }: SpoilerProps) {
  return (
    <SpoiledSpoiler
      theme="dark"
      fps={30}
      density={0.15}
    >
      {children}
    </SpoiledSpoiler>
  );
}
