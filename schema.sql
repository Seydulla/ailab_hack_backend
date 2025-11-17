CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) UNIQUE NOT NULL,
  age INTEGER NOT NULL,
  weight DECIMAL(5, 2) NOT NULL,
  height DECIMAL(5, 2) NOT NULL,
  gender VARCHAR(20) NOT NULL CHECK (gender IN ('MALE', 'FEMALE', 'OTHER')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);

CREATE TABLE IF NOT EXISTS exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  dif_level VARCHAR(20) NOT NULL CHECK (dif_level IN ('EASY', 'MEDIUM', 'HARD')),
  common_mistakes TEXT NOT NULL,
  position VARCHAR(20) NOT NULL CHECK (position IN ('STANDING', 'SEATED', 'FLOOR')),
  tips TEXT NOT NULL,
  embedding JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_exercises_dif_level ON exercises(dif_level);
CREATE INDEX idx_exercises_position ON exercises(position);

CREATE TABLE IF NOT EXISTS exercise_body_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  UNIQUE(exercise_id, name)
);

CREATE INDEX idx_exercise_body_parts_exercise_id ON exercise_body_parts(exercise_id);

CREATE TABLE IF NOT EXISTS exercise_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  UNIQUE(exercise_id, order_index)
);

CREATE INDEX idx_exercise_steps_exercise_id ON exercise_steps(exercise_id);

CREATE TABLE IF NOT EXISTS past_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) UNIQUE NOT NULL,
  user_id VARCHAR(255) NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  date TIMESTAMP NOT NULL,
  volume DECIMAL(10, 2) NOT NULL,
  quality_score DECIMAL(3, 2) NOT NULL CHECK (quality_score >= 0 AND quality_score <= 1),
  notes TEXT,
  embedding JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_past_sessions_user_id ON past_sessions(user_id);
CREATE INDEX idx_past_sessions_date ON past_sessions(date);
CREATE INDEX idx_past_sessions_session_id ON past_sessions(session_id);

CREATE TABLE IF NOT EXISTS session_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES past_sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  UNIQUE(session_id, order_index)
);

CREATE INDEX idx_session_exercises_session_id ON session_exercises(session_id);
CREATE INDEX idx_session_exercises_exercise_id ON session_exercises(exercise_id);

CREATE TABLE IF NOT EXISTS session_form_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES past_sessions(id) ON DELETE CASCADE,
  error VARCHAR(255) NOT NULL
);

CREATE INDEX idx_session_form_errors_session_id ON session_form_errors(session_id);

