import { Client } from 'pg';
import { env } from '../config/env';
import { syncExerciseToQdrant, deleteExerciseFromQdrant } from './exerciseSync';

const NOTIFICATION_CHANNEL = 'exercise_changes';

let notificationClient: Client | null = null;
let isListening = false;

interface NotificationPayload {
  exercise_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
}

async function handleNotification(payload: string): Promise<void> {
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
      const data = parsed as NotificationPayload;
      const { exercise_id, operation } = data;

      if (operation === 'DELETE') {
        await deleteExerciseFromQdrant(exercise_id);
      } else {
        await syncExerciseToQdrant(exercise_id);
      }
    } else {
      console.error('❌ Invalid notification payload format:', payload);
    }
  } catch (error) {
    console.error('❌ Error handling notification:', error);
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
    if (msg.channel === NOTIFICATION_CHANNEL && msg.payload) {
      handleNotification(msg.payload).catch(err => {
        console.error('❌ Error processing notification:', err);
      });
    }
  });

  await notificationClient.connect();
  await notificationClient.query(`LISTEN ${NOTIFICATION_CHANNEL}`);
  isListening = true;
  console.log(
    `✅ Listening for notifications on channel: ${NOTIFICATION_CHANNEL}`
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
      await notificationClient.query(`UNLISTEN ${NOTIFICATION_CHANNEL}`);
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
