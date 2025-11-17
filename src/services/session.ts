import redisClient from '../config/redis';
import type { SessionState, WorkflowStep } from '../types';

const SESSION_TTL = 24 * 60 * 60;

function getSessionKey(sessionId: string): string {
  return `session:${sessionId}`;
}

function isValidSessionState(obj: unknown): obj is SessionState {
  if (!obj || typeof obj !== 'object') {
    return false;
  }
  const s = obj as Record<string, unknown>;
  return (
    typeof s.userId === 'string' &&
    typeof s.step === 'string' &&
    Array.isArray(s.conversationHistory) &&
    typeof s.createdAt === 'string' &&
    typeof s.updatedAt === 'string'
  );
}

export async function getSession(
  sessionId: string
): Promise<SessionState | null> {
  const key = getSessionKey(sessionId);
  const data = await redisClient.get(key);
  if (!data) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(data);
    if (isValidSessionState(parsed)) {
      return parsed as SessionState;
    }
    return null;
  } catch {
    return null;
  }
}

export async function setSession(
  sessionId: string,
  state: SessionState
): Promise<void> {
  const key = getSessionKey(sessionId);
  await redisClient.setEx(key, SESSION_TTL, JSON.stringify(state));
}

export async function updateSession(
  sessionId: string,
  updates: Partial<SessionState>
): Promise<void> {
  const existing = await getSession(sessionId);
  if (!existing) {
    if (updates.step === 'PROFILE_INTAKE' && updates.userId) {
      const newSession: SessionState = {
        userId: updates.userId,
        step: 'PROFILE_INTAKE',
        conversationHistory: updates.conversationHistory || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...updates,
      };
      await setSession(sessionId, newSession);
      return;
    }
    throw new Error(`Session ${sessionId} not found`);
  }
  const updated = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await setSession(sessionId, updated);
}

export async function updateSessionStep(
  sessionId: string,
  step: WorkflowStep
): Promise<void> {
  await updateSession(sessionId, { step });
}

export async function deleteSession(sessionId: string): Promise<void> {
  const key = getSessionKey(sessionId);
  await redisClient.del(key);
}
