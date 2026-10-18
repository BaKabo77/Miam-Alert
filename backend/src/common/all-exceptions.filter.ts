import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // Erreurs levées volontairement (400, 401, 404, 429...) : leur message est écrit
    // par nous ou par Nest, on peut le renvoyer tel quel.
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response
        .status(status)
        .json(typeof body === 'string' ? { statusCode: status, message: body } : body);
      return;
    }

    // Tout le reste est inattendu : le détail va dans les logs serveur uniquement.
    // On journalise la méthode et le chemin (request.path, sans la query string),
    // jamais le corps ni les en-têtes : ils contiendront mots de passe, tokens et cookies.
    this.logger.error(
      `Unhandled exception on ${request.method} ${request.path}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }
}
