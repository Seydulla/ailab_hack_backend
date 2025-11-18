export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD';
export type Position = 'STANDING' | 'SEATED' | 'FLOOR';

export interface IUserProfile {
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
  duration: number | null;
  includeRestPeriod: boolean;
  restDuration: number;
  thumbnail_URL?: string | null;
  video_URL?: string | null;
  male_thumbnail_URL?: string | null;
  male_video_URL?: string | null;
  embedding?: number[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPastSession {
  sessionId: string;
  date: Date;
  exercises: IExercise[];
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
  thumbnail_URL?: string | null;
  video_URL?: string | null;
  male_thumbnail_URL?: string | null;
  male_video_URL?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ExerciseResultMistake {
  mistake: string;
  count: number;
}

export interface ExerciseResultItem {
  exercise_title: string;
  time_spent: number;
  repeats: number;
  total_reps: number;
  total_duration: number;
  calories: number;
  exercise_id: string;
  mistakes: ExerciseResultMistake[];
  average_accuracy?: number;
}

export interface ExerciseResults {
  target_duration_seconds: number;
  completed_reps_count: number;
  target_reps_count: number;
  calories_burned: number;
  completion_percentage: number;
  total_mistakes: number;
  accuracy_score: number;
  efficiency_score: number;
  total_exercise: number;
  actual_hold_time_seconds: number;
  target_hold_time_seconds: number;
  exercises: ExerciseResultItem[];
  notes?: string;
}

export interface PastSessionRow {
  id: string;
  session_id: string;
  user_id: string;
  date: Date;
  notes: string | null;
  target_duration_seconds?: number | null;
  completed_reps_count?: number | null;
  target_reps_count?: number | null;
  calories_burned?: number | null;
  completion_percentage?: number | null;
  total_mistakes?: number | null;
  accuracy_score?: number | null;
  efficiency_score?: number | null;
  total_exercise?: number | null;
  actual_hold_time_seconds?: number | null;
  target_hold_time_seconds?: number | null;
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
  | 'EXERCISE_SUMMARY'
  | 'COMPLETED';

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
