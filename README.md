# AI-Powered Fitness Assistant Backend

An intelligent fitness coaching system that provides personalized workout recommendations using AI-driven conversational interfaces, vector similarity search, and real-time data synchronization.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Technologies](#technologies)
- [Key Features](#key-features)
- [System Flows](#system-flows)
- [Internal Processes](#internal-processes)
- [Data Flow](#data-flow)
- [Setup & Installation](#setup--installation)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)

## 🎯 Overview

This backend service powers an AI fitness assistant that:

1. **Collects user profiles** through natural conversation (age, weight, height, goals, injuries, etc.)
2. **Generates personalized workouts** using AI and vector similarity search
3. **Tracks workout performance** with detailed metrics and AI-generated summaries
4. **Learns from past sessions** to improve future recommendations
5. **Auto-syncs data** between PostgreSQL and Qdrant vector database in real-time

## 🏗️ Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Application                       │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/REST
┌────────────────────────────▼────────────────────────────────────┐
│                     Express.js API Server                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            Workflow Engine (workflow.ts)                  │  │
│  │  • Profile Intake  • Exercise Recommendation             │  │
│  │  • Confirmations   • Summary Generation                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─┬──────────────┬──────────────┬──────────────┬────────────────┘
  │              │              │              │
  │ Gemini AI    │ PostgreSQL   │ Qdrant      │ Redis
  │ (LLM + Embed)│ (Primary DB) │ (Vector DB) │ (Sessions)
  │              │              │              │
┌─▼──────────┐ ┌─▼──────────┐ ┌─▼──────────┐ ┌─▼──────────┐
│  Google    │ │ PostgreSQL │ │  Qdrant    │ │   Redis    │
│  Gemini    │ │            │ │            │ │            │
│  - 2.0     │ │ - Users    │ │ - Exercise │ │ - Session  │
│    Flash   │ │ - Exercise │ │   Vectors  │ │   State    │
│  - Text    │ │ - Sessions │ │ - Workout  │ │ - History  │
│    Embed   │ │ - Results  │ │   Vectors  │ │ - TTL 24h  │
│    004     │ │            │ │            │ │            │
└────────────┘ └─────┬──────┘ └────────────┘ └────────────┘
                     │
              ┌──────▼───────┐
              │  PostgreSQL  │
              │  LISTEN/     │
              │  NOTIFY      │
              │  Triggers    │
              └──────┬───────┘
                     │
              ┌──────▼───────────────┐
              │  Trigger Listener    │
              │  (triggerListener.ts)│
              └──────┬───────────────┘
                     │
         ┌───────────┴──────────────┐
         │                          │
    ┌────▼────────┐        ┌────────▼─────┐
    │ Exercise    │        │  Workout     │
    │ Sync        │        │  Sync        │
    │ (DB → Vec)  │        │  (DB → Vec)  │
    └─────────────┘        └──────────────┘
```

### Component Responsibilities

**Express.js API Server** (`src/index.ts`, `src/app.ts`)

- Handles HTTP requests and routing
- Manages connections to all services
- Graceful shutdown handling

**Workflow Engine** (`src/services/workflow.ts`)

- Orchestrates multi-step conversational flow
- Manages state transitions
- Integrates AI responses with data validation

**Session Manager** (`src/services/session.ts`)

- Redis-based session storage
- 24-hour TTL for automatic cleanup
- Maintains conversation history and user context

**Qdrant Services** (`src/services/qdrant.ts`)

- Initializes vector collections
- Manages exercise and workout embeddings

**Sync Services**

- **Exercise Sync** (`src/services/exerciseSync.ts`): Syncs exercises from PostgreSQL to Qdrant
- **Workout Sync** (`src/services/workoutSync.ts`): Syncs completed workouts and searches similar sessions

**Trigger Listener** (`src/services/triggerListener.ts`)

- Listens to PostgreSQL NOTIFY events
- Automatically triggers sync operations
- Reconnects on connection loss

**Utilities** (`src/utils.ts`)

- Text embedding generation
- TOON format encoding/decoding (compact JSON alternative)
- Profile data extraction and validation
- AI summary generation
- Retry logic for reliability

## 🛠️ Technologies

### Core Stack

| Technology     | Purpose               | Version |
| -------------- | --------------------- | ------- |
| **Node.js**    | Runtime environment   | 22+     |
| **TypeScript** | Type-safe JavaScript  | 5.7.2   |
| **Express**    | HTTP server framework | 4.21.1  |

### Databases & Storage

| Technology     | Purpose          | Details                                        |
| -------------- | ---------------- | ---------------------------------------------- |
| **PostgreSQL** | Primary database | 18-alpine, stores exercises, sessions, results |
| **Qdrant**     | Vector database  | Stores embeddings for similarity search        |
| **Redis**      | Session cache    | 7-alpine, 24h TTL for session state            |

### AI & Machine Learning

| Technology                  | Purpose               | Details                                    |
| --------------------------- | --------------------- | ------------------------------------------ |
| **Google Gemini 2.0 Flash** | LLM for conversations | Profile intake, recommendations, summaries |
| **Text-Embedding-004**      | Text embeddings       | 768-dim vectors for similarity search      |
| **TOON Format**             | Compact data encoding | More efficient than JSON for AI prompts    |

### Infrastructure

| Technology | Purpose          | Details                         |
| ---------- | ---------------- | ------------------------------- |
| **Docker** | Containerization | Multi-service orchestration     |
| **Nginx**  | Reverse proxy    | SSL termination, load balancing |
| **PM2**    | Process manager  | Production app management       |

## ✨ Key Features

### 1. AI-Powered Conversational Interface

- Natural language profile collection
- Context-aware responses
- Multi-turn conversation handling
- Confirmation/cancellation flows

### 2. Intelligent Exercise Recommendations

- Vector similarity search for exercise matching
- Injury-aware filtering (excludes affected body parts)
- Past workout analysis for personalized suggestions
- Difficulty level adaptation

### 3. Real-Time Data Synchronization

- PostgreSQL triggers automatically notify changes
- Background listener processes sync events
- Exercises sync to Qdrant on INSERT/UPDATE/DELETE
- Workout sessions sync on completion
- Retry logic for reliability

### 4. Personalized Workout Learning

- Stores past workout performance
- Searches similar sessions using vector embeddings
- Uses historical data to improve recommendations
- Considers accuracy scores, mistakes, and completion rates

### 5. Comprehensive Performance Tracking

- Per-exercise metrics (reps, duration, calories, mistakes)
- Overall session metrics (completion %, accuracy, efficiency)
- AI-generated encouraging summaries
- Mistake tracking with counts

## 🔄 System Flows

### Main User Workflow (Sequential)

These flows represent the sequential journey a user takes from starting a conversation to completing a workout.

### Flow 1: Profile Intake

```
┌─────────────┐
│   User      │
│  "I want    │
│  to start"  │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Workflow: PROFILE_INTAKE            │
│                                      │
│  1. Check existing session (Redis)  │
│  2. Create/load session state       │
│  3. Send to Gemini AI with prompt  │
│  4. Extract profile data if present│
│  5. Validate completeness          │
└──────┬──────────────────────────────┘
       │
       ├── Incomplete ──┐
       │                │
       │                ▼
       │         ┌──────────────┐
       │         │ Ask for more │
       │         │ information  │
       │         └──────┬───────┘
       │                │
       │◄───────────────┘
       │
       ├── Complete
       │
       ▼
┌────────────────────────────────────┐
│  Workflow: PROFILE_CONFIRMATION     │
│                                     │
│  1. Store profile in session        │
│  2. Present data to user            │
│  3. Request confirmation            │
└──────┬──────────────────────────────┘
       │
       ├── User: "CONFIRM"
       │
       ▼
┌────────────────────────────────────┐
│  Proceed to Exercise                │
│  Recommendation                     │
└─────────────────────────────────────┘
```

### Flow 2: Exercise Recommendation

```
┌─────────────────────────────────────┐
│  Workflow: EXERCISE_RECOMMENDATION   │
└──────┬──────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  Step 1: Search Query Refinement     │
│                                       │
│  • Send profile + injuries to AI     │
│  • AI generates optimized query      │
│  • AI identifies body parts to       │
│    exclude based on injuries         │
│                                       │
│  Example:                            │
│    Injury: "knee pain"               │
│    → Exclude: ["knees", "legs"]      │
│    → Query: "upper body strength"    │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  Step 2: Find Similar Past Workouts  │
│                                       │
│  • Embed refined query (768-dim)     │
│  • Search Qdrant workout_sessions    │
│  • Filter by user_id                 │
│  • Get top 5 similar sessions        │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  Step 3: Retrieve Past Performance   │
│                                       │
│  • Query PostgreSQL for session      │
│    details (exercises, metrics)      │
│  • Include: accuracy, mistakes,      │
│    completion %, calories burned     │
│  • Encode to TOON format (compact)   │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  Step 4: Search Exercise Database    │
│                                       │
│  • Search Qdrant exercises           │
│  • Use refined query embedding       │
│  • Apply body part filters           │
│  • Get top 50 candidates             │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  Step 5: AI Workout Generation       │
│                                       │
│  Prompt includes:                    │
│  • Profile data (TOON)               │
│  • Similar sessions data (TOON)      │
│  • Available exercises (TOON)        │
│                                       │
│  AI decides:                         │
│  • Which exercises to include        │
│  • Reps/duration for each            │
│  • Rest periods                      │
│  • Exercise order                    │
│  • Warm-up/cool-down phases          │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  Step 6: Exercise Validation         │
│                                       │
│  • Parse AI response (TOON/JSON)     │
│  • Validate each exercise ID         │
│  • Fetch full details from DB        │
│  • Ensure data integrity             │
│  • Skip invalid exercises            │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  Workflow: EXERCISE_CONFIRMATION     │
│                                       │
│  • Store recommendations in session  │
│  • Present to user                   │
│  • Request confirmation              │
└──────────────────────────────────────┘
```

### Flow 3: Workout Completion

```
┌─────────────────────────────────┐
│  User completes workout         │
│  Mobile app sends results       │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  POST /api/workflow                      │
│  step: EXERCISE_SUMMARY                  │
│                                          │
│  Body (as JSON string):                  │
│  {                                       │
│    target_duration_seconds: 1800,        │
│    completed_reps_count: 85,             │
│    target_reps_count: 100,               │
│    calories_burned: 250.5,               │
│    completion_percentage: 85.0,          │
│    total_mistakes: 12,                   │
│    accuracy_score: 88.5,                 │
│    efficiency_score: 82.3,               │
│    total_exercise: 5,                    │
│    exercises: [                          │
│      {                                   │
│        exercise_id: "ex_001",            │
│        exercise_title: "Squats",         │
│        time_spent: 300,                  │
│        repeats: 3,                       │
│        total_reps: 36,                   │
│        calories: 80.2,                   │
│        mistakes: [...],                  │
│        average_accuracy: 0.92            │
│      },                                  │
│      ...                                 │
│    ],                                    │
│    notes: "Felt good overall"            │
│  }                                       │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Workflow: processExerciseSummary        │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Step 1: Generate AI Summary             │
│                                          │
│  • Send results to Gemini                │
│  • AI analyzes performance               │
│  • Creates encouraging summary           │
│  • Highlights strengths/improvements     │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Step 2: PostgreSQL Transaction          │
│                                          │
│  BEGIN;                                  │
│                                          │
│  1. INSERT past_sessions                 │
│     → Returns session ID (UUID)          │
│                                          │
│  2. INSERT session_exercises             │
│     → Links exercises to session         │
│     → Maintains order                    │
│                                          │
│  3. INSERT session_exercise_results      │
│     → Stores per-exercise metrics        │
│     → Stores mistakes as JSONB           │
│                                          │
│  COMMIT;                                 │
└──────┬──────────────────────────────────┘
       │
       │ (Automatically triggers sync)
       │
       ▼
┌─────────────────────────────────────────┐
│  PostgreSQL Trigger Fires                │
│  → past_session_insert_trigger           │
│  → NOTIFY past_session_changes           │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Trigger Listener Receives Event         │
│  → Calls syncWorkoutSessionToQdrant()    │
│  → Stores workout embedding in Qdrant    │
│  → Tagged with user_id for filtering     │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Step 3: Clear Session                   │
│                                          │
│  • Delete from Redis                     │
│  • Session complete                      │
│  • Ready for new workflow                │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Return AI Summary to User               │
│                                          │
│  Example:                                │
│  "Great workout! You completed 85%       │
│   with 88.5% accuracy. Squats looked     │
│   excellent with 92% form. Watch for     │
│   hip sagging in push-ups. Keep it up!" │
└──────────────────────────────────────────┘
```

### Background Processes (Automatic)

These processes run continuously in the background, independent of user interactions, to keep data synchronized across systems.

### Flow 4: Real-Time Data Sync

```
┌──────────────────────────────────┐
│  PostgreSQL: INSERT/UPDATE/      │
│  DELETE on exercises table       │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  Trigger: notify_exercise_change│
│                                  │
│  • Captures exercise_id          │
│  • Identifies operation type     │
│  • Sends NOTIFY event            │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  Trigger Listener                │
│  (Always running)                │
│                                  │
│  • Receives NOTIFY               │
│  • Parses payload                │
│  • Routes to handler             │
└──────┬───────────────────────────┘
       │
       ├── INSERT/UPDATE
       │   │
       │   ▼
       │  ┌─────────────────────────┐
       │  │ Exercise Sync           │
       │  │                         │
       │  │ 1. Fetch from DB        │
       │  │ 2. Build embedding text │
       │  │ 3. Generate embedding   │
       │  │ 4. Upsert to Qdrant     │
       │  └─────────────────────────┘
       │
       └── DELETE
           │
           ▼
          ┌─────────────────────────┐
          │ Delete from Qdrant      │
          │                         │
          │ • Remove vector point   │
          │ • Maintain consistency  │
          └─────────────────────────┘

┌──────────────────────────────────┐
│  PostgreSQL: INSERT on           │
│  past_sessions table             │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  Trigger: notify_past_session   │
│  _change                         │
│                                  │
│  • Captures session details      │
│  • Sends NOTIFY event            │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  Workout Sync                    │
│                                  │
│  1. Fetch session exercises      │
│  2. Build combined embedding     │
│  3. Generate embedding           │
│  4. Store in Qdrant with         │
│     user_id and session_id       │
└──────────────────────────────────┘
```

This background process ensures that:

- Any exercise added/updated in PostgreSQL is automatically synced to Qdrant
- Any completed workout session is automatically embedded and stored in Qdrant
- The vector database stays in sync with the relational database
- No manual intervention is required

## 🔍 Internal Processes

### Profile Data Extraction

The system uses a structured approach to extract profile information from conversational text:

1. **AI Response Format**: Gemini is instructed to output profile data in a structured format:

```
<PROFILE_DATA>
{
  age: 28,
  weight: 75,
  height: 180,
  gender: "MALE",
  goals: "build muscle",
  injuries: "none",
  lifestyle: "active",
  equipment: "gym access"
}
</PROFILE_DATA>
```

2. **Extraction Logic** (`utils.ts::extractProfileData`):

- Searches for `<PROFILE_DATA>` tags in AI response
- Attempts TOON decoding first (compact format)
- Falls back to JSON parsing
- Validates each field individually
- Returns partial profile if incomplete

3. **Validation** (`utils.ts::isProfileComplete`):

- Checks all required fields: age, weight, height, gender, goals, injuries
- Optional fields: lifestyle, equipment
- Returns boolean for workflow decision

### Vector Embedding Generation

**Purpose**: Convert text to 768-dimensional vectors for similarity search

**Process**:

1. **Exercise Embeddings** (`utils.ts::buildEmbeddingText`):

```typescript
// Combines multiple fields
const embeddingText = [
  exercise.title, // "Squats"
  exercise.description, // "A compound lower body..."
  exercise.body_parts, // "legs, glutes, core"
  exercise.dif_level, // "MEDIUM"
  exercise.common_mistakes, // "Knees caving inward..."
  exercise.position, // "STANDING"
  exercise.steps, // "1. Stand with feet..."
  exercise.tips, // "Keep knees aligned..."
].join('\n');

// Send to Google's text-embedding-004
const embedding = await embedText(embeddingText);
// Returns: [0.123, -0.456, 0.789, ...] (768 numbers)
```

2. **Workout Session Embeddings** (`workoutSync.ts::buildWorkoutEmbeddingText`):

```typescript
// Fetches all exercises in a completed workout
// Builds embeddings for each (without common_mistakes)
// Concatenates all exercise texts
// Generates single embedding representing entire workout
```

3. **Profile Query Embeddings** (`workflow.ts::processExerciseRecommendation`):

```typescript
// Sends profile to AI for refinement
// AI optimizes search query based on goals/injuries
// Embeds refined query
// Uses for similarity search
```

### TOON Format Encoding

**Why TOON?** More compact than JSON, reducing token usage in AI prompts

**Example**:

```javascript
// Original data
const data = {
  ex1: { exerciseId: 'squat_001', reps: 12, duration: null },
  ex2: { exerciseId: 'pushup_002', reps: 10, duration: null },
};

// JSON: 124 characters
JSON.stringify(data);

// TOON: ~80 characters (35% smaller)
toonEncode(data);
```

**Usage in Project**:

- Encoding profile data for AI prompts
- Encoding exercise lists for recommendations
- Encoding past session data for context
- Decoding AI responses with structured data

### Injury-Based Exercise Filtering

**Objective**: Prevent recommending exercises that could aggravate injuries

**Implementation**:

1. **Query Refinement** (`utils.ts::refineSearchQueryWithGemini`):

```typescript
// Input: "Age: 28, Goals: build muscle, Injuries: knee pain"
const response = await gemini.sendMessage({
  message: `User profile: ${profileText}
             Injuries: ${injuries}
             Create refined search query and identify body parts to exclude.`
});

// AI returns:
{
  refinedQuery: "upper body strength exercises, core stability",
  excludeBodyParts: ["knees", "legs", "lower body"]
}
```

2. **Qdrant Filtering** (`workflow.ts::processExerciseRecommendation`):

```typescript
const searchOptions = {
  vector: embedding,
  limit: 50,
  filter: {
    must_not: [
      {
        key: 'bodyParts',
        match: {
          any: ['knees', 'legs', 'lower body'],
        },
      },
    ],
  },
};

// Only returns exercises that DON'T target excluded body parts
const results = await qdrant.search(EXERCISES_COLLECTION_NAME, searchOptions);
```

### Session State Management

**Storage**: Redis with 24-hour TTL

**Session Structure**:

```typescript
interface SessionState {
  userId: string;
  step: WorkflowStep; // Current stage
  conversationHistory: Message[]; // All messages
  profileData?: IUserProfile; // After collection
  exerciseRecommendations?: IExercise[]; // After generation
  selectedExercises?: IExercise[]; // After confirmation
  createdAt: string;
  updatedAt: string;
}
```

**Operations**:

1. **Get Session** (`session.ts::getSession`):

```typescript
const sessionKey = `session:${sessionId}`;
const data = await redisClient.get(sessionKey);
return data ? JSON.parse(data) : null;
```

2. **Set Session** (`session.ts::setSession`):

```typescript
const sessionKey = `session:${sessionId}`;
await redisClient.setEx(
  sessionKey,
  86400, // 24 hours
  JSON.stringify(session)
);
```

3. **Update Session** (`session.ts::updateSession`):

```typescript
// Partial update - merges with existing
const existingSession = await getSession(sessionId);
const updatedSession = { ...existingSession, ...updates };
await setSession(sessionId, updatedSession);
```

4. **Auto-Cleanup**: Redis automatically deletes sessions after 24 hours of inactivity

### Retry Logic

**Purpose**: Handle transient failures in external services

**Implementation** (`utils.ts::withRetry`):

```typescript
await withRetry(
  async () => {
    // Operation that might fail
    return await qdrantClient.upsert(...);
  },
  {
    maxRetries: 3,        // Try 3 times
    delayMs: 1000,        // Wait 1s, 2s, 3s between attempts
    operationName: 'sync exercise to Qdrant'
  }
);
```

**Used for**:

- Qdrant upsert operations
- Embedding generation
- Database queries in sync operations

### PostgreSQL Triggers

**Purpose**: Automatically sync data changes to Qdrant without manual intervention

**Exercise Trigger** (`schema.sql`):

```sql
-- Function
CREATE OR REPLACE FUNCTION notify_exercise_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'exercise_changes',
    json_build_object(
      'exercise_id', NEW.id,
      'operation', TG_OP
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers (INSERT, UPDATE, DELETE)
CREATE TRIGGER exercise_insert_trigger
  AFTER INSERT ON exercises
  FOR EACH ROW
  EXECUTE FUNCTION notify_exercise_change();
```

**Workflow Session Trigger**:

```sql
CREATE TRIGGER past_session_insert_trigger
  AFTER INSERT ON past_sessions
  FOR EACH ROW
  EXECUTE FUNCTION notify_past_session_change();
```

**Listener** (`triggerListener.ts`):

```typescript
// Dedicated PostgreSQL connection for LISTEN
client.query('LISTEN exercise_changes');
client.query('LISTEN past_session_changes');

client.on('notification', async msg => {
  if (msg.channel === 'exercise_changes') {
    const { exercise_id, operation } = JSON.parse(msg.payload);
    if (operation === 'DELETE') {
      await deleteExerciseFromQdrant(exercise_id);
    } else {
      await syncExerciseToQdrant(exercise_id);
    }
  }
});
```

## 📊 Data Flow

### Exercise Data Flow

```
┌──────────────────┐
│  Admin adds      │
│  new exercise    │
│  to PostgreSQL   │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  exercises Table                          │
│  • id (UUID)                              │
│  • external_id (unique)                   │
│  • title, description, body_parts         │
│  • difficulty, position, steps, tips      │
│  • thumbnail_URL, video_URL               │
│  • male_thumbnail_URL, male_video_URL     │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  Trigger: exercise_insert_trigger         │
│  • Fires on INSERT                        │
│  • Sends pg_notify()                      │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  Listener: handleExerciseNotification()  │
│  • Parses notification                    │
│  • Calls syncExerciseToQdrant()           │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  exerciseSync.ts                          │
│  1. Fetch exercise from DB                │
│  2. Build embedding text:                 │
│     title + description + body_parts +    │
│     difficulty + mistakes + position +    │
│     steps + tips                          │
│  3. Generate 768-dim embedding            │
│  4. Parse body_parts & steps to arrays    │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  Qdrant: exercises Collection             │
│  • Point ID: exercise UUID                │
│  • Vector: [0.123, -0.456, ...] (768)     │
│  • Payload:                               │
│    - external_id                          │
│    - title                                │
│    - bodyParts: ["legs", "glutes"]        │
│    - description                          │
│    - difLevel: "MEDIUM"                   │
│    - commonMistakes                       │
│    - position: "STANDING"                 │
│    - steps: ["Stand...", "Lower..."]      │
│    - tips                                 │
│    - timestamps                           │
└───────────────────────────────────────────┘
         │
         │ (Later: Vector search)
         │
         ▼
┌──────────────────────────────────────────┐
│  Workflow: Exercise Recommendation        │
│  • Search by profile embedding            │
│  • Filter by injury exclusions            │
│  • Return top 50 matches                  │
└───────────────────────────────────────────┘
```

### Workout Session Data Flow

```
┌──────────────────┐
│  User completes  │
│  workout         │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  POST /api/workflow                       │
│  • userId, sessionId                      │
│  • Exercise results JSON                  │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  processExerciseSummary()                 │
│  1. Generate AI summary                   │
│  2. Begin transaction                     │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  PostgreSQL Transaction                   │
│                                           │
│  INSERT past_sessions                     │
│    session_id: "session_abc"              │
│    user_id: "user_123"                    │
│    date: NOW()                            │
│    notes: AI summary                      │
│    accuracy_score: 88.5                   │
│    efficiency_score: 82.3                 │
│    completion_percentage: 85.0            │
│    calories_burned: 250.5                 │
│    ... (other metrics)                    │
│    RETURNING id → session_db_id           │
│                                           │
│  INSERT session_exercises (for each)      │
│    session_id: session_db_id              │
│    exercise_id: "squat_001"               │
│    order_index: 0                         │
│                                           │
│  INSERT session_exercise_results (each)   │
│    session_id: session_db_id              │
│    exercise_id: "squat_001"               │
│    exercise_title: "Squats"               │
│    time_spent: 300                        │
│    repeats: 3                             │
│    total_reps: 36                         │
│    calories: 80.2                         │
│    mistakes: JSONB                        │
│    average_accuracy: 0.92                 │
│    order_index: 0                         │
│                                           │
│  COMMIT                                   │
└────────┬─────────────────────────────────┘
         │
         │ (Trigger fires)
         │
         ▼
┌──────────────────────────────────────────┐
│  Trigger: past_session_insert_trigger     │
│  • Fires on INSERT to past_sessions       │
│  • Sends pg_notify() with:                │
│    - session_id (DB UUID)                 │
│    - user_id                              │
│    - original_session_id (session_abc)    │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  Listener: handlePastSessionNotification()│
│  • Parses notification                    │
│  • Calls syncWorkoutSessionToQdrant()     │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  workoutSync.ts                           │
│  1. Query session exercises from DB:      │
│     SELECT e.* FROM exercises e           │
│     INNER JOIN session_exercise_results   │
│     WHERE session_id = ?                  │
│     ORDER BY order_index                  │
│                                           │
│  2. Build embedding text for each:        │
│     title + description + body_parts +    │
│     difficulty + position + steps + tips  │
│     (Note: NO common_mistakes)            │
│                                           │
│  3. Concatenate all exercise texts        │
│  4. Generate single 768-dim embedding     │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  Qdrant: workout_sessions Collection      │
│  • Point ID: session DB UUID              │
│  • Vector: [0.789, 0.234, ...] (768)      │
│  • Payload:                               │
│    - user_id: "user_123"                  │
│    - session_id: "session_abc"            │
└────────┬─────────────────────────────────┘
         │
         │ (Later: Next workout request)
         │
         ▼
┌──────────────────────────────────────────┐
│  Exercise Recommendation Flow             │
│  • Embed new profile query                │
│  • Search workout_sessions                │
│  • Filter: user_id = "user_123"           │
│  • Find similar past workouts             │
│  • Use performance data for better recs   │
└───────────────────────────────────────────┘
```

## 🚀 Setup & Installation

### Prerequisites

- Node.js 22+ and Yarn
- Docker & Docker Compose
- PostgreSQL 18 (via Docker)
- Qdrant (via Docker)
- Redis (via Docker)
- Google Cloud account (for Gemini API)

### Local Development

1. **Clone the repository**

```bash
git clone <repository-url>
cd ailab_hack_backend
```

2. **Install dependencies**

```bash
yarn install
```

3. **Create environment file**

```bash
cp .env.example .env
```

4. **Configure environment variables**

```env
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ailab_hack

# Qdrant
QDRANT_URL=http://localhost:6333

# Redis
REDIS_URL=redis://localhost:6379

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key_here
```

5. **Start infrastructure services**

```bash
# Start PostgreSQL, Qdrant, and Redis
docker-compose up -d

# Check services are running
docker-compose ps
```

6. **Initialize database schema**

```bash
# Connect to PostgreSQL
psql postgresql://postgres:postgres@localhost:5432/ailab_hack

# Run schema
\i schema.sql

# (Optional) Insert sample exercises
\i insert_exercises.sql
```

7. **Start development server**

```bash
yarn dev
```

The server will start on `http://localhost:3000`

### Docker Development

Run everything in Docker:

```bash
# Start all services including the app
docker-compose -f docker-compose.yml up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### Testing the API

```bash
# Health check
curl http://localhost:3000/health

# Start a conversation
curl -X POST http://localhost:3000/api/workflow \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_1",
    "sessionId": "test_session_1",
    "messages": [
      {
        "role": "user",
        "content": "I want to start a workout program"
      }
    ]
  }'
```

## 🌐 Deployment

### Production Setup

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed production deployment instructions.

**Quick overview**:

1. **Provision server** (Ubuntu 22.04+)
2. **Install dependencies** (Node.js, Docker, Nginx)
3. **Clone repository** to `/var/www/ailab_hack_backend`
4. **Configure environment** (`.env.production`)
5. **Set up SSL** with Certbot
6. **Configure Nginx** as reverse proxy
7. **Start with PM2** for process management

### Production Architecture

```
Internet
   │
   ▼
┌─────────────────┐
│  Nginx          │  Port 443 (HTTPS)
│  SSL Termination│
│  Reverse Proxy  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  PM2 Process    │  Port 3000
│  Manager        │
│  (Node.js App)  │
└────────┬────────┘
         │
    ┌────┴────┬─────────┬─────────┐
    │         │         │         │
    ▼         ▼         ▼         ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ Postgres│ │ Qdrant │ │ Redis  │ │ Gemini │
│ Docker  │ │ Docker │ │ Docker │ │ API    │
└─────────┘ └────────┘ └────────┘ └────────┘
```

### Environment Variables (Production)

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/ailab_hack
QDRANT_URL=http://localhost:6333
REDIS_URL=redis://localhost:6379
GEMINI_API_KEY=your_production_key
```

### Monitoring & Logs

```bash
# PM2 logs
pm2 logs ailab-hack

# Docker logs
docker-compose -f docker-compose.prod.yml logs -f

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Database logs
docker-compose -f docker-compose.prod.yml logs postgres
```

## 📚 API Documentation

For detailed API documentation including all endpoints, request/response formats, and examples, see:

**[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)**

### Quick Reference

| Endpoint        | Method | Purpose                               |
| --------------- | ------ | ------------------------------------- |
| `/health`       | GET    | Health check                          |
| `/api/workflow` | POST   | Main conversation & workflow endpoint |

**Workflow Steps**:

1. `PROFILE_INTAKE` - Collect user information
2. `PROFILE_CONFIRMATION` - Confirm profile data
3. `EXERCISE_RECOMMENDATION` - Generate workout
4. `EXERCISE_CONFIRMATION` - Confirm exercises
5. `EXERCISE_SUMMARY` - Submit workout results
6. `COMPLETED` - Workflow finished

## 🗄️ Database Schema

### Tables

**exercises**

```sql
- id: UUID (primary key)
- external_id: VARCHAR (unique, used for integrations)
- title: VARCHAR
- description: TEXT
- body_parts: TEXT (comma-separated)
- dif_level: ENUM ('EASY', 'MEDIUM', 'HARD')
- common_mistakes: TEXT
- position: ENUM ('STANDING', 'SEATED', 'FLOOR')
- steps: TEXT (newline-separated)
- tips: TEXT
- thumbnail_URL: TEXT
- video_URL: TEXT
- male_thumbnail_URL: TEXT
- male_video_URL: TEXT
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

**past_sessions**

```sql
- id: UUID (primary key)
- session_id: VARCHAR (unique, from client)
- user_id: VARCHAR (indexed)
- date: TIMESTAMP (indexed)
- notes: TEXT (includes AI summary)
- target_duration_seconds: INTEGER
- completed_reps_count: INTEGER
- target_reps_count: INTEGER
- calories_burned: DECIMAL(10, 2)
- completion_percentage: DECIMAL(5, 2)
- total_mistakes: INTEGER
- accuracy_score: DECIMAL(5, 2)
- efficiency_score: DECIMAL(5, 2)
- total_exercise: INTEGER
- actual_hold_time_seconds: INTEGER
- target_hold_time_seconds: INTEGER
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

**session_exercises**

```sql
- id: UUID (primary key)
- session_id: UUID (FK → past_sessions.id)
- exercise_id: VARCHAR (FK → exercises.external_id)
- order_index: INTEGER
- UNIQUE(session_id, order_index)
```

**session_exercise_results**

```sql
- id: UUID (primary key)
- session_id: UUID (FK → past_sessions.id)
- exercise_id: VARCHAR (FK → exercises.external_id)
- exercise_title: VARCHAR
- time_spent: INTEGER (seconds)
- repeats: INTEGER (sets completed)
- total_reps: INTEGER
- total_duration: INTEGER (for timer-based)
- calories: DECIMAL(10, 2)
- average_accuracy: DECIMAL(3, 2)
- mistakes: JSONB (array of mistake objects)
- order_index: INTEGER
- UNIQUE(session_id, order_index)
```

### Qdrant Collections

**exercises**

```
Vector Size: 768 dimensions
Distance: Cosine similarity
Payload:
  - external_id (string)
  - title (string)
  - bodyParts (array of strings)
  - description (string)
  - difLevel (string)
  - commonMistakes (string)
  - position (string)
  - steps (array of strings)
  - tips (string)
  - createdAt (ISO string)
  - updatedAt (ISO string)
```

**workout_sessions**

```
Vector Size: 768 dimensions
Distance: Cosine similarity
Payload:
  - user_id (string, indexed)
  - session_id (string)
```

### Redis Keys

```
session:{sessionId}
  Value: JSON string of SessionState
  TTL: 86400 seconds (24 hours)
```
