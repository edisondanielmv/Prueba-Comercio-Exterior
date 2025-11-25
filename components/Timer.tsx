import React, { useEffect, useState } from 'react';

interface TimerProps {
  durationMinutes: number;
  onTimeUp: () => void;
}

export const Timer: React.FC<TimerProps> = ({ durationMinutes, onTimeUp }) => {
  const [timeLeft, setTimeLeft] = useState(durationMinutes * 60);

  useEffect(() => {
    if (timeLeft <= 0) {
      onTimeUp();
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, onTimeUp]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isUrgent = timeLeft < 300; // Less than 5 minutes

  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-full shadow-lg font-mono font-bold text-xl transition-colors duration-300 ${isUrgent ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-sky-800 border-2 border-sky-100'}`}>
      ⏱ {formatTime(timeLeft)}
    </div>
  );
};