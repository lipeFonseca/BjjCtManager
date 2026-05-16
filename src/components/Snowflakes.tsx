import { useEffect, useState } from "react";

interface Snowflake {
  id: number;
  left: number;
  size: number;
  duration: number;
  startY: number;
  opacity: number;
  swayAmount: number;
}

const Snowflakes = () => {
  const [flakes, setFlakes] = useState<Snowflake[]>([]);

  useEffect(() => {
    const generated: Snowflake[] = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: Math.random() * 5 + 3,
      duration: Math.random() * 10 + 8,
      startY: -(Math.random() * 100),
      opacity: Math.random() * 0.5 + 0.2,
      swayAmount: Math.random() * 40 + 10,
    }));
    setFlakes(generated);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {flakes.map((f) => (
        <div
          key={f.id}
          className="absolute rounded-full bg-white/90"
          style={{
            left: `${f.left}%`,
            top: `${f.startY}%`,
            width: f.size,
            height: f.size,
            opacity: f.opacity,
            animation: `snowfall-y ${f.duration}s linear infinite, snowfall-x ${f.duration * 0.7}s ease-in-out infinite alternate`,
          }}
        />
      ))}
      <style>{`
        @keyframes snowfall-y {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(calc(100vh + 100%));
          }
        }
        @keyframes snowfall-x {
          0% {
            margin-left: -20px;
          }
          100% {
            margin-left: 20px;
          }
        }
      `}</style>
    </div>
  );
};

export default Snowflakes;
