declare module 'spoilerjs/spoiler-span' {
  // Side-effect import that registers the web component
}

declare namespace JSX {
  interface IntrinsicElements {
    'spoiler-span': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        /** Particle size multiplier (default: 1) */
        scale?: number | string;
        /** Minimum particle velocity */
        'min-velocity'?: number | string;
        /** Maximum particle velocity */
        'max-velocity'?: number | string;
        /** Particle animation lifetime in frames (default: 120) */
        'particle-lifetime'?: number | string;
        /** Particles per 100px² (default: 8) */
        density?: number | string;
        /** Text reveal duration in ms (default: 300) */
        'reveal-duration'?: number | string;
        /** Target frames per second (default: 60) */
        fps?: number | string;
      },
      HTMLElement
    >;
  }
}
