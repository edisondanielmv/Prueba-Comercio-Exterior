export interface Question {
  id: number;
  text: string;
  options: string[];
  correctOptionIndex: number; // 0-3
}

export interface StudentData {
  name: string;
  idNumber: string; // Cedula
}

export interface ExamResult {
  score: number; // 0-20
  totalQuestions: number;
  answers: Record<number, number>; // QuestionID -> SelectedOptionIndex
}

export enum AppState {
  LOGIN = 'LOGIN',
  GENERATING = 'GENERATING',
  TESTING = 'TESTING',
  SUBMITTING = 'SUBMITTING',
  RESULTS = 'RESULTS',
}

export interface SheetPayload {
  timestamp: string;
  studentName: string;
  studentId: string;
  score: number;
  total: number;
  details: string; // JSON string of answers for detailed record
}