import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";
import { RAW_QUESTION_BANK } from "../data/rawQuestions";

const fallbackQuestions: Question[] = [
    // A small subset fallback in case API fails completely/offline
    { id: 1, text: "¿Cuál de los siguientes elementos explica mejor por qué el comercio exterior fue determinante en la transición hacia la globalización moderna?", options: ["La eliminación total de los aranceles a nivel mundial", "El desarrollo simultáneo de rutas comerciales, revolución industrial y avances tecnológicos", "La creación de monedas únicas internacionales", "La sustitución del comercio terrestre por el comercio marítimo"], correctOptionIndex: 1 },
    { id: 2, text: "Desde la perspectiva económica, ¿cuál es la diferencia clave entre comercio exterior y comercio internacional?", options: ["El comercio exterior solo incluye exportaciones", "El comercio internacional se limita a bienes y no a servicios", "El comercio exterior se analiza desde la política económica de un país específico", "No existe ninguna diferencia conceptual entre ambos"], correctOptionIndex: 2 },
];

// Helper to parse the raw text locally if API fails (Basic parsing)
const parseLocalBank = (): Question[] => {
    const questions: Question[] = [];
    // Split by Number dot Space (e.g., "1. ") or Number dot Newline
    const blocks = RAW_QUESTION_BANK.split(/\n\d+\.[\s\n]/).filter(b => b.trim().length > 10);
    
    blocks.forEach((block, index) => {
        const lines = block.trim().split('\n');
        const text = lines[0].trim();
        const options: string[] = [];
        let correctIndex = -1;

        // Iterate through lines to find options (A) B) C) D)) and answer
        lines.forEach(line => {
            const cleanLine = line.trim();
            if (cleanLine.match(/^[A-D]\)/)) {
                options.push(cleanLine.replace(/^[A-D]\)\s*/, '').trim());
            }
            // Match "Respuesta correcta: B" or similar
            if (cleanLine.toLowerCase().includes('respuesta correcta:')) {
                const parts = cleanLine.split(':');
                if (parts.length > 1) {
                    const char = parts[1].trim().toLowerCase();
                    correctIndex = char.charCodeAt(0) - 97; // 'a' -> 0, 'b' -> 1
                }
            }
        });

        // Ensure we have 4 options and a valid answer
        if (options.length === 4 && correctIndex >= 0 && correctIndex <= 3) {
            questions.push({
                id: index + 1,
                text,
                options,
                correctOptionIndex: correctIndex
            });
        }
    });

    // Shuffle and pick 30
    const shuffled = questions.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 30);
};

export const generateExamQuestions = async (): Promise<Question[]> => {
    // 1. First try to use Gemini to generate rephrased questions
    try {
        if (!process.env.API_KEY) {
            console.warn("No API Key found, using local parser.");
            return parseLocalBank();
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const systemInstruction = `
        You are an expert academic examiner in International Trade. 
        Your task is to generate a unique exam for a student based strictly on the provided question bank.
        
        Rules:
        1. Randomly select exactly 30 questions from the provided text.
        2. CRITICAL: Ensure the selection is distributed across the entire text (e.g. pick some from the beginning, some from the middle, some from the end). Do not just pick the first 30.
        3. REPHRASE the question stem and the options slightly to prevent students from simply searching for the exact text, but KEEP the meaning and correct answer logic identical.
        4. Shuffle the order of the options (a, b, c, d) for each question so the position of the correct answer varies.
        5. Return strictly JSON format.
        `;

        const prompt = `
        Here is the Question Bank:
        ${RAW_QUESTION_BANK}

        Generate 30 rephrased questions in Spanish.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.INTEGER },
                            text: { type: Type.STRING, description: "The rephrased question text" },
                            options: { 
                                type: Type.ARRAY, 
                                items: { type: Type.STRING },
                                description: "Array of 4 options" 
                            },
                            correctOptionIndex: { 
                                type: Type.INTEGER, 
                                description: "Index (0-3) of the correct option in the provided options array" 
                            }
                        },
                        required: ["id", "text", "options", "correctOptionIndex"]
                    }
                }
            }
        });

        if (response.text) {
            const data = JSON.parse(response.text);
            if (Array.isArray(data) && data.length > 0) {
                return data as Question[];
            }
        }
        
        throw new Error("Invalid API response format");

    } catch (error) {
        console.error("Gemini API failed or key missing, falling back to local shuffle.", error);
        // Fallback: Parse the string locally, shuffle, and return 30.
        return parseLocalBank();
    }
};
