import morgan from 'morgan';

import { logger } from '@/utils/logger';

/** Pipes Morgan's HTTP access log lines through the same Winston logger as everything else. */
export const requestLogger = morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim()),
  },
});
