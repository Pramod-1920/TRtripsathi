import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const message = this.getMessage(exceptionResponse);
    const timestamp = new Date().toISOString();

    // Log errors for debugging (especially 5xx errors)
    if (status >= 500) {
      this.logger.error(`${exception.message}`, exception.stack);
    } else if (status >= 400) {
      this.logger.warn(`${status} - ${message}`);
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp,
    });
  }

  private getMessage(exceptionResponse: any): string {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    if (exceptionResponse?.message) {
      // Handle validation errors which come as array
      if (Array.isArray(exceptionResponse.message)) {
        return exceptionResponse.message.join(', ');
      }
      return exceptionResponse.message;
    }

    return 'Internal Server Error';
  }
}
