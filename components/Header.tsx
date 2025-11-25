import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="bg-sky-600 text-white py-4 shadow-lg">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-sky-600 font-bold text-xl">
                E
            </div>
            <div>
                <h1 className="text-xl font-bold">Examen de Comercio Exterior</h1>
                <p className="text-xs text-sky-100">Evaluación Oficial</p>
            </div>
        </div>
      </div>
    </header>
  );
};