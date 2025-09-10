import { useEffect, useState } from 'react';

interface CelebrationProps {
  show: boolean;
  onHide: () => void;
  completionTime: number | null;
}

export const Celebration = ({ show, onHide, completionTime }: CelebrationProps) => {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; color: string; delay: number }>>([]);

  useEffect(() => {
    if (show) {
      // Create confetti particles
      const newParticles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        color: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff'][Math.floor(Math.random() * 7)],
        delay: Math.random() * 2,
      }));
      setParticles(newParticles);

      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        onHide();
      }, 5000);

      return () => clearTimeout(timer);
    } else {
      setParticles([]);
    }
  }, [show, onHide]);

  if (!show) return null;

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Confetti particles */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute w-3 h-3 rounded-full animate-bounce"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            backgroundColor: particle.color,
            animationDelay: `${particle.delay}s`,
            animationDuration: '2s',
          }}
        />
      ))}
      
      {/* Celebration message */}
      <div className="bg-gradient-to-r from-yellow-400 via-red-500 to-pink-500 text-white p-8 rounded-3xl shadow-2xl text-center pointer-events-auto animate-pulse">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-3xl font-bold mb-2">Congratulations!</h2>
        <p className="text-xl mb-4">You solved the puzzle!</p>
        {completionTime && (
          <p className="text-lg font-semibold">
            Time: {formatTime(completionTime)}
          </p>
        )}
        <button
          onClick={onHide}
          className="mt-4 px-6 py-2 bg-white text-gray-800 rounded-lg font-bold hover:bg-gray-100 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
};
