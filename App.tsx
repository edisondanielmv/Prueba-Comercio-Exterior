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
  const [rawScore, setRawScore] = useState(0); // This is the count of correct answers
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

  const calculateRawScore = useCallback(() => {
      let correctCount = 0;
      questions.forEach(q => {
          // Unanswered questions (undefined in answers) automatically get 0 because they don't match
          if (answers[q.id] === q.correctOptionIndex) {
              correctCount++;
          }
      });
      return correctCount;
  }, [questions, answers]);

  const processSubmission = async (finalRawScore: number) => {
        setRawScore(finalRawScore);
        
        // Calculate Grade over 20
        const totalQuestions = questions.length;
        const gradeOver20 = (finalRawScore / totalQuestions) * 20;
        const formattedGrade = parseFloat(gradeOver20.toFixed(2));

        const payload: SheetPayload = {
            timestamp: new Date().toISOString(),
            studentName: studentData.name,
            studentId: studentData.idNumber,
            score: formattedGrade, // Sending the grade over 20
            total: 20, // Explicitly stating the total score base is 20
            details: JSON.stringify(answers)
        };

        await submitToGoogleSheets(payload);
        setAppState(AppState.RESULTS);
  };

  const handleSubmitExam = async () => {
      // Logic simplified: The user can finish at any time. 
      // We removed the window.confirm barrier to ensure smooth exit even if incomplete.
      // The score calculation handles unanswered questions naturally (defaults to incorrect).
      
      setAppState(AppState.SUBMITTING);
      
      try {
        const score = calculateRawScore();
        await processSubmission(score);
      } catch (e) {
        console.error("Error submitting exam:", e);
        // Even if it fails, show results, don't trap student
        setAppState(AppState.RESULTS);
      }
  };

  const handleTimeUp = () => {
      alert("El tiempo ha terminado. Tu examen se enviará automáticamente con las respuestas actuales.");
      setAppState(AppState.SUBMITTING);
      const score = calculateRawScore();
      processSubmission(score);
  };

  const handleReset = () => {
      // Reset all state to initial values instead of window.reload()
      setStudentData({ name: '', idNumber: '' });
      setQuestions([]);
      setAnswers({});
      setRawScore(0);
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
                La evaluación se calificará sobre <strong>20 puntos</strong>.
                <br/>Tendrás 20 minutos para responder 30 preguntas.
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

  const renderTesting = () => {
      const answeredCount = Object.keys(answers).length;
      const totalQuestions = questions.length;
      const isFinished = answeredCount === totalQuestions;

      return (
        <div className="container mx-auto px-4 py-8 max-w-4xl relative">
            <Timer durationMinutes={20} onTimeUp={handleTimeUp} />
            
            <div className="bg-white rounded-xl shadow-xl p-8 mb-8">
                <div className="mb-6 border-b pb-4">
                    <h2 className="text-2xl font-bold text-gray-800">Examen en Curso</h2>
                    <p className="text-gray-600">Estudiante: <span className="font-semibold">{studentData.name}</span></p>
                </div>

                <ProgressBar current={answeredCount} total={totalQuestions} />

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

                {/* Footer with Finish Button */}
                <div className="mt-10 flex flex-col md:flex-row justify-between items-center bg-gray-50 p-6 rounded-lg border border-gray-200 shadow-sm">
                    <div className="text-gray-600 mb-4 md:mb-0 text-center md:text-left">
                        <div className="text-lg">
                            <span className="font-bold text-gray-800">{answeredCount}</span> de <span className="font-bold text-gray-800">{totalQuestions}</span> preguntas respondidas.
                        </div>
                        {!isFinished && <div className="text-sm text-orange-600 mt-1 font-medium">Las preguntas sin responder valen 0 puntos.</div>}
                    </div>
                    <button 
                        onClick={handleSubmitExam}
                        className={`${isFinished ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white text-lg font-bold py-3 px-8 rounded-lg shadow-lg transform hover:-translate-y-1 transition-all flex items-center`}
                        title="Finalizar evaluación ahora"
                    >
                        {isFinished ? "Finalizar y Enviar" : "Finalizar (Incompleto)"}
                    </button>
                </div>
            </div>
        </div>
      );
  };

  const renderSubmitting = () => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
         <div className="text-sky-600 mb-4">
            <Spinner />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Procesando respuestas...</h2>
        <p className="text-gray-500 mt-2">Calculando nota final sobre 20.</p>
    </div>
  );

  const renderResults = () => {
      // Calculate grade over 20
      const totalQuestions = questions.length;
      const gradeOver20 = (rawScore / totalQuestions) * 20;
      
      let feedback = "";
      if (gradeOver20 >= 18) feedback = "¡Excelente trabajo!";
      else if (gradeOver20 >= 14) feedback = "Buen trabajo, aprobaste.";
      else if (gradeOver20 >= 10) feedback = "Puedes mejorar.";
      else feedback = "Necesitas repasar los conceptos.";

      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden mb-8">
                <div className="bg-sky-600 p-6 text-white text-center">
                    <h2 className="text-3xl font-bold">Resultados</h2>
                    <p className="opacity-90 mt-1">{studentData.name}</p>
                </div>
                
                <div className="p-8">
                    <div className="flex flex-col md:flex-row gap-8 items-center justify-center">
                        <div className="w-full md:w-1/3 flex flex-col items-center">
                             {/* Reusing existing chart for visual accuracy ratio */}
                             <ResultsChart score={rawScore} total={questions.length} />
                             <p className="text-gray-400 text-xs mt-2">Precisión de aciertos</p>
                        </div>
                        <div className="w-full md:w-2/3 text-center md:text-left">
                            
                            {/* NEW GRADE DISPLAY */}
                            <div className="mb-6 border-b pb-6">
                                <p className="text-gray-500 text-sm uppercase tracking-wide font-bold">Nota Final</p>
                                <div className="flex items-baseline justify-center md:justify-start gap-2">
                                    <span className={`text-5xl font-extrabold ${gradeOver20 >= 14 ? 'text-green-600' : 'text-red-600'}`}>
                                        {gradeOver20.toFixed(2)}
                                    </span>
                                    <span className="text-2xl text-gray-400 font-bold">/ 20</span>
                                </div>
                            </div>

                            <p className="text-2xl font-medium text-gray-800 mb-2">{feedback}</p>
                            <p className="text-gray-500 mb-6">
                                Se ha generado el registro de tu nota. <br/>
                                <span className="text-xs text-orange-600">Nota: Si no hay conexión al servidor, se descargará un archivo CSV de respaldo con la nota calculada.</span>
                            </p>
                             <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                                <div className="text-center">
                                    <p className="text-gray-500 text-xs uppercase tracking-wider">Total Preguntas</p>
                                    <p className="text-2xl font-bold text-gray-800">{questions.length}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-gray-500 text-xs uppercase tracking-wider">Aciertos</p>
                                    <p className="text-2xl font-bold text-sky-600">{rawScore}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Retroalimentación Detallada */}
                    <div className="mt-10 border-t pt-8">
                        <h3 className="text-xl font-bold text-gray-800 mb-6">Retroalimentación Detallada</h3>
                        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                            {questions.map((q, idx) => {
                                const userAnswerIdx = answers[q.id];
                                const isCorrect = userAnswerIdx === q.correctOptionIndex;
                                const isUnanswered = userAnswerIdx === undefined;
                                
                                let statusClass = "";
                                let statusText = "";
                                if (isUnanswered) {
                                    statusClass = "border-orange-200 bg-orange-50";
                                    statusText = "No Contestada (0 pts)";
                                } else if (isCorrect) {
                                    statusClass = "border-green-200 bg-green-50";
                                    statusText = "Correcta";
                                } else {
                                    statusClass = "border-red-200 bg-red-50";
                                    statusText = "Incorrecta";
                                }

                                return (
                                    <div key={q.id} className={`p-4 rounded-lg border ${statusClass}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <p className="font-semibold text-gray-800 pr-4">
                                                <span className="text-gray-500 mr-2">{idx + 1}.</span> {q.text}
                                            </p>
                                            <span className={`text-xs font-bold px-2 py-1 rounded ${
                                                isCorrect ? "bg-green-200 text-green-800" : isUnanswered ? "bg-orange-200 text-orange-800" : "bg-red-200 text-red-800"
                                            }`}>
                                                {statusText}
                                            </span>
                                        </div>
                                        
                                        <div className="text-sm space-y-1">
                                            {!isUnanswered && (
                                                <p className={isCorrect ? "text-green-700" : "text-red-600"}>
                                                    <span className="font-bold">Tu respuesta:</span> {q.options[userAnswerIdx]}
                                                </p>
                                            )}
                                            {isUnanswered && (
                                                <p className="text-orange-600 italic">No seleccionaste ninguna opción.</p>
                                            )}
                                            {!isCorrect && (
                                                <p className="text-gray-700">
                                                    <span className="font-bold">Respuesta correcta:</span> {q.options[q.correctOptionIndex]}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <button 
                        onClick={handleReset}
                        className="mt-8 w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-lg font-semibold transition-colors shadow-lg"
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