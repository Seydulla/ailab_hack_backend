export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD';
export type Position = 'STANDING' | 'SEATED' | 'FLOOR';

export interface IUserProfile {
  id: string;
  userId: string;
  age: number;
  weight: number;
  height: number;
  gender: Gender;
  createdAt: Date;
  updatedAt: Date;
}

export interface IExercise {
  id: string;
  title: string;
  bodyParts: string[];
  description: string;
  difLevel: DifficultyLevel;
  commonMistakes: string;
  position: Position;
  steps: string[];
  tips: string;
  embedding: number[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPastSession {
  sessionId: string;
  date: Date;
  exercises: IExercise[];
  volume: number;
  qualityScore: number;
  formErrors: string[];
  notes?: string;
  embedding: number[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExerciseRow {
  id: string;
  title: string;
  description: string;
  body_parts: string;
  dif_level: string;
  common_mistakes: string;
  position: string;
  steps: string;
  tips: string;
  embedding: number[] | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserProfileRow {
  id: string;
  user_id: string;
  age: number;
  weight: number;
  height: number;
  gender: string;
  created_at: Date;
  updated_at: Date;
}

export interface PastSessionRow {
  id: string;
  session_id: string;
  user_id: string;
  date: Date;
  volume: number;
  quality_score: number;
  notes: string | null;
  embedding: number[] | null;
  created_at: Date;
  updated_at: Date;
}

export interface SessionExerciseRow {
  exercise_id: string;
  order_index: number;
}

export interface SessionFormErrorRow {
  error: string;
}
