import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";
import { RAW_QUESTION_BANK } from "../data/rawQuestions";

// Helper to parse the raw text locally if API fails (Robust parsing)
const parseLocalBank = (): Question[] => {
    const questions: Question[] = [];
    
    // Split by regex that looks for newline followed by number and dot (e.g. "\n1.")
    // This effectively separates the raw text into blocks for each question.
    const blocks = RAW_QUESTION_BANK.split(/\n\d+\./).filter(b => b.trim().length > 10);
    
    blocks.forEach((block, index) => {
        const lines = block.trim().split('\n');
        
        let questionTextLines: string[] = [];
        const options: string[] = [];
        let correctIndex = -1;
        let parsingOptions = false;

        lines.forEach(line => {
            const cleanLine = line.trim();
            if (!cleanLine) return;

            // Check if it's an option start (A) B) C) D))
            if (cleanLine.match(/^[A-D]\)/)) {
                parsingOptions = true;
                options.push(cleanLine.replace(/^[A-D]\)\s*/, '').trim());
            }
            // Match "Respuesta correcta: B" or similar
            else if (cleanLine.toLowerCase().includes('respuesta correcta:')) {
                const parts = cleanLine.split(':');
                if (parts.length > 1) {
                    const char = parts[1].trim().toLowerCase();
                    // Convert 'a'->0, 'b'->1, etc.
                    if (char.length >= 1) {
                        const code = char.charCodeAt(0);
                        if (code >= 97 && code <= 100) { // a-d
                             correctIndex = code - 97;
                        }
                    }
                }
            }
            // If it's not an option and not the answer line, it's part of the question text/context
            else if (!parsingOptions) {
                questionTextLines.push(cleanLine);
            }
        });

        const fullText = questionTextLines.join(' ');

        // Ensure we have 4 options and a valid answer
        if (options.length === 4 && correctIndex >= 0 && correctIndex <= 3) {
            questions.push({
                id: index + 1, // Temporary ID
                text: fullText,
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
        1. OUTPUT LANGUAGE: STRICTLY SPANISH. Do not generate any English text.
        2. Randomly select exactly 30 questions from the provided text.
        3. CRITICAL: Ensure the selection is distributed across the entire text (beginning, middle, end).
        4. FULL CONTEXT REQUIRED: Many questions are "Case Studies" (Caso práctico) or have introductory paragraphs. You MUST INCLUDE THE FULL CONTEXT/SCENARIO in the 'text' field. Do not truncate the description. The student needs the full info to answer.
        5. REPHRASE: Rewrite the question and the case scenario slightly to prevent exact-match copying (anti-cheating), but PRESERVE ALL INFORMATION necessary to answer. Do not change the meaning or the logic of the correct answer. The rephrased text must be in natural, academic Spanish.
        6. Shuffle the order of the options (a, b, c, d) for each question.
        7. Return strictly JSON format.
        `;

        const prompt = `
        Here is the Question Bank:
        ${RAW_QUESTION_BANK}

        Generate 30 rephrased questions in Spanish. Ensure the language is natural and academic Spanish.
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
                            text: { type: Type.STRING, description: "The full rephrased question text including any case study context in Spanish." },
                            options: { 
                                type: Type.ARRAY, 
                                items: { type: Type.STRING },
                                description: "Array of 4 options in Spanish" 
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