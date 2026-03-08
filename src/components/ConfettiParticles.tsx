import { useEffect, useRef, useCallback } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  rotation: number;
  rotationSpeed: number;
  shape: "circle" | "rect" | "line";
  life: number;
  maxLife: number;
}

const COLORS = [
  "#EA4335", // red
  "#4285F4", // blue
  "#34A853", // green
  "#FBBC05", // yellow
  "#A142F4", // purple
  "#FF6D01", // orange
  "#E91E63", // pink
];

const ConfettiParticles = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const animFrameRef = useRef<number>(0);
  const lastSpawnRef = useRef(0);

  const createParticle = useCallback((x: number, y: number): Particle => {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3 + 1;
    const shapes: Particle["shape"][] = ["circle", "rect", "line"];
    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      size: Math.random() * 5 + 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: 1,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      life: 0,
      maxLife: Math.random() * 80 + 60,
    };
  }, []);

  const spawnInitialParticles = useCallback(
    (width: number, height: number) => {
      const particles: Particle[] = [];
      for (let i = 0; i < 120; i++) {
        const p = createParticle(
          Math.random() * width,
          Math.random() * height
        );
        p.life = Math.random() * p.maxLife;
        p.vy = Math.random() * 0.5 - 0.25;
        p.vx = Math.random() * 0.5 - 0.25;
        p.maxLife = Math.random() * 200 + 150;
        particles.push(p);
      }
      return particles;
    },
    [createParticle]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    particlesRef.current = spawnInitialParticles(canvas.width, canvas.height);

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY, active: true };
    };
    const onMouseLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);

    const animate = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const particles = particlesRef.current;

      // Spawn particles near mouse
      if (mouseRef.current.active && time - lastSpawnRef.current > 30) {
        for (let i = 0; i < 3; i++) {
          const offsetX = (Math.random() - 0.5) * 60;
          const offsetY = (Math.random() - 0.5) * 60;
          particles.push(
            createParticle(
              mouseRef.current.x + offsetX,
              mouseRef.current.y + offsetY
            )
          );
        }
        lastSpawnRef.current = time;
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;

        // Mouse repulsion
        if (mouseRef.current.active) {
          const dx = p.x - mouseRef.current.x;
          const dy = p.y - mouseRef.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150 && dist > 0) {
            const force = (150 - dist) / 150;
            p.vx += (dx / dist) * force * 0.8;
            p.vy += (dy / dist) * force * 0.8;
          }
        }

        // Gravity + friction
        p.vy += 0.02;
        p.vx *= 0.99;
        p.vy *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        // Fade out near end of life
        const lifeRatio = p.life / p.maxLife;
        p.alpha = lifeRatio > 0.7 ? 1 - (lifeRatio - 0.7) / 0.3 : Math.min(1, lifeRatio * 5);

        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
          // Respawn ambient particle
          const np = createParticle(
            Math.random() * canvas.width,
            -10
          );
          np.vy = Math.random() * 0.5 + 0.2;
          np.vx = (Math.random() - 0.5) * 0.5;
          np.maxLife = Math.random() * 200 + 150;
          particles.push(np);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;

        if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        } else {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-p.size, 0);
          ctx.lineTo(p.size, 0);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Cap particles
      if (particles.length > 300) {
        particles.splice(0, particles.length - 300);
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [createParticle, spawnInitialParticles]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-10"
      style={{ width: "100%", height: "100%" }}
    />
  );
};

export default ConfettiParticles;
