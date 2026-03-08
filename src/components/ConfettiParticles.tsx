import { useEffect, useRef } from "react";

interface Particle {
  originX: number;
  originY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  shape: "circle" | "rect" | "line" | "dot";
}

const COLORS = [
  "#EA4335",
  "#4285F4",
  "#34A853",
  "#FBBC05",
  "#A142F4",
  "#FF6D01",
  "#E91E63",
  "#1A73E8",
];

const MOUSE_RADIUS = 180;
const PUSH_FORCE = 12;
const RETURN_SPEED = 0.03;
const FRICTION = 0.85;

const ConfettiParticles = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const animFrameRef = useRef<number>(0);
  const scrollRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = document.documentElement.scrollHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = document.documentElement.scrollHeight + "px";
      ctx.scale(dpr, dpr);
      initParticles();
    };

    const initParticles = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const shapes: Particle["shape"][] = ["circle", "rect", "line", "dot"];
      const particles: Particle[] = [];

      // More particles near top (hero area), fewer below
      for (let i = 0; i < 200; i++) {
        const x = Math.random() * w;
        // Concentrate 70% in top portion
        const y = i < 140 ? Math.random() * h * 0.8 : Math.random() * h * 1.5;
        particles.push({
          originX: x,
          originY: y,
          x,
          y,
          vx: 0,
          vy: 0,
          size: Math.random() * 6 + 2,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.01,
          shape: shapes[Math.floor(Math.random() * shapes.length)],
        });
      }
      particlesRef.current = particles;
    };

    resize();
    window.addEventListener("resize", resize);

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY + window.scrollY };
    };
    const onScroll = () => {
      scrollRef.current = window.scrollY;
      // Update mouse Y to account for scroll
      mouseRef.current.y = mouseRef.current.y - scrollRef.current + window.scrollY;
    };
    const onMouseLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("scroll", onScroll);
    window.addEventListener("mouseleave", onMouseLeave);

    const animate = () => {
      const w = window.innerWidth;
      const h = document.documentElement.scrollHeight;
      ctx.clearRect(0, 0, w, h);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      for (const p of particlesRef.current) {
        // Mouse repulsion
        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < MOUSE_RADIUS && dist > 0) {
          const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
          const angle = Math.atan2(dy, dx);
          p.vx += Math.cos(angle) * force * PUSH_FORCE;
          p.vy += Math.sin(angle) * force * PUSH_FORCE;
        }

        // Spring back to origin
        const homeX = p.originX - p.x;
        const homeY = p.originY - p.y;
        p.vx += homeX * RETURN_SPEED;
        p.vy += homeY * RETURN_SPEED;

        // Apply friction
        p.vx *= FRICTION;
        p.vy *= FRICTION;

        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed + (Math.abs(p.vx) + Math.abs(p.vy)) * 0.02;

        // Draw
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.strokeStyle = p.color;

        if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
        } else if (p.shape === "line") {
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-p.size, 0);
          ctx.lineTo(p.size, 0);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 3, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10"
    />
  );
};

export default ConfettiParticles;
