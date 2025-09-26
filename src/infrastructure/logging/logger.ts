/**
 * Logger Service
 * Simple logger implementation for the rocket backend
 */

export class Logger {
  info(message: string, meta?: any) {
    console.log(`[INFO] ${message}`, meta || '');
  }

  error(message: string, error?: any) {
    console.error(`[ERROR] ${message}`, error || '');
  }

  warn(message: string, meta?: any) {
    console.warn(`[WARN] ${message}`, meta || '');
  }

  debug(message: string, meta?: any) {
    console.debug(`[DEBUG] ${message}`, meta || '');
  }
}
