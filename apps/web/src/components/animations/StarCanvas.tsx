import { useEffect, useRef } from 'react';

interface Props {
  zone?: string;
}

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  cycleSpeed: number;
  phaseOffset: number;
  drifting: boolean;
  vx: number;
  vy: number;
}

interface DustParticle {
  x: number;
  y: number;
  opacity: number;
  vy: number;
  size: number;
}

interface ShootingStar {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  progress: number;
  speed: number;
}

export function StarCanvas({ zone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctxMaybe = canvas.getContext('2d');
    if (!ctxMaybe) return;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const ctx = ctxMaybe!;

    let raf = 0;
    let shootingStar: ShootingStar | null = null;
    let nextShootIn = 10000 + Math.random() * 8000;
    let sinceLastShoot = 0;
    let lastTime = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const W = () => canvas.width;
    const H = () => canvas.height;

    // Generate stars once
    const stars: Star[] = Array.from({ length: 70 }, () => {
      const drifting = Math.random() < 0.3;
      return {
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: Math.random() < 0.15 ? 2 : 1,
        opacity: Math.random() * 0.5 + 0.2,
        cycleSpeed: Math.random() * 2 + 1.5,
        phaseOffset: Math.random() * Math.PI * 2,
        drifting,
        vx: drifting ? (Math.random() - 0.5) * 0.15 : 0,
        vy: drifting ? (Math.random() - 0.5) * 0.08 : 0,
      };
    });

    const dust: DustParticle[] = Array.from({ length: 16 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      opacity: Math.random() * 0.25 + 0.05,
      vy: -(Math.random() * 0.25 + 0.08),
      size: 1,
    }));

    function drawNebula(t: number) {
      const w = W();
      const h = H();
      const pulse = Math.sin(t * 0.0005) * 0.015 + 1;

      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(pulse, pulse);
      ctx.translate(-w / 2, -h / 2);

      // Corner nebula gradients
      const corners = [
        { cx: w * 0.05, cy: h * 0.05, r: w * 0.45, color: 'rgba(107,138,120,0.045)' },
        { cx: w * 0.95, cy: h * 0.85, r: w * 0.4, color: 'rgba(90,90,98,0.04)' },
      ];
      for (const c of corners) {
        const g = ctx.createRadialGradient(c.cx, c.cy, 0, c.cx, c.cy, c.r);
        g.addColorStop(0, c.color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      // Zone-specific tint (neutros B&N; susurro dorado en finanzas)
      if (zone === 'gym') {
        const g = ctx.createRadialGradient(w / 2, h, 0, w / 2, h, h * 0.6);
        g.addColorStop(0, 'rgba(107,138,120,0.025)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      } else if (zone === 'sleep') {
        const g = ctx.createRadialGradient(w * 0.8, 0, 0, w * 0.8, 0, h * 0.8);
        g.addColorStop(0, 'rgba(107,138,120,0.035)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      } else if (zone === 'finances') {
        const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, w * 0.5);
        g.addColorStop(0, 'rgba(212,180,131,0.025)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      ctx.restore();
    }

    function draw(timestamp: number) {
      if (document.hidden) {
        raf = requestAnimationFrame(draw);
        return;
      }

      const dt = lastTime ? timestamp - lastTime : 16;
      lastTime = timestamp;
      sinceLastShoot += dt;

      const w = W();
      const h = H();
      ctx.clearRect(0, 0, w, h);

      drawNebula(timestamp);

      // Stars
      for (const s of stars) {
        const twinkle = Math.sin(timestamp * 0.001 * s.cycleSpeed + s.phaseOffset) * 0.3 + 0.7;
        const alpha = s.opacity * twinkle;

        if (s.drifting) {
          s.x += s.vx;
          s.y += s.vy;
          if (s.x < -2) s.x = w + 2;
          if (s.x > w + 2) s.x = -2;
          if (s.y < -2) s.y = h + 2;
          if (s.y > h + 2) s.y = -2;
          ctx.fillStyle = `rgba(230,242,232,${alpha})`;
        } else {
          ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        }
        ctx.fillRect(Math.floor(s.x), Math.floor(s.y), s.size, s.size);
      }

      // Shooting star
      if (!shootingStar && sinceLastShoot > nextShootIn) {
        sinceLastShoot = 0;
        nextShootIn = 9000 + Math.random() * 9000;
        shootingStar = {
          startX: Math.random() * w * 0.5,
          startY: Math.random() * h * 0.35,
          endX: w * 0.4 + Math.random() * w * 0.4,
          endY: h * 0.25 + Math.random() * h * 0.35,
          progress: 0,
          speed: 0.012 + Math.random() * 0.01,
        };
      }
      if (shootingStar) {
        const p = shootingStar.progress;
        const { startX, startY, endX, endY } = shootingStar;
        const cx = startX + (endX - startX) * p;
        const cy = startY + (endY - startY) * p;
        const tailP = Math.max(0, p - 0.18);
        const tx = startX + (endX - startX) * tailP;
        const ty = startY + (endY - startY) * tailP;
        const alpha = p < 0.75 ? 1 : (1 - p) / 0.25;

        const grad = ctx.createLinearGradient(tx, ty, cx, cy);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(1, `rgba(255,255,255,${alpha})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(cx, cy);
        ctx.stroke();

        shootingStar.progress += shootingStar.speed;
        if (shootingStar.progress >= 1) shootingStar = null;
      }

      // Golden dust
      for (const d of dust) {
        d.y += d.vy;
        if (d.y < -3) {
          d.y = h + 3;
          d.x = Math.random() * w;
        }
        const glow = Math.sin(timestamp * 0.002 + d.x) * 0.12 + 0.88;
        ctx.fillStyle = `rgba(212,180,131,${d.opacity * glow})`;
        ctx.fillRect(Math.floor(d.x), Math.floor(d.y), 1, 1);
      }

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [zone]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0, opacity: 0.65 }}
    />
  );
}
