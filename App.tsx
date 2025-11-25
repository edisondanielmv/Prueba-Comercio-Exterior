import React, { useState, useCallback } from 'react';
import { AppState, Question, StudentData, SheetPayload } from './types';
import { generateExamQuestions } from './services/geminiService';
import { submitToGoogleSheets } from './services/googleSheets';
import { Header } from './components/Header';
import { Timer } from './components/Timer';
import { ProgressBar } from './components/ProgressBar';
import { ResultsChart } from './components/ResultsChart';

// Icons
const Spinner = () => (
  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.LOGIN);
  const [studentData, setStudentData] = useState<StudentData>({ name: '', idNumber: '' });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [score, setScore] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Form Handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentData.name.trim() || !studentData.idNumber.trim()) {
        setErrorMsg("Por favor ingresa todos los campos.");
        return;
    }
    if (studentData.idNumber.length < 10) {
        setErrorMsg("Por favor ingresa un número de cédula válido.");
        return;
    }
    setErrorMsg('');
    setAppState(AppState.GENERATING);
    
    try {
        const generatedQuestions = await generateExamQuestions();
        setQuestions(generatedQuestions);
        setAppState(AppState.TESTING);
    } catch (error) {
        console.error(error);
        setErrorMsg("Hubo un error generando la prueba. Por favor intenta de nuevo.");
        setAppState(AppState.LOGIN);
    }
  };

  const handleAnswerSelect = (questionId: number, optionIndex: number) => {
      setAnswers(prev => ({
          ...prev,
          [questionId]: optionIndex
      }));
  };

  const calculateScore = useCallback(() => {
      let correctCount = 0;
      questions.forEach(q => {
          if (answers[q.id] === q.correctOptionIndex) {
              correctCount++;
          }
      });
      return correctCount;
  }, [questions, answers]);

  const handleSubmitExam = async () => {
      if (Object.keys(answers).length < questions.length) {
          if (!window.confirm("No has respondido todas las preguntas. ¿Estás seguro de finalizar?")) {
              return;
          }
      }
      
      setAppState(AppState.SUBMITTING);
      
      try {
        const finalScore = calculateScore();
        setScore(finalScore);

        const payload: SheetPayload = {
            timestamp: new Date().toISOString(),
            studentName: studentData.name,
            studentId: studentData.idNumber,
            score: finalScore,
            total: questions.length,
            details: JSON.stringify(answers)
        };

        await submitToGoogleSheets(payload);
        setAppState(AppState.RESULTS);
      } catch (e) {
        console.error("Error submitting exam:", e);
        // Even if it fails, show results, don't trap student
        setAppState(AppState.RESULTS);
      }
  };

  const handleTimeUp = () => {
      alert("El tiempo ha terminado. Tu examen se enviará automáticamente.");
      handleSubmitExam();
  };

  const handleReset = () => {
      // Reset all state to initial values instead of window.reload()
      setStudentData({ name: '', idNumber: '' });
      setQuestions([]);
      setAnswers({});
      setScore(0);
      setErrorMsg('');
      setAppState(AppState.LOGIN);
  };

  // Renderers
  const renderLogin = () => (
    <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md border-t-4 border-sky-500">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Ingreso del Estudiante</h2>
            <form onSubmit={handleLogin} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                    <input 
                        type="text" 
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all"
                        placeholder="Ej. Juan Pérez"
                        value={studentData.name}
                        onChange={e => setStudentData({...studentData, name: e.target.value})}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número de Cédula</label>
                    <input 
                        type="text" 
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all"
                        placeholder="Ej. 1720..."
                        value={studentData.idNumber}
                        onChange={e => setStudentData({...studentData, idNumber: e.target.value})}
                    />
                </div>
                {errorMsg && <p className="text-red-500 text-sm text-center">{errorMsg}</p>}
                <button 
                    type="submit" 
                    className="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold py-3 rounded-lg transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                >
                    Comenzar Evaluación
                </button>
            </form>
            <p className="mt-4 text-xs text-gray-500 text-center">
                Tendrás 40 minutos para responder 20 preguntas.
            </p>
        </div>
    </div>
  );

  const renderGenerating = () => (
    <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="text-sky-600 mb-4">
            <svg className="animate-spin h-12 w-12" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-700">Preparando tu examen único...</h2>
        <p className="text-gray-500 mt-2">La IA está seleccionando y refraseando tus preguntas.</p>
    </div>
  );

  const renderTesting = () => (
      <div className="container mx-auto px-4 py-8 max-w-4xl relative">
          <Timer durationMinutes={40} onTimeUp={handleTimeUp} />
          
          <div className="bg-white rounded-xl shadow-xl p-8 mb-8">
              <div className="mb-6 border-b pb-4">
                <h2 className="text-2xl font-bold text-gray-800">Examen en Curso</h2>
                <p className="text-gray-600">Estudiante: <span className="font-semibold">{studentData.name}</span></p>
              </div>

              <ProgressBar current={Object.keys(answers).length} total={questions.length} />

              <div className="space-y-8">
                  {questions.map((q, index) => (
                      <div key={q.id} className="p-6 bg-slate-50 rounded-lg border border-gray-200 hover:border-sky-300 transition-colors">
                          <p className="font-semibold text-lg text-gray-800 mb-4">
                              <span className="text-sky-600 mr-2">{index + 1}.</span> 
                              {q.text}
                          </p>
                          <div className="space-y-3">
                              {q.options.map((opt, optIdx) => (
                                  <label 
                                    key={optIdx} 
                                    className={`flex items-center p-4 rounded-lg border cursor-pointer transition-all ${
                                        answers[q.id] === optIdx 
                                        ? 'bg-sky-50 border-sky-500 ring-1 ring-sky-500' 
                                        : 'bg-white border-gray-200 hover:bg-gray-100'
                                    }`}
                                  >
                                      <input 
                                          type="radio" 
                                          name={`q-${q.id}`} 
                                          className="w-4 h-4 text-sky-600 focus:ring-sky-500"
                                          onChange={() => handleAnswerSelect(q.id, optIdx)}
                                          checked={answers[q.id] === optIdx}
                                      />
                                      <span className="ml-3 text-gray-700 text-sm md:text-base">{opt}</span>
                                  </label>
                              ))}
                          </div>
                      </div>
                  ))}
              </div>

              <div className="mt-10 flex justify-end">
                  <button 
                      onClick={handleSubmitExam}
                      className="bg-green-600 hover:bg-green-700 text-white text-lg font-bold py-4 px-8 rounded-lg shadow-lg transform hover:-translate-y-1 transition-all flex items-center"
                  >
                      Finalizar y Enviar Examen
                  </button>
              </div>
          </div>
      </div>
  );

  const renderSubmitting = () => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
         <div className="text-sky-600 mb-4">
            <Spinner />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Procesando respuestas...</h2>
        <p className="text-gray-500 mt-2">Generando registro de notas.</p>
    </div>
  );

  const renderResults = () => {
      const percentage = (score / questions.length) * 100;
      let feedback = "";
      if (percentage >= 90) feedback = "¡Excelente trabajo!";
      else if (percentage >= 70) feedback = "Buen trabajo, aprobaste.";
      else if (percentage >= 50) feedback = "Puedes mejorar.";
      else feedback = "Necesitas repasar los conceptos.";

      return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
                <div className="bg-sky-600 p-6 text-white text-center">
                    <h2 className="text-3xl font-bold">Resultados</h2>
                    <p className="opacity-90 mt-1">{studentData.name}</p>
                </div>
                
                <div className="p-8">
                    <ResultsChart score={score} total={questions.length} />
                    
                    <div className="text-center mt-6">
                        <p className="text-xl font-medium text-gray-800">{feedback}</p>
                        <p className="text-gray-500 mt-2 text-sm">
                            Se ha generado el registro de tu nota. <br/>
                            <span className="text-xs text-orange-600">Nota: Si no hay conexión al servidor, se descargará un archivo CSV de respaldo.</span>
                        </p>
                    </div>

                    <div className="mt-8 grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                        <div className="text-center">
                            <p className="text-gray-500 text-xs uppercase tracking-wider">Total Preguntas</p>
                            <p className="text-2xl font-bold text-gray-800">{questions.length}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-gray-500 text-xs uppercase tracking-wider">Respuestas Correctas</p>
                            <p className="text-2xl font-bold text-green-600">{score}</p>
                        </div>
                    </div>

                    <button 
                        onClick={handleReset}
                        className="mt-8 w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-lg font-semibold transition-colors"
                    >
                        Salir / Nuevo Estudiante
                    </button>
                </div>
            </div>
        </div>
      );
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-gray-900">
        {appState === AppState.LOGIN && <Header />}
        
        <main>
            {appState === AppState.LOGIN && renderLogin()}
            {appState === AppState.GENERATING && renderGenerating()}
            {appState === AppState.TESTING && renderTesting()}
            {appState === AppState.SUBMITTING && renderSubmitting()}
            {appState === AppState.RESULTS && renderResults()}
        </main>
    </div>
  );
};

export default App;