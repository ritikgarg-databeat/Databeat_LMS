import type { Request } from 'express';
import morgan from 'morgan';

import { logger } from '@/utils/logger';

morgan.token('request-id', (req) => (req as Request).requestId ?? '-');

/** Pipes Morgan's HTTP access log lines through the same Winston logger as everything else. */
export const requestLogger = morgan(':request-id :remote-addr :method :url :status :response-time ms', {
  stream: {
    write: (message: string) => logger.info(message.trim()),
  },
});
