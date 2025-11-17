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
  goals: string;
  injuries: string;
  lifestyle?: string;
  equipment?: string;
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
  reps: number | null;
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
  external_id: string;
  title: string;
  description: string;
  body_parts: string;
  dif_level: string;
  common_mistakes: string;
  position: string;
  steps: string;
  tips: string;
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

export type WorkflowStep =
  | 'PROFILE_INTAKE'
  | 'PROFILE_CONFIRMATION'
  | 'EXERCISE_RECOMMENDATION'
  | 'EXERCISE_CONFIRMATION'
  | 'EXERCISE_SUMMARY';

export interface Message {
  role: 'user' | 'model';
  content: string;
}

export interface SessionState {
  userId: string;
  step: WorkflowStep;
  profileData?: IUserProfile;
  conversationHistory: Message[];
  exerciseRecommendations?: IExercise[];
  selectedExercises?: IExercise[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowResponse {
  response: string;
  action?: 'CONFIRMATION';
  step: string;
  data?: {
    profileData?: IUserProfile;
    exercises?: IExercise[];
  };
}
