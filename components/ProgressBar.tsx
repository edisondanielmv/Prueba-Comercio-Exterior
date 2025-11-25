import React from 'react';

interface ProgressBarProps {
    current: number;
    total: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ current, total }) => {
    const percentage = Math.round((current / total) * 100);
    return (
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
            <div 
                className="bg-sky-500 h-2.5 rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${percentage}%` }}
            ></div>
            <div className="text-right text-xs text-gray-500 mt-1">
                Pregunta {current} de {total}
            </div>
        </div>
    );
};