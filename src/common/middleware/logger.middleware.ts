import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl } = req;
    const userAgent = req.get('user-agent') || '';
    const start = Date.now();

    // Clone the body so we can sanitize it without affecting the real request
    const sanitizedBody = req.body ? { ...req.body } : {};
    
    // Remove sensitive data from logs
    const sensitiveKeys = ['password', 'passwordConfirm', 'accessToken', 'refreshToken', 'token', 'otp'];
    sensitiveKeys.forEach(key => {
      if (sanitizedBody[key]) {
        sanitizedBody[key] = '[REDACTED]';
      }
    });

    res.on('finish', () => {
      const { statusCode } = res;
      const contentLength = res.get('content-length');
      const responseTime = Date.now() - start;

      // Ensure we only log the payload if it's an API route and has data
      const payloadStr = Object.keys(sanitizedBody).length > 0 ? ` Payload: ${JSON.stringify(sanitizedBody)}` : '';

      this.logger.log(
        `${method} ${originalUrl} ${statusCode} ${contentLength} - ${userAgent} ${responseTime}ms${payloadStr}`
      );
    });

    next();
  }
}
