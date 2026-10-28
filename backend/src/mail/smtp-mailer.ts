import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import { EnvironmentVariables, NodeEnv } from '../config/env.validation.js';
import { Mailer, type MailMessage } from './mailer.js';

const SENDER_NAME = "Miam'Alert";

// Envoi par SMTP : Mailpit en développement (faux serveur qui capture les emails), Brevo en production.
@Injectable()
export class SmtpMailer extends Mailer {
  private readonly transport: Transporter;
  private readonly from: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super();
    const user = config.get('SMTP_USER', { infer: true });
    this.from = config.get('MAIL_FROM', { infer: true });
    this.transport = createTransport({
      host: config.get('SMTP_HOST', { infer: true }),
      port: config.get('SMTP_PORT', { infer: true }),
      auth: user ? { user, pass: config.get('SMTP_PASSWORD', { infer: true }) } : undefined,
      // En production, chiffrement TLS obligatoire (STARTTLS) : sans lui, les identifiants SMTP
      // et le lien de vérification circuleraient en clair. Impossible à désactiver par configuration.
      requireTLS: config.get('NODE_ENV', { infer: true }) === NodeEnv.Production,
      // Délais courts : un serveur d'emails lent ne doit pas bloquer une requête de l'API.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  async send({ to, subject, text, html }: MailMessage): Promise<void> {
    await this.transport.sendMail({
      from: { name: SENDER_NAME, address: this.from },
      // Adresses passées en objet et non en texte : elles ne passent pas par l'analyseur d'adresses
      // de nodemailer, où des failles ont permis d'ajouter un destinataire caché.
      to: { name: '', address: to },
      subject,
      text,
      html,
    });
  }
}
