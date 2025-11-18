import genAI from '../config/gemini';
import pool from '../config/db';
import qdrantClient from '../config/qdrant';
import { EXERCISES_COLLECTION_NAME } from './qdrant';
import { embedText, toonEncode, toonDecode } from '../utils';
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
  SEARCH_QUERY_REFINEMENT_SYSTEM_PROMPT,
} from '../constants';
import type {
  WorkflowResponse,
  Message,
  IUserProfile,
  IExercise,
  Gender,
  SessionState,
  ExerciseRow,
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

async function fetchExerciseByExternalId(
  externalId: string
): Promise<ExerciseRow | null> {
  const client = await pool.connect();
  try {
    const exerciseResult = await client.query<ExerciseRow>(
      'SELECT * FROM exercises WHERE external_id = $1',
      [externalId]
    );

    if (exerciseResult.rows.length === 0) {
      return null;
    }

    return exerciseResult.rows[0];
  } finally {
    client.release();
  }
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
    const toonStr = profileDataMatch[1].trim();
    let parsed: ProfileDataJSON;

    try {
      parsed = toonDecode(toonStr) as ProfileDataJSON;
    } catch {
      const jsonStr = toonStr;
      parsed = JSON.parse(jsonStr);
    }

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

function stripDataFromResponse(text: string): string {
  let cleaned = text;

  if (cleaned.includes('<START_DATA>') && cleaned.includes('<END_DATA>')) {
    const startIndex = cleaned.indexOf('<START_DATA>');
    const endIndex = cleaned.indexOf('<END_DATA>');
    if (startIndex < endIndex) {
      cleaned =
        cleaned.substring(0, startIndex).trim() +
        cleaned.substring(endIndex + '<END_DATA>'.length).trim();
    }
  } else if (cleaned.includes('<END_DATA>')) {
    cleaned = cleaned.split('<END_DATA>')[0].trim();
  } else if (cleaned.includes('<START_DATA>')) {
    cleaned = cleaned.split('<START_DATA>')[0].trim();
  }

  cleaned = cleaned.replace(/<START_DATA>[\s\S]*/gi, '');
  cleaned = cleaned.replace(/<END_DATA>[\s\S]*/gi, '');
  cleaned = cleaned.replace(/<PROFILE_DATA>[\s\S]*?<\/PROFILE_DATA>/gi, '');
  cleaned = cleaned.replace(/<WORKOUT_DATA>[\s\S]*?<\/WORKOUT_DATA>/gi, '');
  cleaned = cleaned.replace(/<EXERCISES_DATA>[\s\S]*?<\/EXERCISES_DATA>/gi, '');

  cleaned = cleaned.replace(/```json\n[\s\S]*?\n```/g, '');

  cleaned = cleaned.replace(/```\n[\s\S]*?\n```/g, '');

  cleaned = cleaned.replace(/```json[\s\S]*?```/g, '');

  cleaned = cleaned.replace(/```[\s\S]*?```/g, '');

  const jsonBlockPattern = /\{[\s\S]{20,}\}/g;
  cleaned = cleaned.replace(jsonBlockPattern, match => {
    try {
      const parsed = JSON.parse(match);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return '';
      }
      return match;
    } catch {
      return match;
    }
  });

  return cleaned.trim();
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
      response: stripDataFromResponse(responseText),
      action: 'CONFIRMATION',
      step: 'PROFILE_CONFIRMATION',
      data: { profileData },
    };
  }

  await updateSession(sessionId, {
    conversationHistory: fullHistory,
  });

  return {
    response: stripDataFromResponse(responseText),
    step: 'PROFILE_INTAKE',
  };
}

interface SearchQueryRefinement {
  refinedQuery: string;
  excludeBodyParts: string[];
}

async function refineSearchQueryWithGemini(
  profileText: string,
  injuries: string
): Promise<SearchQueryRefinement> {
  const chat = genAI.chats.create({
    model: 'gemini-2.0-flash',
    config: {
      systemInstruction: {
        parts: [{ text: SEARCH_QUERY_REFINEMENT_SYSTEM_PROMPT }],
      },
    },
  });

  const prompt = `User profile: ${profileText}\nInjuries: ${injuries}\n\nCreate a refined search query and identify body parts to exclude based on injuries.`;
  const response = await chat.sendMessage({ message: prompt });
  const responseText = response.text || '';

  console.log('[SEARCH_QUERY_REFINEMENT] Raw Gemini response:', {
    injuries,
    responseLength: responseText.length,
    responseText,
    hasSearchRefinement: responseText.includes('<SEARCH_REFINEMENT>'),
    hasStartData: responseText.includes('<START_DATA>'),
  });

  try {
    const refinementMatch = responseText.match(
      /<SEARCH_REFINEMENT>([\s\S]*?)<\/SEARCH_REFINEMENT>/
    );
    const dataMatch =
      responseText.match(/<START_DATA>([\s\S]*?)<END_DATA>/) ||
      responseText.match(/```json\n([\s\S]*?)\n```/) ||
      responseText.match(/```\n([\s\S]*?)\n```/) ||
      responseText.match(/\{[\s\S]*\}/);

    if (refinementMatch || dataMatch) {
      const dataStr = refinementMatch
        ? refinementMatch[1].trim()
        : dataMatch?.[1].trim() || '';
      let parsed: SearchQueryRefinement;

      try {
        parsed = toonDecode(dataStr) as SearchQueryRefinement;
      } catch {
        try {
          parsed = JSON.parse(dataStr);
        } catch {
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('Could not parse refinement response');
          }
        }
      }

      if (
        parsed &&
        typeof parsed === 'object' &&
        typeof parsed.refinedQuery === 'string'
      ) {
        let excludeBodyParts: string[] = [];
        if (Array.isArray(parsed.excludeBodyParts)) {
          excludeBodyParts = parsed.excludeBodyParts;
        } else if (typeof parsed.excludeBodyParts === 'string') {
          try {
            const parsedArray = JSON.parse(parsed.excludeBodyParts);
            if (Array.isArray(parsedArray)) {
              excludeBodyParts = parsedArray;
            }
          } catch {
            console.warn(
              '[SEARCH_QUERY_REFINEMENT] Failed to parse excludeBodyParts string as JSON:',
              parsed.excludeBodyParts
            );
          }
        }

        const result = {
          refinedQuery: parsed.refinedQuery,
          excludeBodyParts,
        };
        console.log('[SEARCH_QUERY_REFINEMENT] Parsed result:', {
          injuries,
          refinedQuery: result.refinedQuery,
          excludeBodyParts: result.excludeBodyParts,
          excludeBodyPartsType: typeof parsed.excludeBodyParts,
          excludeBodyPartsIsArray: Array.isArray(parsed.excludeBodyParts),
          rawParsed: parsed,
        });
        return result;
      } else {
        console.warn(
          '[SEARCH_QUERY_REFINEMENT] Parsed object missing refinedQuery:',
          {
            injuries,
            parsed,
            hasRefinedQuery:
              parsed && typeof parsed === 'object' && 'refinedQuery' in parsed,
          }
        );
      }
    } else {
      console.warn(
        '[SEARCH_QUERY_REFINEMENT] No data match found in response:',
        {
          injuries,
          responseText,
        }
      );
    }
  } catch (error) {
    console.error(
      '[SEARCH_QUERY_REFINEMENT] Failed to parse search query refinement:',
      {
        injuries,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }
    );
  }

  return {
    refinedQuery: profileText,
    excludeBodyParts: [],
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
  const profileText = `Age: ${profile.age}, Weight: ${profile.weight}kg, Height: ${profile.height}cm, Gender: ${profile.gender}, Goals: ${profile.goals}, ${profile.lifestyle ? `, Lifestyle: ${profile.lifestyle}` : ''}${profile.equipment ? `, Equipment: ${profile.equipment}` : ''}`;

  const refinement = await refineSearchQueryWithGemini(
    profileText,
    profile.injuries
  );

  console.log('[EXERCISE_RECOMMENDATION] Search query refinement:', {
    sessionId,
    refinedQuery: refinement.refinedQuery,
    excludeBodyParts: refinement.excludeBodyParts,
    userInjuries: profile.injuries,
  });

  const embedding = await embedText(refinement.refinedQuery);

  const searchOptions: {
    vector: number[];
    limit: number;
    filter?: {
      must_not?: Array<{
        key: string;
        match: { any: string[] };
      }>;
    };
  } = {
    vector: embedding,
    limit: 50,
  };

  if (refinement.excludeBodyParts.length > 0) {
    searchOptions.filter = {
      must_not: [
        {
          key: 'bodyParts',
          match: {
            any: refinement.excludeBodyParts,
          },
        },
      ],
    };
  }

  console.log('[EXERCISE_RECOMMENDATION] Qdrant search options:', {
    sessionId,
    collection: EXERCISES_COLLECTION_NAME,
    limit: searchOptions.limit,
    hasFilter: !!searchOptions.filter,
    excludeBodyParts: refinement.excludeBodyParts,
  });

  const searchResults = await qdrantClient.search(
    EXERCISES_COLLECTION_NAME,
    searchOptions
  );

  const points = Array.isArray(searchResults) ? searchResults : [];
  console.log('[EXERCISE_RECOMMENDATION] Qdrant search results:', {
    sessionId,
    totalResults: points.length,
    sampleExercises: points.slice(0, 5).map(p => ({
      id: (p.payload as Record<string, unknown>)?.external_id || p.id,
      title: (p.payload as Record<string, unknown>)?.title || 'N/A',
      bodyParts: (p.payload as Record<string, unknown>)?.bodyParts || [],
      score: p.score,
    })),
  });

  const exercises: IExercise[] = points.map(point => {
    const payload =
      point.payload &&
      typeof point.payload === 'object' &&
      !Array.isArray(point.payload)
        ? (point.payload as Record<string, unknown>)
        : {};
    return {
      id: (payload.external_id as string) || String(point.id),
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
      reps: typeof payload.reps === 'number' ? payload.reps : null,
      duration: typeof payload.duration === 'number' ? payload.duration : null,
      includeRestPeriod:
        typeof payload.includeRestPeriod === 'boolean'
          ? payload.includeRestPeriod
          : true,
      restDuration:
        typeof payload.restDuration === 'number' ? payload.restDuration : 30,
      createdAt: payload.createdAt
        ? new Date(payload.createdAt as string)
        : new Date(),
      updatedAt: payload.updatedAt
        ? new Date(payload.updatedAt as string)
        : new Date(),
    };
  });

  console.log('[EXERCISE_RECOMMENDATION] Exercises mapped from Qdrant:', {
    sessionId,
    totalExercises: exercises.length,
    exerciseIds: exercises.map(e => e.id),
    exerciseTitles: exercises.map(e => e.title),
    exercisesWithBodyParts: exercises.map(e => ({
      id: e.id,
      title: e.title,
      bodyParts: e.bodyParts,
    })),
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

  const conversationHistory: Message[] = session.conversationHistory || [];

  const chat = genAI.chats.create({
    model: 'gemini-2.0-flash',
    history: conversationHistory.map((msg: Message) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    })),
    config: {
      systemInstruction: {
        parts: [{ text: EXERCISE_RECOMMENDATION_SYSTEM_PROMPT }],
      },
    },
  });

  const exerciseIdMap = new Map<string, IExercise>();
  exercises.forEach(e => {
    exerciseIdMap.set(e.id, e);
  });

  const exerciseListData = exercises.map(e => ({
    id: e.id,
    title: e.title,
    description: e.description,
    difficulty: e.difLevel,
    position: e.position,
    bodyParts: e.bodyParts,
  }));

  const profileData = {
    age: profile.age,
    height: profile.height,
    weight: profile.weight,
    gender: profile.gender,
    lifestyle: profile.lifestyle || 'Not specified',
    goal: profile.goals,
    equipment: profile.equipment || 'Not specified',
    injuries: profile.injuries,
  };

  const profileToon = toonEncode(profileData);
  const exercisesToon = toonEncode(exerciseListData);

  const prompt = `<START_DATA>
<PROFILE_DATA>
${profileToon}
</PROFILE_DATA>
<EXERCISES_DATA>
${exercisesToon}
</EXERCISES_DATA>
<END_DATA>

Create a complete, personalized workout program following all the guidelines in your system instructions.`;

  console.log('[EXERCISE_RECOMMENDATION] Sending to Gemini:', {
    sessionId,
    profileData,
    exerciseCount: exerciseListData.length,
    exerciseIds: exerciseListData.map(e => e.id),
  });

  const response = await chat.sendMessage({ message: prompt });
  let responseText = response.text || '';

  console.log('[EXERCISE_RECOMMENDATION] Raw Gemini response:', {
    sessionId,
    responseLength: responseText.length,
    hasWorkoutData: responseText.includes('<WORKOUT_DATA>'),
    hasStartData: responseText.includes('<START_DATA>'),
    responsePreview: responseText.substring(0, 500),
  });

  const validatedExercises: IExercise[] = [];

  try {
    const workoutDataMatch = responseText.match(
      /<WORKOUT_DATA>([\s\S]*?)<\/WORKOUT_DATA>/
    );
    const dataMatch =
      responseText.match(/<START_DATA>([\s\S]*?)<END_DATA>/) ||
      responseText.match(/```json\n([\s\S]*?)\n```/) ||
      responseText.match(/```\n([\s\S]*?)\n```/) ||
      responseText.match(/\{[\s\S]*\}/);

    if (workoutDataMatch || dataMatch) {
      const dataStr = workoutDataMatch
        ? workoutDataMatch[1].trim()
        : dataMatch?.[1].trim() || '';
      let parsed: Record<string, unknown>;

      try {
        parsed = toonDecode(dataStr) as Record<string, unknown>;
      } catch {
        try {
          parsed = JSON.parse(dataStr);
        } catch {
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('Could not parse response');
          }
        }
      }

      console.log(
        '[EXERCISE_RECOMMENDATION] Parsed workout data from Gemini:',
        {
          sessionId,
          parsedKeys: Object.keys(parsed),
          exerciseCount: Object.keys(parsed).length,
        }
      );

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const validWorkout: Record<string, unknown> = {};
        let validCount = 0;
        const skippedExercises: string[] = [];

        for (const [key, value] of Object.entries(parsed)) {
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            const exerciseEntry = value as Record<string, unknown>;
            const exerciseId =
              typeof exerciseEntry.exerciseId === 'string'
                ? exerciseEntry.exerciseId
                : '';

            if (exerciseId && exerciseIdMap.has(exerciseId)) {
              const dbExercise = await fetchExerciseByExternalId(exerciseId);
              if (!dbExercise) {
                console.warn(
                  `[EXERCISE_RECOMMENDATION] Exercise with external_id ${exerciseId} not found in database, skipping`
                );
                skippedExercises.push(exerciseId);
                continue;
              }

              const bodyPartsText =
                typeof dbExercise.body_parts === 'string'
                  ? dbExercise.body_parts
                  : String(dbExercise.body_parts || '');
              const stepsText =
                typeof dbExercise.steps === 'string'
                  ? dbExercise.steps
                  : String(dbExercise.steps || '');

              const bodyPartsArray = bodyPartsText
                .split(',')
                .map(part => part.trim())
                .filter(Boolean);
              const stepsArray = stepsText
                .split('\n')
                .map(step => step.trim())
                .filter(Boolean);

              const workoutExercise: IExercise = {
                id: dbExercise.external_id,
                title: dbExercise.title,
                bodyParts: bodyPartsArray,
                description: dbExercise.description,
                difLevel: dbExercise.dif_level as IExercise['difLevel'],
                commonMistakes: dbExercise.common_mistakes,
                position: dbExercise.position as IExercise['position'],
                steps: stepsArray,
                tips: dbExercise.tips,
                reps:
                  typeof exerciseEntry.reps === 'number'
                    ? exerciseEntry.reps
                    : exerciseEntry.reps === null
                      ? null
                      : null,
                duration:
                  typeof exerciseEntry.duration === 'number'
                    ? exerciseEntry.duration
                    : exerciseEntry.duration === null
                      ? null
                      : null,
                includeRestPeriod:
                  typeof exerciseEntry.includeRestPeriod === 'boolean'
                    ? exerciseEntry.includeRestPeriod
                    : true,
                restDuration:
                  typeof exerciseEntry.restDuration === 'number'
                    ? exerciseEntry.restDuration
                    : 30,
                thumbnail_URL: dbExercise.thumbnail_URL || null,
                video_URL: dbExercise.video_URL || null,
                male_thumbnail_URL: dbExercise.male_thumbnail_URL || null,
                male_video_URL: dbExercise.male_video_URL || null,
                createdAt: dbExercise.created_at,
                updatedAt: dbExercise.updated_at,
              };

              validWorkout[key] = value;
              if (!validatedExercises.find(e => e.id === workoutExercise.id)) {
                validatedExercises.push(workoutExercise);
                console.log(
                  `[EXERCISE_RECOMMENDATION] Validated exercise: ${workoutExercise.id} - ${workoutExercise.title}`,
                  {
                    sessionId,
                    bodyParts: workoutExercise.bodyParts,
                    reps: workoutExercise.reps,
                    duration: workoutExercise.duration,
                  }
                );
              }
              validCount++;
            } else {
              if (exerciseId) {
                console.warn(
                  `[EXERCISE_RECOMMENDATION] Exercise ID ${exerciseId} from Gemini not found in Qdrant results, skipping`
                );
                skippedExercises.push(exerciseId);
              }
            }
          }
        }

        console.log('[EXERCISE_RECOMMENDATION] Validation summary:', {
          sessionId,
          validCount,
          skippedCount: skippedExercises.length,
          skippedExerciseIds: skippedExercises,
          validatedExerciseIds: validatedExercises.map(e => e.id),
        });

        if (validCount > 0) {
          const validToonStr = toonEncode(validWorkout);
          const originalMatch = workoutDataMatch
            ? workoutDataMatch[0]
            : dataMatch?.[0] || '';
          const replacement = `<START_DATA>\n<WORKOUT_DATA>\n${validToonStr}\n</WORKOUT_DATA>\n<END_DATA>`;
          if (originalMatch) {
            responseText = responseText.replace(originalMatch, replacement);
          }
        } else {
          const exerciseListText = exercises
            .map((e, i) => `${i + 1}. ID: ${e.id}, Title: ${e.title}`)
            .join('\n');
          responseText = `I apologize, but I couldn't create a workout with the available exercises. The available exercises are:\n\n${exerciseListText}\n\nPlease ensure there are exercises available that match your profile.`;
        }
      }
    }
  } catch (error) {
    console.error(
      '[EXERCISE_RECOMMENDATION] Failed to parse and validate exercise response:',
      {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }
    );
  }

  const cleanedResponse = stripDataFromResponse(responseText);

  const finalExercises =
    validatedExercises.length > 0 ? validatedExercises : exercises;

  console.log('[EXERCISE_RECOMMENDATION] Final result:', {
    sessionId,
    usingValidatedExercises: validatedExercises.length > 0,
    finalExerciseCount: finalExercises.length,
    finalExerciseIds: finalExercises.map(e => e.id),
    finalExercises: finalExercises.map(e => ({
      id: e.id,
      title: e.title,
      bodyParts: e.bodyParts,
    })),
    cleanedResponseLength: cleanedResponse.length,
    cleanedResponsePreview: cleanedResponse.substring(0, 200),
  });

  const fullHistory: Message[] = [
    ...conversationHistory,
    { role: 'model' as const, content: cleanedResponse },
  ];

  await updateSession(sessionId, {
    step: 'EXERCISE_CONFIRMATION',
    exerciseRecommendations: finalExercises,
    conversationHistory: fullHistory,
  });

  return {
    response: cleanedResponse || 'Here is your personalized workout program!',
    action: 'CONFIRMATION',
    step: 'EXERCISE_CONFIRMATION',
    data: {
      exercises: finalExercises,
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

  const exerciseListData = selectedExercises.map((e: IExercise) => ({
    title: e.title,
  }));
  const exerciseListToon = toonEncode(exerciseListData);
  const resultsToon = toonEncode(exerciseResults);

  const prompt = `User completed these exercises (TOON format):\n${exerciseListToon}\n\nExercise results (TOON format):\n${resultsToon}\n\nCreate an encouraging summary.`;

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

function isConfirmMessage(content: string): boolean {
  const normalized = content.trim().toUpperCase();
  return (
    normalized === 'CONFIRM' || normalized === 'YES' || normalized === 'OK'
  );
}

function isCancelMessage(content: string): boolean {
  const normalized = content.trim().toUpperCase();
  return (
    normalized === 'CANCEL' ||
    normalized === 'NO' ||
    normalized.startsWith('CANCEL') ||
    normalized.includes('CHANGE') ||
    normalized.includes('MODIFY')
  );
}

async function handleProfileConfirmation(
  sessionId: string,
  messages: Message[]
): Promise<WorkflowResponse> {
  const sessionResult = await getSession(sessionId);
  if (!sessionResult) {
    throw new Error('Session not found');
  }

  const lastMessage = messages[messages.length - 1];
  const messageContent = lastMessage?.content?.trim().toUpperCase() || '';

  if (isConfirmMessage(messageContent)) {
    await updateSessionStep(sessionId, 'EXERCISE_RECOMMENDATION');
    return await processExerciseRecommendation(sessionId);
  }

  if (isCancelMessage(messageContent)) {
    const session: SessionState = sessionResult;
    const conversationHistory: Message[] = session.conversationHistory;
    const cancelReason = lastMessage?.content || '';

    const updatedHistory: Message[] = [...conversationHistory, ...messages];

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

    const cancelPrompt =
      cancelReason && !isCancelMessage(cancelReason)
        ? `The user wants to make changes. They said: "${cancelReason}". Please ask what they'd like to change or correct.`
        : 'The user wants to correct their information. Please ask what they would like to change or add.';

    const response = await chat.sendMessage({ message: cancelPrompt });
    const responseText = response.text || '';

    const fullHistory: Message[] = [
      ...updatedHistory,
      { role: 'model' as const, content: responseText },
    ];

    await updateSession(sessionId, {
      step: 'PROFILE_INTAKE',
      conversationHistory: fullHistory,
    });

    return {
      response: stripDataFromResponse(responseText),
      step: 'PROFILE_INTAKE',
    };
  }

  const session: SessionState = sessionResult;
  const conversationHistory: Message[] = session.conversationHistory;
  const updatedHistory: Message[] = [...conversationHistory, ...messages];

  const chat = genAI.chats.create({
    model: 'gemini-2.0-flash',
    history: updatedHistory.map((msg: Message) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    })),
    config: {
      systemInstruction: {
        parts: [
          {
            text: `You are helping the user confirm or modify their profile. They can say "CONFIRM" to proceed, "CANCEL" to make changes, or provide additional information. Be helpful and conversational.`,
          },
        ],
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

  await updateSession(sessionId, {
    conversationHistory: fullHistory,
  });

  return {
    response: stripDataFromResponse(responseText),
    step: 'PROFILE_CONFIRMATION',
    action: 'CONFIRMATION',
    data: { profileData: session.profileData },
  };
}

async function handleExerciseConfirmation(
  sessionId: string,
  messages: Message[]
): Promise<WorkflowResponse> {
  const sessionResult = await getSession(sessionId);
  if (!sessionResult) {
    throw new Error('Session not found');
  }

  const session: SessionState = sessionResult;
  const lastMessage = messages[messages.length - 1];
  const messageContent = lastMessage?.content?.trim().toUpperCase() || '';

  if (isConfirmMessage(messageContent)) {
    if (!session.exerciseRecommendations) {
      throw new Error('Exercise recommendations not found');
    }
    const exerciseRecommendations: IExercise[] =
      session.exerciseRecommendations;
    await updateSession(sessionId, {
      step: 'EXERCISE_SUMMARY',
      selectedExercises: exerciseRecommendations,
    });

    return {
      response:
        'Great! Your workout is confirmed. Please complete the exercises and submit your results when done.',
      step: 'EXERCISE_SUMMARY',
    };
  }

  if (isCancelMessage(messageContent)) {
    const cancelReason = lastMessage?.content || '';
    const conversationHistory: Message[] = session.conversationHistory;
    const updatedHistory: Message[] = [...conversationHistory, ...messages];

    const chat = genAI.chats.create({
      model: 'gemini-2.0-flash',
      history: updatedHistory.map((msg: Message) => ({
        role: msg.role,
        parts: [{ text: msg.content }],
      })),
      config: {
        systemInstruction: {
          parts: [
            {
              text: `You are helping the user with their exercise recommendations. They can say "CONFIRM" to proceed with the current workout, "CANCEL" to get new recommendations, or ask questions. Be helpful and ask what they'd like to do - get new recommendations, modify something, or ask questions about the exercises.`,
            },
          ],
        },
      },
    });

    const cancelPrompt =
      cancelReason && !isCancelMessage(cancelReason)
        ? `The user wants to make changes. They said: "${cancelReason}". Please ask what they'd like to do - get new recommendations, modify something, or ask questions.`
        : 'The user wants to make changes to their workout recommendations. Please ask what they would like to do - would they like new recommendations, or do they have questions about the current exercises?';

    const response = await chat.sendMessage({ message: cancelPrompt });
    const responseText = response.text || '';

    const fullHistory: Message[] = [
      ...updatedHistory,
      { role: 'model' as const, content: responseText },
    ];

    const normalizedReason = cancelReason.trim().toUpperCase();
    if (
      normalizedReason.includes('NEW') ||
      normalizedReason.includes('DIFFERENT') ||
      normalizedReason.includes('ANOTHER') ||
      normalizedReason.includes('RECOMMENDATION')
    ) {
      await updateSession(sessionId, {
        step: 'EXERCISE_RECOMMENDATION',
        conversationHistory: fullHistory,
      });
      return await processExerciseRecommendation(sessionId);
    }

    await updateSession(sessionId, {
      step: 'EXERCISE_CONFIRMATION',
      conversationHistory: fullHistory,
    });

    return {
      response: stripDataFromResponse(responseText),
      step: 'EXERCISE_CONFIRMATION',
      action: 'CONFIRMATION',
      data: { exercises: session.exerciseRecommendations || [] },
    };
  }

  const conversationHistory: Message[] = session.conversationHistory;
  const updatedHistory: Message[] = [...conversationHistory, ...messages];

  const chat = genAI.chats.create({
    model: 'gemini-2.0-flash',
    history: updatedHistory.map((msg: Message) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    })),
    config: {
      systemInstruction: {
        parts: [
          {
            text: `You are helping the user confirm or modify their exercise recommendations. They can say "CONFIRM" to proceed, "CANCEL" to get new recommendations, or ask questions about the exercises. Be helpful and conversational.`,
          },
        ],
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

  await updateSession(sessionId, {
    conversationHistory: fullHistory,
  });

  return {
    response: stripDataFromResponse(responseText),
    step: 'EXERCISE_CONFIRMATION',
    action: 'CONFIRMATION',
    data: { exercises: session.exerciseRecommendations || [] },
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
      return await handleProfileConfirmation(sessionId, messages);

    case 'EXERCISE_RECOMMENDATION':
      return await processExerciseRecommendation(sessionId);

    case 'EXERCISE_CONFIRMATION':
      return await handleExerciseConfirmation(sessionId, messages);

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
