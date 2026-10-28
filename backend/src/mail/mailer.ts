export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

// Contrat d'envoi d'email. Le reste de l'application ne dépend que de cette classe abstraite :
// l'implémentation réelle (SMTP) est remplacée par un faux dans les tests, sans aucun envoi.
export abstract class Mailer {
  abstract send(message: MailMessage): Promise<void>;
}
