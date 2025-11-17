# API Documentation

## Overview

This API provides a conversational fitness assistant that guides users through a personalized workout creation workflow. The system uses AI (Gemini) to collect user profile information and recommend exercises based on their profile.

## Base URL

```
http://localhost:3000
```

_Note: The actual port may vary based on your environment configuration._

## Authentication

Currently, the API does not require authentication. However, you must provide a `userId` and `sessionId` in your requests to maintain session state.

---

## Endpoints

### 1. Health Check

Check if the API server is running.

**Endpoint:** `GET /health`

**Request:**

```http
GET /health HTTP/1.1
Host: localhost:3000
```

**Response:**

```json
{
  "status": "ok"
}
```

**Status Codes:**

- `200 OK` - Server is running

---

### 2. Workflow Processing

Process conversational messages through the fitness assistant workflow.

**Endpoint:** `POST /api/workflow`

**Request Headers:**

```http
Content-Type: application/json
```

**Request Body:**

```typescript
{
  userId: string;        // Unique identifier for the user
  sessionId: string;     // Unique identifier for the session
  messages: Message[];   // Array of conversation messages
}

interface Message {
  role: 'user' | 'model';
  content: string;
}
```

**Response:**

```typescript
{
  response: string;              // AI-generated response text
  action?: 'CONFIRMATION';      // Optional action type
  step: string;                  // Current workflow step
  data?: {                       // Optional data payload
    profileData?: IUserProfile;
    exercises?: IExercise[];
  };
}
```

**Status Codes:**

- `200 OK` - Request processed successfully
- `400 Bad Request` - Invalid request body
- `500 Internal Server Error` - Server error

---

## Workflow Steps

The API follows a multi-step workflow process:

### Step 1: PROFILE_INTAKE

Collect user profile information (age, weight, height, gender, goals, injuries, etc.)

### Step 2: PROFILE_CONFIRMATION

Confirm the collected profile data with the user. Users should respond with **"CONFIRM"** to proceed or **"CANCEL"** to make changes.

### Step 3: EXERCISE_RECOMMENDATION

Generate personalized exercise recommendations based on the user profile

### Step 4: EXERCISE_CONFIRMATION

Confirm the recommended exercises with the user. Users should respond with **"CONFIRM"** to proceed or **"CANCEL"** to request changes or new recommendations.

---

## Confirmation and Cancellation

When the API response includes `action: 'CONFIRMATION'` and the step is either `PROFILE_CONFIRMATION` or `EXERCISE_CONFIRMATION`, users should respond with:

- **"CONFIRM"** - To proceed with the current data/recommendations
- **"CANCEL"** - To make changes or request modifications

**Important:** Use only the exact words "CONFIRM" or "CANCEL" (case-insensitive). These are the recommended commands for confirmation steps.

---

## Request/Response Examples

### Example 1: Initial Profile Intake

**Request:**

```json
{
  "userId": "user_123",
  "sessionId": "session_abc",
  "messages": [
    {
      "role": "user",
      "content": "Hi, I want to start a workout program"
    }
  ]
}
```

**Response:**

```json
{
  "response": "Hello! I'd love to help you create a personalized workout program. To get started, could you tell me your age?",
  "step": "PROFILE_INTAKE"
}
```

---

### Example 2: Providing Age

**Request:**

```json
{
  "userId": "user_123",
  "sessionId": "session_abc",
  "messages": [
    {
      "role": "user",
      "content": "I'm 28 years old"
    }
  ]
}
```

**Response:**

```json
{
  "response": "Great! What's your weight in kilograms?",
  "step": "PROFILE_INTAKE"
}
```

---

### Example 3: Complete Profile Collection

**Request:**

```json
{
  "userId": "user_123",
  "sessionId": "session_abc",
  "messages": [
    {
      "role": "user",
      "content": "I weigh 75kg, I'm 180cm tall, male, I want to build muscle, and I have no injuries. I have access to a gym."
    }
  ]
}
```

**Response:**

```json
{
  "response": "Great! I have all the information I need. You can either continue providing more information or confirm this profile to proceed. Please let me know if you'd like to add anything, or you can confirm to continue.",
  "action": "CONFIRMATION",
  "step": "PROFILE_CONFIRMATION",
  "data": {
    "profileData": {
      "id": "",
      "userId": "user_123",
      "age": 28,
      "weight": 75,
      "height": 180,
      "gender": "MALE",
      "goals": "build muscle",
      "injuries": "none",
      "lifestyle": null,
      "equipment": "gym access",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

---

### Example 4: Confirming Profile

**Request:**

```json
{
  "userId": "user_123",
  "sessionId": "session_abc",
  "messages": [
    {
      "role": "user",
      "content": "Confirm"
    }
  ]
}
```

**Response:**

```json
{
  "response": "Perfect! Based on your profile, I've created a personalized workout program designed to help you build muscle. Here's your workout:\n\n**Warm-Up Phase**\n1. Arm Circles - 30 seconds\n2. Jumping Jacks - 45 seconds\n\n**Main Training Phase**\n3. Squats - 3 sets of 12 reps\n4. Push-ups - 3 sets of 10 reps\n5. Deadlifts - 3 sets of 8 reps\n6. Bench Press - 3 sets of 10 reps\n7. Pull-ups - 3 sets of 8 reps\n8. Shoulder Press - 3 sets of 10 reps\n9. Bicep Curls - 3 sets of 12 reps\n10. Tricep Dips - 3 sets of 10 reps\n\n**Cool-Down Phase**\n11. Stretching - 2 minutes\n\nThis workout is designed to target all major muscle groups and help you build strength and muscle mass. Make sure to rest 60 seconds between sets.",
  "action": "CONFIRMATION",
  "step": "EXERCISE_CONFIRMATION",
  "data": {
    "exercises": [
      {
        "id": "ex_001",
        "title": "Squats",
        "bodyParts": ["legs", "glutes", "core"],
        "description": "A compound lower body exercise targeting quadriceps, hamstrings, and glutes",
        "difLevel": "MEDIUM",
        "commonMistakes": "Knees caving inward, not going low enough",
        "position": "STANDING",
        "steps": [
          "Stand with feet shoulder-width apart",
          "Lower your body as if sitting back into a chair",
          "Keep your chest up and core engaged",
          "Push through your heels to return to standing"
        ],
        "tips": "Keep your knees aligned with your toes",
        "reps": 12,
        "duration": null,
        "includeRestPeriod": true,
        "restDuration": 60,
        "thumbnail_URL": "https://cdn.kinestex.com/uploads/example_thumbnail.webp",
        "video_URL": "https://cdn.kinestex.com/uploads/compressed/example_video.mp4",
        "male_thumbnail_URL": "https://cdn.kinestex.com/media/videos/thumbnails/Squats_Male.jpg",
        "male_video_URL": "https://cdn.kinestex.com/media/videos/compressed/Squats_Male_compressed.mp4",
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      },
      {
        "id": "ex_002",
        "title": "Push-ups",
        "bodyParts": ["chest", "shoulders", "triceps"],
        "description": "A bodyweight exercise targeting the upper body",
        "difLevel": "MEDIUM",
        "commonMistakes": "Sagging hips, not going full range of motion",
        "position": "FLOOR",
        "steps": [
          "Start in plank position",
          "Lower your body until chest nearly touches floor",
          "Push back up to starting position"
        ],
        "tips": "Keep your body in a straight line",
        "reps": 10,
        "duration": null,
        "includeRestPeriod": true,
        "restDuration": 45,
        "thumbnail_URL": "https://cdn.kinestex.com/uploads/pushup_thumbnail.webp",
        "video_URL": "https://cdn.kinestex.com/uploads/compressed/pushup_video.mp4",
        "male_thumbnail_URL": null,
        "male_video_URL": null,
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    ]
  }
}
```

---

### Example 5: Confirming Exercises

**Request:**

```json
{
  "userId": "user_123",
  "sessionId": "session_abc",
  "messages": [
    {
      "role": "user",
      "content": "Confirm"
    }
  ]
}
```

**Response:**

```json
{
  "response": "Great! Your workout is confirmed. Please complete the exercises and submit your results when done.",
  "step": "EXERCISE_SUMMARY"
}
```

---

### Example 6: Canceling Profile Confirmation

**Request:**

```json
{
  "userId": "user_123",
  "sessionId": "session_abc",
  "messages": [
    {
      "role": "user",
      "content": "Cancel"
    }
  ]
}
```

**Response:**

```json
{
  "response": "No problem! What would you like to change or add to your profile?",
  "step": "PROFILE_INTAKE"
}
```

---

### Example 7: Requesting New Exercise Recommendations

**Request:**

```json
{
  "userId": "user_123",
  "sessionId": "session_abc",
  "messages": [
    {
      "role": "user",
      "content": "I want different exercises"
    }
  ]
}
```

**Response:**

```json
{
  "response": "I've generated a new workout program for you. Here's your updated workout:\n\n**Warm-Up Phase**\n1. Dynamic Stretching - 2 minutes\n\n**Main Training Phase**\n2. Lunges - 3 sets of 12 reps per leg\n3. Overhead Press - 3 sets of 10 reps\n4. Rows - 3 sets of 12 reps\n5. Leg Press - 3 sets of 15 reps\n6. Chest Flyes - 3 sets of 12 reps\n7. Lateral Raises - 3 sets of 15 reps\n8. Calf Raises - 3 sets of 20 reps\n\n**Cool-Down Phase**\n9. Full Body Stretch - 2 minutes",
  "action": "CONFIRMATION",
  "step": "EXERCISE_CONFIRMATION",
  "data": {
    "exercises": [
      {
        "id": "ex_003",
        "title": "Lunges",
        "bodyParts": ["legs", "glutes"],
        "description": "Unilateral leg exercise targeting quadriceps and glutes",
        "difLevel": "MEDIUM",
        "commonMistakes": "Leaning too far forward, knee going past toes",
        "position": "STANDING",
        "steps": [
          "Step forward with one leg",
          "Lower your body until both knees are at 90 degrees",
          "Push back to starting position",
          "Alternate legs"
        ],
        "tips": "Keep your front knee aligned with your ankle",
        "reps": 12,
        "duration": null,
        "includeRestPeriod": true,
        "restDuration": 30,
        "thumbnail_URL": "https://cdn.kinestex.com/uploads/lunge_thumbnail.webp",
        "video_URL": "https://cdn.kinestex.com/uploads/compressed/lunge_video.mp4",
        "male_thumbnail_URL": "https://cdn.kinestex.com/media/videos/thumbnails/Lunges_Male.jpg",
        "male_video_URL": "https://cdn.kinestex.com/media/videos/compressed/Lunges_Male_compressed.mp4",
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    ]
  }
}
```

---

## Data Types

### IUserProfile

```typescript
interface IUserProfile {
  id: string;
  userId: string;
  age: number;
  weight: number; // in kg
  height: number; // in cm
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  goals: string; // e.g., "build muscle", "lose weight"
  injuries: string; // e.g., "none", "lower back pain"
  lifestyle?: string; // optional, e.g., "sedentary", "active"
  equipment?: string; // optional, e.g., "gym", "dumbbells", "none"
  createdAt: Date;
  updatedAt: Date;
}
```

### IExercise

```typescript
interface IExercise {
  id: string;
  title: string;
  bodyParts: string[]; // e.g., ["legs", "glutes"]
  description: string;
  difLevel: 'EASY' | 'MEDIUM' | 'HARD';
  commonMistakes: string;
  position: 'STANDING' | 'SEATED' | 'FLOOR';
  steps: string[]; // Array of instruction steps
  tips: string;
  reps: number | null; // Number of repetitions (null if using duration instead)
  duration: number | null; // Duration in seconds (null if using reps instead)
  includeRestPeriod: boolean; // Whether to include a rest period after this exercise
  restDuration: number; // Rest duration in seconds
  thumbnail_URL?: string | null; // Optional thumbnail image URL
  video_URL?: string | null; // Optional video URL
  male_thumbnail_URL?: string | null; // Optional male-specific thumbnail URL
  male_video_URL?: string | null; // Optional male-specific video URL
  embedding?: number[] | null; // Optional embedding vector (not included in recommendations)
  createdAt: Date;
  updatedAt: Date;
}
```

### WorkflowStep

```typescript
type WorkflowStep =
  | 'PROFILE_INTAKE'
  | 'PROFILE_CONFIRMATION'
  | 'EXERCISE_RECOMMENDATION'
  | 'EXERCISE_CONFIRMATION';
```

---

## Error Responses

### 400 Bad Request

**Invalid Request Body:**

```json
{
  "error": "Invalid request body"
}
```

This occurs when:

- Missing required fields (`userId`, `sessionId`, or `messages`)
- Invalid message format
- Invalid message role (must be 'user' or 'model')
- Invalid message content type (must be string)

**Example:**

```json
{
  "userId": "user_123",
  "sessionId": "session_abc",
  "messages": [
    {
      "role": "invalid_role",
      "content": "Hello"
    }
  ]
}
```

### 500 Internal Server Error

**Server Error:**

```json
{
  "error": "Failed to process workflow"
}
```

This occurs when:

- Database connection issues
- AI service errors
- Vector database errors
- Redis connection issues
- Unexpected server errors

---

## Session Management

- Sessions are stored in Redis with a 24-hour TTL (Time To Live)
- Each session maintains:
  - User ID
  - Current workflow step
  - Conversation history
  - Profile data (once collected)
  - Exercise recommendations (once generated)
  - Selected exercises (once confirmed)

- Sessions are automatically cleaned up after 24 hours of inactivity

---

## Workflow State Machine

```
PROFILE_INTAKE
    ↓ (profile complete)
PROFILE_CONFIRMATION
    ↓ (user confirms)
EXERCISE_RECOMMENDATION
    ↓ (exercises generated)
EXERCISE_CONFIRMATION
```

**Alternative flows:**

- From `PROFILE_CONFIRMATION`, user can cancel → back to `PROFILE_INTAKE`
- From `EXERCISE_CONFIRMATION`, user can cancel → back to `EXERCISE_RECOMMENDATION` or stay in `EXERCISE_CONFIRMATION`

---

## Best Practices

1. **Session Management:**
   - Use unique `sessionId` for each user session
   - Reuse the same `sessionId` for the same conversation flow
   - Generate new `sessionId` for new workout sessions

2. **Message Format:**
   - Only send the current user message in the `messages` array
   - The conversation history is automatically maintained in Redis
   - Simply respond to the last AI message

3. **Exercise Data:**
   - Exercise data (title, description, steps, tips, URLs, etc.) is always fetched from the database
   - Only the `exerciseId` from Gemini is used to look up exercises
   - Workout-specific fields (`reps`, `duration`, `includeRestPeriod`, `restDuration`) come from Gemini's recommendations
   - This ensures data accuracy and prevents hallucination

4. **Confirmation and Cancellation:**
   - When `action: 'CONFIRMATION'` is present, use only "CONFIRM" or "CANCEL" in user responses
   - "CONFIRM" proceeds to the next step
   - "CANCEL" allows users to make changes or request modifications
   - These commands are case-insensitive

5. **Error Handling:**
   - Always check the `step` field in the response to understand current state
   - Handle `action: 'CONFIRMATION'` appropriately in your UI
   - Implement retry logic for 500 errors

---

## Notes

- The API uses AI (Google Gemini) to generate conversational responses
- Exercise recommendations are based on vector similarity search using user profile embeddings
- Profile data and session state are managed in Redis for fast access
- Exercise data is stored in PostgreSQL
- Exercise embeddings are stored in Qdrant vector database for similarity search

---

## Support

For issues or questions, please refer to the project repository or contact the development team.
