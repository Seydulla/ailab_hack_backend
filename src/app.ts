import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import {
  processWorkflow,
  handleConfirm,
  handleCancel,
} from './services/workflow';
import type { Message, WorkflowResponse } from './types';

interface WorkflowRequest {
  userId: string;
  sessionId: string;
  messages: Message[];
}

interface ConfirmRequest {
  sessionId: string;
}

interface CancelRequest {
  sessionId: string;
  reason?: string;
}

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

function isValidMessage(msg: unknown): msg is Message {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'role' in msg &&
    'content' in msg &&
    (msg.role === 'user' || msg.role === 'model') &&
    typeof msg.content === 'string'
  );
}

app.post('/api/workflow', async (req: Request, res: Response) => {
  try {
    const body = req.body as unknown;
    if (
      !body ||
      typeof body !== 'object' ||
      !('userId' in body) ||
      !('sessionId' in body) ||
      !('messages' in body)
    ) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const { userId, sessionId, messages } = body as WorkflowRequest;

    if (
      typeof userId !== 'string' ||
      typeof sessionId !== 'string' ||
      !Array.isArray(messages) ||
      !messages.every(isValidMessage)
    ) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const response: WorkflowResponse = await processWorkflow(
      userId,
      sessionId,
      messages
    );
    return res.json(response);
  } catch (error) {
    console.error('Workflow error:', error);
    return res.status(500).json({ error: 'Failed to process workflow' });
  }
});

app.post('/api/workflow/confirm', async (req: Request, res: Response) => {
  try {
    const body = req.body as unknown;
    if (!body || typeof body !== 'object' || !('sessionId' in body)) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const { sessionId } = body as ConfirmRequest;

    if (typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId must be a string' });
    }

    await handleConfirm(sessionId);
    return res.json({ success: true, message: 'Confirmed successfully' });
  } catch (error) {
    console.error('Confirm error:', error);
    return res.status(500).json({ error: 'Failed to confirm' });
  }
});

app.post('/api/workflow/cancel', async (req: Request, res: Response) => {
  try {
    const body = req.body as unknown;
    if (!body || typeof body !== 'object' || !('sessionId' in body)) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const { sessionId, reason } = body as CancelRequest;

    if (typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId must be a string' });
    }

    await handleCancel(
      sessionId,
      typeof reason === 'string' ? reason : undefined
    );
    return res.json({ success: true, message: 'Cancelled successfully' });
  } catch (error) {
    console.error('Cancel error:', error);
    return res.status(500).json({ error: 'Failed to cancel' });
  }
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

export default app;
