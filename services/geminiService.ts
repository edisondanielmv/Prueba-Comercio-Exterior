import { Question } from "../types";
import { RAW_QUESTION_BANK } from "../data/rawQuestions";

/**
 * Parses the raw question bank into structured objects.
 * This version is adapted for the "Case Study" format provided in the raw data.
 * It does NOT use AI to rephrase, preserving the exact text.
 */
const parseFullBankLocal = (): Question[] => {
    const questions: Question[] = [];
    
    // The dataset is a large string. We can split by "Respuesta correcta:" which appears at the end of each block.
    // However, splitting by "CASO" might be safer to get the start, but some don't have "CASO".
    // Strategy: Split by "Respuesta correcta:", then process the chunk backwards to find options.
    
    const blocks = RAW_QUESTION_BANK.split(/Respuesta correcta:\s*/i);
    
    // The split removes the separator. The last part of the previous block + the separator + start of next block
    // actually, split creates an array where the end of one question is tied to the start of the next.
    // Let's refine: The raw text has cases separated roughly by newlines.
    
    // Better approach: Iterate line by line to build questions statefully.
    const lines = RAW_QUESTION_BANK.split('\n');
    
    let currentTextLines: string[] = [];
    let currentOptions: string[] = [];
    let currentAnswerChar = '';
    
    let state: 'READING_TEXT' | 'READING_OPTIONS' = 'READING_TEXT';

    const saveCurrentQuestion = () => {
        if (currentTextLines.length > 0 && currentOptions.length === 4 && currentAnswerChar) {
            // Map answer char (A, B, C, D) to index (0, 1, 2, 3)
            const code = currentAnswerChar.toUpperCase().charCodeAt(0);
            const correctIndex = code - 65; // A=65 -> 0

            if (correctIndex >= 0 && correctIndex <= 3) {
                // Clean up text lines (remove empty headers if any)
                const fullText = currentTextLines
                    .map(l => l.trim())
                    .filter(l => l.length > 0)
                    .join(' ')
                    // Remove artifacts like "CASO X —" if desired, but user said "no modificar texto",
                    // so we keep it mostly as is, maybe just trimming extra spaces.
                    .trim();

                questions.push({
                    id: questions.length + 1,
                    text: fullText,
                    options: [...currentOptions],
                    correctOptionIndex: correctIndex
                });
            }
        }
        // Reset
        currentTextLines = [];
        currentOptions = [];
        currentAnswerChar = '';
        state = 'READING_TEXT';
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Check for Answer line
        if (line.match(/^Respuesta correcta:/i)) {
            // Extract the letter (A, B, C, D)
            // Format is usually "Respuesta correcta: B" or "Respuesta correcta: B. EXW"
            const match = line.match(/Respuesta correcta:\s*([A-D])/i);
            if (match) {
                currentAnswerChar = match[1];
                saveCurrentQuestion();
                continue; 
            }
        }

        // Check for Options Start
        // Options usually start with "A.", "A)", "Opciones:", etc.
        if (line.match(/^Opciones:/i)) {
            state = 'READING_OPTIONS';
            continue;
        }

        // Check for specific option lines
        const optionMatch = line.match(/^([A-D])[\.\)]\s*(.*)/); // Matches "A. text" or "A) text"
        if (optionMatch) {
            state = 'READING_OPTIONS';
            // optionMatch[2] is the text content of the option
            // If the text is just "A. FCA", content is "FCA"
            currentOptions.push(optionMatch[2].trim() || optionMatch[0].trim());
            continue;
        }

        // If not answer and not option, it's text context (unless we are in options mode and it's a continuation?)
        // The format provided is very clean: Description -> Opciones -> A,B,C,D -> Answer.
        if (state === 'READING_TEXT') {
            // Ignore pagination markers or headers if needed, but user said keep text.
            // We might filter out "PÁGINA X" headers to keep it clean.
            if (!line.match(/^PÁGINA \d+/i) && !line.match(/^✔/)) {
                 currentTextLines.push(line);
            }
        }
    }

    return questions;
};

export const generateExamQuestions = async (): Promise<Question[]> => {
    // 1. Parse the FULL bank locally
    const allQuestions = parseFullBankLocal();

    // 2. Randomly select 20 UNIQUE questions
    const selectedQuestions = allQuestions
        .sort(() => 0.5 - Math.random()) // Shuffle full bank
        .slice(0, 20) // Take first 20
        .map((q, idx) => ({ ...q, id: idx + 1 })); // Re-index 1 to 20 for the current exam session

    // Return directly without AI rephrasing as requested
    return selectedQuestions;
};