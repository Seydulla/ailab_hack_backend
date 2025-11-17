import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { processWorkflow } from './services/workflow';
import type { Message, WorkflowResponse } from './types';

interface WorkflowRequest {
  userId: string;
  sessionId: string;
  messages: Message[];
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

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

export default app;
