'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface SpoilerProps {
  children: React.ReactNode;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

export function Spoiler({ children }: SpoilerProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLSpanElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);

  const createParticles = useCallback((width: number, height: number, count: number) => {
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        life: Math.random() * 60 + 60,
        maxLife: 120,
        size: Math.random() * 2 + 1,
      });
    }
    return particles;
  }, []);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!isRevealed) {
      // Draw particles when hidden
      particlesRef.current.forEach((p) => {
        // Update position
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off edges
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        // Keep in bounds
        p.x = Math.max(0, Math.min(canvas.width, p.x));
        p.y = Math.max(0, Math.min(canvas.height, p.y));

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(180, 180, 180, 0.8)';
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    } else if (isAnimating) {
      // Disperse animation when revealing
      let allDone = true;
      particlesRef.current.forEach((p) => {
        p.life -= 2;
        if (p.life > 0) {
          allDone = false;
          p.x += p.vx * 3;
          p.y += p.vy * 3;

          const alpha = p.life / p.maxLife;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(180, 180, 180, ${alpha})`;
          ctx.fill();
        }
      });

      if (allDone) {
        setIsAnimating(false);
      } else {
        animationRef.current = requestAnimationFrame(animate);
      }
    }
  }, [isRevealed, isAnimating]);

  // Initialize and resize canvas
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);

      // Create particles based on area
      const area = rect.width * rect.height;
      const particleCount = Math.max(10, Math.floor(area / 80));
      particlesRef.current = createParticles(rect.width, rect.height, particleCount);
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationRef.current);
    };
  }, [createParticles]);

  // Start/stop animation
  useEffect(() => {
    if (!isRevealed || isAnimating) {
      animationRef.current = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(animationRef.current);
  }, [isRevealed, isAnimating, animate]);

  const handleClick = () => {
    if (isRevealed) {
      // Hide again - recreate particles
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const area = rect.width * rect.height;
        const particleCount = Math.max(10, Math.floor(area / 80));
        particlesRef.current = createParticles(rect.width, rect.height, particleCount);
      }
      setIsRevealed(false);
    } else {
      // Reveal - start disperse animation
      particlesRef.current.forEach((p) => {
        p.vx = (Math.random() - 0.5) * 4;
        p.vy = (Math.random() - 0.5) * 4;
        p.life = p.maxLife;
      });
      setIsAnimating(true);
      setIsRevealed(true);
    }
  };

  return (
    <span
      ref={containerRef}
      onClick={handleClick}
      style={{
        position: 'relative',
        display: 'inline',
        cursor: 'pointer',
        borderRadius: '4px',
        padding: '0 2px',
        backgroundColor: isRevealed ? 'transparent' : 'rgba(80, 80, 80, 0.3)',
        transition: 'background-color 0.3s ease',
      }}
    >
      <span
        style={{
          visibility: isRevealed ? 'visible' : 'hidden',
          opacity: isRevealed ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
      >
        {children}
      </span>
      {!isRevealed && (
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
          }}
        />
      )}
    </span>
  );
}
