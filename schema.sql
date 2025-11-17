CREATE TABLE IF NOT EXISTS exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  body_parts TEXT NOT NULL,
  dif_level VARCHAR(20) NOT NULL CHECK (dif_level IN ('EASY', 'MEDIUM', 'HARD')),
  common_mistakes TEXT NOT NULL,
  position VARCHAR(20) NOT NULL CHECK (position IN ('STANDING', 'SEATED', 'FLOOR')),
  steps TEXT NOT NULL,
  tips TEXT NOT NULL,
  embedding JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_exercises_dif_level ON exercises(dif_level);
CREATE INDEX idx_exercises_position ON exercises(position);

CREATE TABLE IF NOT EXISTS past_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) UNIQUE NOT NULL,
  user_id VARCHAR(255) NOT NULL,
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

-- Trigger function for exercises table
CREATE OR REPLACE FUNCTION notify_exercise_change()
RETURNS TRIGGER AS $$
DECLARE
  exercise_id_val UUID;
  operation_type TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    exercise_id_val := OLD.id;
    operation_type := 'DELETE';
  ELSE
    exercise_id_val := NEW.id;
    operation_type := TG_OP;
  END IF;

  PERFORM pg_notify(
    'exercise_changes',
    json_build_object(
      'exercise_id', exercise_id_val,
      'operation', operation_type
    )::text
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Triggers on exercises table
DROP TRIGGER IF EXISTS exercise_insert_trigger ON exercises;
CREATE TRIGGER exercise_insert_trigger
  AFTER INSERT ON exercises
  FOR EACH ROW
  EXECUTE FUNCTION notify_exercise_change();

DROP TRIGGER IF EXISTS exercise_update_trigger ON exercises;
CREATE TRIGGER exercise_update_trigger
  AFTER UPDATE ON exercises
  FOR EACH ROW
  WHEN (
    OLD.title IS DISTINCT FROM NEW.title OR
    OLD.description IS DISTINCT FROM NEW.description OR
    OLD.body_parts IS DISTINCT FROM NEW.body_parts OR
    OLD.dif_level IS DISTINCT FROM NEW.dif_level OR
    OLD.common_mistakes IS DISTINCT FROM NEW.common_mistakes OR
    OLD.position IS DISTINCT FROM NEW.position OR
    OLD.steps IS DISTINCT FROM NEW.steps OR
    OLD.tips IS DISTINCT FROM NEW.tips
  )
  EXECUTE FUNCTION notify_exercise_change();

DROP TRIGGER IF EXISTS exercise_delete_trigger ON exercises;
CREATE TRIGGER exercise_delete_trigger
  AFTER DELETE ON exercises
  FOR EACH ROW
  EXECUTE FUNCTION notify_exercise_change();

