import { Global, Module } from '@nestjs/common';
import { Mailer } from './mailer.js';
import { SmtpMailer } from './smtp-mailer.js';

// Global : tout module peut injecter Mailer sans l'importer.
@Global()
@Module({
  providers: [{ provide: Mailer, useClass: SmtpMailer }],
  exports: [Mailer],
})
export class MailModule {}
