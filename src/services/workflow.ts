import genAI from '../config/gemini';
import pool from '../config/db';
import qdrantClient from '../config/qdrant';
import { EXERCISES_COLLECTION_NAME } from './qdrant';
import { embedText } from '../utils';
import {
  getSession,
  setSession,
  updateSession,
  updateSessionStep,
} from './session';
import {
  PROFILE_INTAKE_SYSTEM_PROMPT,
  EXERCISE_RECOMMENDATION_SYSTEM_PROMPT,
  EXERCISE_SUMMARY_SYSTEM_PROMPT,
} from '../constants';
import type {
  WorkflowResponse,
  Message,
  IUserProfile,
  IExercise,
  Gender,
  SessionState,
} from '../types';

interface ProfileDataJSON {
  age: number | null;
  weight: number | null;
  height: number | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
  goals: string | null;
  injuries: string | null;
  lifestyle: string | null;
  equipment: string | null;
}

function extractProfileData(text: string): Partial<IUserProfile> | null {
  const profileData: Partial<IUserProfile> = {};

  const profileDataMatch = text.match(
    /<PROFILE_DATA>([\s\S]*?)<\/PROFILE_DATA>/
  );
  if (!profileDataMatch) {
    return null;
  }

  try {
    const jsonStr = profileDataMatch[1].trim();
    const parsed: ProfileDataJSON = JSON.parse(jsonStr);

    if (parsed.age !== null && typeof parsed.age === 'number') {
      profileData.age = parsed.age;
    }
    if (parsed.weight !== null && typeof parsed.weight === 'number') {
      profileData.weight = parsed.weight;
    }
    if (parsed.height !== null && typeof parsed.height === 'number') {
      profileData.height = parsed.height;
    }
    if (
      parsed.gender !== null &&
      ['MALE', 'FEMALE', 'OTHER'].includes(parsed.gender)
    ) {
      profileData.gender = parsed.gender as Gender;
    }
    if (
      parsed.goals !== null &&
      typeof parsed.goals === 'string' &&
      parsed.goals.trim().length > 0 &&
      parsed.goals.trim().toUpperCase() !== 'N/A'
    ) {
      profileData.goals = parsed.goals.trim();
    }
    if (
      parsed.injuries !== null &&
      typeof parsed.injuries === 'string' &&
      parsed.injuries.trim().length > 0 &&
      parsed.injuries.trim().toUpperCase() !== 'N/A'
    ) {
      profileData.injuries = parsed.injuries.trim();
    }
    if (
      parsed.lifestyle !== null &&
      typeof parsed.lifestyle === 'string' &&
      parsed.lifestyle.trim().length > 0 &&
      parsed.lifestyle.trim().toUpperCase() !== 'N/A'
    ) {
      profileData.lifestyle = parsed.lifestyle.trim();
    }
    if (
      parsed.equipment !== null &&
      typeof parsed.equipment === 'string' &&
      parsed.equipment.trim().length > 0 &&
      parsed.equipment.trim().toUpperCase() !== 'N/A'
    ) {
      profileData.equipment = parsed.equipment.trim();
    }

    return Object.keys(profileData).length > 0 ? profileData : null;
  } catch (error) {
    console.error('Failed to parse profile data JSON:', error);
    return null;
  }
}

function isProfileComplete(profileData: Partial<IUserProfile>): boolean {
  return (
    typeof profileData.age === 'number' &&
    typeof profileData.weight === 'number' &&
    typeof profileData.height === 'number' &&
    profileData.gender !== undefined &&
    typeof profileData.goals === 'string' &&
    profileData.goals.length > 0 &&
    typeof profileData.injuries === 'string' &&
    profileData.injuries.length > 0
  );
}

async function processProfileIntake(
  userId: string,
  sessionId: string,
  messages: Message[]
): Promise<WorkflowResponse> {
  const sessionResult = await getSession(sessionId);
  let session: SessionState;

  if (!sessionResult) {
    session = {
      userId,
      step: 'PROFILE_INTAKE',
      conversationHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setSession(sessionId, session);
  } else {
    session = sessionResult;
  }

  const updatedHistory: Message[] = [
    ...session.conversationHistory,
    ...messages,
  ];

  const chat = genAI.chats.create({
    model: 'gemini-2.0-flash',
    history: updatedHistory.map((msg: Message) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    })),
    config: {
      systemInstruction: {
        parts: [{ text: PROFILE_INTAKE_SYSTEM_PROMPT }],
      },
    },
  });

  const lastUserMessage = messages[messages.length - 1]?.content || '';
  const response = await chat.sendMessage({ message: lastUserMessage });
  const responseText = response.text || '';

  const fullHistory: Message[] = [
    ...updatedHistory,
    { role: 'model' as const, content: responseText },
  ];

  const extractedProfile = extractProfileData(responseText);

  if (extractedProfile && isProfileComplete(extractedProfile)) {
    const profileData: IUserProfile = {
      id: '',
      userId,
      age: extractedProfile.age!,
      weight: extractedProfile.weight!,
      height: extractedProfile.height!,
      gender: extractedProfile.gender!,
      goals: extractedProfile.goals!,
      injuries: extractedProfile.injuries!,
      lifestyle: extractedProfile.lifestyle,
      equipment: extractedProfile.equipment,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await updateSession(sessionId, {
      step: 'PROFILE_CONFIRMATION',
      conversationHistory: fullHistory,
      profileData,
    });

    return {
      response: responseText,
      action: 'CONFIRMATION',
      step: 'PROFILE_CONFIRMATION',
      data: { profileData },
    };
  }

  await updateSession(sessionId, {
    conversationHistory: fullHistory,
  });

  return {
    response: responseText,
    step: 'PROFILE_INTAKE',
  };
}

async function processExerciseRecommendation(
  sessionId: string
): Promise<WorkflowResponse> {
  const sessionResult = await getSession(sessionId);
  if (!sessionResult) {
    throw new Error('Session not found');
  }
  const session: SessionState = sessionResult;
  if (!session.profileData) {
    throw new Error('Profile data not found');
  }

  const profile: IUserProfile = session.profileData;
  const profileText = `Age: ${profile.age}, Weight: ${profile.weight}kg, Height: ${profile.height}cm, Gender: ${profile.gender}, Goals: ${profile.goals}, Injuries: ${profile.injuries}${profile.lifestyle ? `, Lifestyle: ${profile.lifestyle}` : ''}${profile.equipment ? `, Equipment: ${profile.equipment}` : ''}`;

  const embedding = await embedText(profileText);

  const searchResults = await qdrantClient.search(EXERCISES_COLLECTION_NAME, {
    vector: embedding,
    limit: 10,
  });

  const points = Array.isArray(searchResults) ? searchResults : [];
  const exercises: IExercise[] = points.map(point => {
    const payload =
      point.payload &&
      typeof point.payload === 'object' &&
      !Array.isArray(point.payload)
        ? (point.payload as Record<string, unknown>)
        : {};
    return {
      id: String(point.id),
      title: (payload.title as string) || '',
      bodyParts: (payload.bodyParts as string[]) || [],
      description: (payload.description as string) || '',
      difLevel: ((payload.difLevel as string) ||
        'MEDIUM') as IExercise['difLevel'],
      commonMistakes: (payload.commonMistakes as string) || '',
      position: ((payload.position as string) ||
        'STANDING') as IExercise['position'],
      steps: (payload.steps as string[]) || [],
      tips: (payload.tips as string) || '',
      embedding: null,
      createdAt: payload.createdAt
        ? new Date(payload.createdAt as string)
        : new Date(),
      updatedAt: payload.updatedAt
        ? new Date(payload.updatedAt as string)
        : new Date(),
    };
  });

  if (exercises.length === 0) {
    await updateSession(sessionId, {
      step: 'EXERCISE_CONFIRMATION',
      exerciseRecommendations: [],
    });

    return {
      response:
        'I apologize, but there are no exercises available that match your profile. Please try again later or adjust your profile preferences.',
      action: 'CONFIRMATION',
      step: 'EXERCISE_CONFIRMATION',
      data: { exercises: [] },
    };
  }

  const chat = genAI.chats.create({
    model: 'gemini-2.0-flash',
    config: {
      systemInstruction: {
        parts: [{ text: EXERCISE_RECOMMENDATION_SYSTEM_PROMPT }],
      },
    },
  });

  const exerciseList = exercises
    .map(
      (e, i) =>
        `${i + 1}. ID: ${e.id}, Title: ${e.title} - ${e.description} (Difficulty: ${e.difLevel}, Position: ${e.position}, Body Parts: ${e.bodyParts.join(', ')})`
    )
    .join('\n');

  const exerciseIdMap = new Map<string, IExercise>();
  exercises.forEach(e => {
    exerciseIdMap.set(e.id, e);
  });

  const prompt = `## USER PROFILE

Age: ${profile.age}

Height: ${profile.height}cm

Weight: ${profile.weight}kg

Gender: ${profile.gender}

Lifestyle: ${profile.lifestyle || 'Not specified'}

Goal: ${profile.goals}

Preferences: ${profile.equipment || 'Not specified'}

Injuries/Limitations: ${profile.injuries}

## AVAILABLE EXERCISES

${exerciseList}

Create a complete, personalized workout program following all the guidelines in your system instructions.`;

  const response = await chat.sendMessage({ message: prompt });
  let responseText = response.text || '';

  const validatedExercises: IExercise[] = [];

  try {
    const jsonMatch =
      responseText.match(/```json\n([\s\S]*?)\n```/) ||
      responseText.match(/```\n([\s\S]*?)\n```/) ||
      responseText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const validWorkout: Record<string, unknown> = {};
        let validCount = 0;

        for (const [key, value] of Object.entries(parsed)) {
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            const exerciseEntry = value as Record<string, unknown>;
            const exerciseId =
              typeof exerciseEntry.exerciseId === 'string'
                ? exerciseEntry.exerciseId
                : '';

            if (exerciseId && exerciseIdMap.has(exerciseId)) {
              validWorkout[key] = value;
              const exercise = exerciseIdMap.get(exerciseId)!;
              if (!validatedExercises.find(e => e.id === exercise.id)) {
                validatedExercises.push(exercise);
              }
              validCount++;
            }
          }
        }

        if (validCount > 0) {
          const validJsonStr = JSON.stringify(validWorkout, null, 2);
          responseText = responseText.replace(
            jsonMatch[0],
            `\`\`\`json\n${validJsonStr}\n\`\`\``
          );
        } else {
          responseText = `I apologize, but I couldn't create a workout with the available exercises. The available exercises are:\n\n${exerciseList}\n\nPlease ensure there are exercises available that match your profile.`;
        }
      }
    }
  } catch (error) {
    console.error('Failed to parse and validate exercise response:', error);
  }

  await updateSession(sessionId, {
    step: 'EXERCISE_CONFIRMATION',
    exerciseRecommendations:
      validatedExercises.length > 0 ? validatedExercises : exercises,
  });

  return {
    response: responseText,
    action: 'CONFIRMATION',
    step: 'EXERCISE_CONFIRMATION',
    data: {
      exercises: validatedExercises.length > 0 ? validatedExercises : exercises,
    },
  };
}

interface ExerciseResults {
  volume?: number;
  qualityScore?: number;
  [key: string]: unknown;
}

async function processExerciseSummary(
  sessionId: string,
  exerciseResults: ExerciseResults
): Promise<WorkflowResponse> {
  const sessionResult = await getSession(sessionId);
  if (!sessionResult) {
    throw new Error('Session not found');
  }
  const session: SessionState = sessionResult;
  if (!session.selectedExercises) {
    throw new Error('Selected exercises not found');
  }

  const selectedExercises: IExercise[] = session.selectedExercises;

  const chat = genAI.chats.create({
    model: 'gemini-2.0-flash',
    config: {
      systemInstruction: {
        parts: [{ text: EXERCISE_SUMMARY_SYSTEM_PROMPT }],
      },
    },
  });

  const exerciseList: string = selectedExercises
    .map((e: IExercise) => `- ${e.title}`)
    .join('\n');
  const resultsText = JSON.stringify(exerciseResults, null, 2);

  const prompt = `User completed these exercises:\n${exerciseList}\n\nExercise results:\n${resultsText}\n\nCreate an encouraging summary.`;

  const response = await chat.sendMessage({ message: prompt });
  const summary = response.text || '';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const sessionResult = await client.query(
      `INSERT INTO past_sessions (session_id, user_id, date, volume, quality_score, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        sessionId,
        session.userId,
        new Date(),
        exerciseResults.volume || 0,
        exerciseResults.qualityScore || 0.8,
        summary,
      ]
    );

    const sessionIdDb: string = sessionResult.rows[0].id as string;

    for (let i = 0; i < selectedExercises.length; i++) {
      await client.query(
        `INSERT INTO session_exercises (session_id, exercise_id, order_index)
         VALUES ($1, $2, $3)`,
        [sessionIdDb, selectedExercises[i].id, i]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return {
    response: summary,
    step: 'COMPLETED',
  };
}

export async function processWorkflow(
  userId: string,
  sessionId: string,
  messages: Message[]
): Promise<WorkflowResponse> {
  const sessionResult = await getSession(sessionId);

  if (!sessionResult) {
    return await processProfileIntake(userId, sessionId, messages);
  }

  const session: SessionState = sessionResult;

  switch (session.step) {
    case 'PROFILE_INTAKE':
      return await processProfileIntake(userId, sessionId, messages);

    case 'PROFILE_CONFIRMATION':
      throw new Error(
        'Profile confirmation pending. Use confirm/cancel endpoints.'
      );

    case 'EXERCISE_RECOMMENDATION':
      return await processExerciseRecommendation(sessionId);

    case 'EXERCISE_CONFIRMATION':
      throw new Error(
        'Exercise confirmation pending. Use confirm/cancel endpoints.'
      );

    case 'EXERCISE_SUMMARY':
      if (messages.length > 0) {
        const firstMessage = messages[0];
        if (firstMessage && firstMessage.content) {
          try {
            const parsed: unknown = JSON.parse(firstMessage.content);
            if (
              parsed &&
              typeof parsed === 'object' &&
              !Array.isArray(parsed)
            ) {
              const exerciseResults: ExerciseResults =
                parsed as ExerciseResults;
              return await processExerciseSummary(sessionId, exerciseResults);
            }
          } catch {
            // Invalid JSON, continue to prompt
          }
        }
      }
      return {
        response: 'Please submit your exercise results.',
        step: 'EXERCISE_SUMMARY',
      };

    default:
      return await processProfileIntake(userId, sessionId, messages);
  }
}

export async function handleConfirm(sessionId: string): Promise<void> {
  const sessionResult = await getSession(sessionId);
  if (!sessionResult) {
    throw new Error('Session not found');
  }

  const session: SessionState = sessionResult;

  if (session.step === 'PROFILE_CONFIRMATION') {
    // Profile data is stored in Redis session, no need to save to database
    await updateSessionStep(sessionId, 'EXERCISE_RECOMMENDATION');
  } else if (session.step === 'EXERCISE_CONFIRMATION') {
    if (!session.exerciseRecommendations) {
      throw new Error('Exercise recommendations not found');
    }
    const exerciseRecommendations: IExercise[] =
      session.exerciseRecommendations;
    await updateSession(sessionId, {
      step: 'EXERCISE_SUMMARY',
      selectedExercises: exerciseRecommendations,
    });
  }
}

export async function handleCancel(
  sessionId: string,
  reason?: string
): Promise<void> {
  const sessionResult = await getSession(sessionId);
  if (!sessionResult) {
    throw new Error('Session not found');
  }

  const session: SessionState = sessionResult;

  if (session.step === 'PROFILE_CONFIRMATION') {
    const conversationHistory: Message[] = session.conversationHistory;
    const chat = genAI.chats.create({
      model: 'gemini-2.0-flash',
      history: conversationHistory.map((msg: Message) => ({
        role: msg.role,
        parts: [{ text: msg.content }],
      })),
      config: {
        systemInstruction: {
          parts: [{ text: PROFILE_INTAKE_SYSTEM_PROMPT }],
        },
      },
    });

    const cancelMessage: string = reason
      ? `The user said: "${reason}". Please ask for corrections.`
      : 'The user wants to correct their information. Please ask again.';

    await chat.sendMessage({ message: cancelMessage });

    await updateSessionStep(sessionId, 'PROFILE_INTAKE');
  } else if (session.step === 'EXERCISE_CONFIRMATION') {
    await updateSessionStep(sessionId, 'EXERCISE_RECOMMENDATION');
  }
}
