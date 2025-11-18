import { Client } from 'pg';
import { env } from '../config/env';
import { syncExerciseToQdrant, deleteExerciseFromQdrant } from './exerciseSync';
import { syncWorkoutSessionToQdrant } from './workoutSync';

const EXERCISE_NOTIFICATION_CHANNEL = 'exercise_changes';
const PAST_SESSION_NOTIFICATION_CHANNEL = 'past_session_changes';

let notificationClient: Client | null = null;
let isListening = false;

interface ExerciseNotificationPayload {
  exercise_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
}

interface PastSessionNotificationPayload {
  session_id: string;
  user_id: string;
  original_session_id: string;
  operation: 'INSERT';
}

async function handleExerciseNotification(payload: string): Promise<void> {
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'exercise_id' in parsed &&
      'operation' in parsed &&
      typeof (parsed as { exercise_id: unknown }).exercise_id === 'string' &&
      ['INSERT', 'UPDATE', 'DELETE'].includes(
        (parsed as { operation: unknown }).operation as string
      )
    ) {
      const data = parsed as ExerciseNotificationPayload;
      const { exercise_id, operation } = data;

      if (operation === 'DELETE') {
        await deleteExerciseFromQdrant(exercise_id);
      } else {
        await syncExerciseToQdrant(exercise_id);
      }
    } else {
      console.error(
        '❌ Invalid exercise notification payload format:',
        payload
      );
    }
  } catch (error) {
    console.error('❌ Error handling exercise notification:', error);
  }
}

async function handlePastSessionNotification(payload: string): Promise<void> {
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'session_id' in parsed &&
      'user_id' in parsed &&
      'original_session_id' in parsed &&
      'operation' in parsed &&
      typeof (parsed as { session_id: unknown }).session_id === 'string' &&
      typeof (parsed as { user_id: unknown }).user_id === 'string' &&
      typeof (parsed as { original_session_id: unknown })
        .original_session_id === 'string' &&
      (parsed as { operation: unknown }).operation === 'INSERT'
    ) {
      const data = parsed as PastSessionNotificationPayload;
      const { session_id, user_id, original_session_id } = data;

      await syncWorkoutSessionToQdrant(
        session_id,
        user_id,
        original_session_id
      );
    } else {
      console.error(
        '❌ Invalid past session notification payload format:',
        payload
      );
    }
  } catch (error) {
    console.error('❌ Error handling past session notification:', error);
  }
}

async function setupNotificationListener(): Promise<void> {
  if (isListening && notificationClient) {
    return;
  }

  notificationClient = new Client({
    connectionString: env.DATABASE_URL,
  });

  notificationClient.on('error', err => {
    console.error('❌ Notification client error:', err);
    isListening = false;
    void reconnectListener();
  });

  notificationClient.on('notification', msg => {
    if (msg.channel === EXERCISE_NOTIFICATION_CHANNEL && msg.payload) {
      handleExerciseNotification(msg.payload).catch(err => {
        console.error('❌ Error processing exercise notification:', err);
      });
    } else if (
      msg.channel === PAST_SESSION_NOTIFICATION_CHANNEL &&
      msg.payload
    ) {
      handlePastSessionNotification(msg.payload).catch(err => {
        console.error('❌ Error processing past session notification:', err);
      });
    }
  });

  await notificationClient.connect();
  await notificationClient.query(`LISTEN ${EXERCISE_NOTIFICATION_CHANNEL}`);
  await notificationClient.query(`LISTEN ${PAST_SESSION_NOTIFICATION_CHANNEL}`);
  isListening = true;
  console.log(
    `✅ Listening for notifications on channels: ${EXERCISE_NOTIFICATION_CHANNEL}, ${PAST_SESSION_NOTIFICATION_CHANNEL}`
  );
}

async function reconnectListener(): Promise<void> {
  if (isListening) {
    return;
  }

  const maxRetries = 5;
  let attempt = 0;

  while (attempt < maxRetries && !isListening) {
    attempt++;
    try {
      console.log(
        `🔄 Attempting to reconnect notification listener (attempt ${attempt}/${maxRetries})...`
      );
      await setupNotificationListener();
    } catch (error) {
      console.error(`❌ Reconnection attempt ${attempt} failed:`, error);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
      }
    }
  }

  if (!isListening) {
    console.error(
      '❌ Failed to reconnect notification listener after all attempts'
    );
  }
}

export async function startNotificationListener(): Promise<void> {
  await setupNotificationListener();
}

export async function stopNotificationListener(): Promise<void> {
  if (notificationClient) {
    try {
      await notificationClient.query(
        `UNLISTEN ${EXERCISE_NOTIFICATION_CHANNEL}`
      );
      await notificationClient.query(
        `UNLISTEN ${PAST_SESSION_NOTIFICATION_CHANNEL}`
      );
      await notificationClient.end();
      isListening = false;
      console.log('✅ Stopped notification listener');
    } catch (error) {
      console.error('❌ Error stopping notification listener:', error);
    } finally {
      notificationClient = null;
    }
  }
}
