import React from 'react';
import { RadialBarChart, RadialBar, Legend, Tooltip, ResponsiveContainer } from 'recharts';

interface ResultsChartProps {
    score: number;
    total: number;
}

export const ResultsChart: React.FC<ResultsChartProps> = ({ score, total }) => {
    const percentage = (score / total) * 100;
    const fill = percentage >= 70 ? '#10B981' : percentage >= 50 ? '#F59E0B' : '#EF4444';
    
    const data = [
        {
            name: 'Nota',
            uv: percentage,
            fill: fill,
        },
        {
            name: 'Máximo',
            uv: 100,
            fill: '#E5E7EB', // Gray background track
        }
    ];

    return (
        <div className="w-full h-64 flex flex-col items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart 
                    cx="50%" 
                    cy="50%" 
                    innerRadius="70%" 
                    outerRadius="100%" 
                    barSize={20} 
                    data={data} 
                    startAngle={180} 
                    endAngle={0}
                >
                    <RadialBar
                        label={{ position: 'insideStart', fill: '#fff' }}
                        background
                        dataKey="uv"
                    />
                </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-0 text-center">
                <span className="text-4xl font-bold" style={{color: fill}}>{score}/{total}</span>
                <p className="text-gray-500 text-sm">Aciertos</p>
            </div>
        </div>
    );
};