import type { MailMessage } from './mailer.js';

// Contenu fixe : aucune donnée saisie par l'utilisateur (nom, prénom) n'est insérée dans l'email,
// ce qui écarte toute injection de HTML. Le lien est construit par l'API et échappé quand même.
export function verificationEmail(to: string, link: string): MailMessage {
  return {
    to,
    subject: "Confirmez votre adresse email – Miam'Alert",
    text: [
      'Bonjour,',
      '',
      "Pour confirmer votre adresse email sur Miam'Alert, ouvrez ce lien (valable 24 heures) :",
      link,
      '',
      "Si vous n'avez pas créé de compte, ignorez simplement cet email.",
    ].join('\n'),
    html: `<p>Bonjour,</p>
<p>Pour confirmer votre adresse email sur Miam'Alert, cliquez sur ce lien (valable 24&nbsp;heures)&nbsp;:</p>
<p><a href="${escapeHtml(link)}">Confirmer mon adresse email</a></p>
<p>Si vous n'avez pas créé de compte, ignorez simplement cet email.</p>`,
  };
}

export function passwordResetEmail(to: string, link: string): MailMessage {
  return {
    to,
    subject: "Réinitialisez votre mot de passe – Miam'Alert",
    text: [
      'Bonjour,',
      '',
      "Pour choisir un nouveau mot de passe sur Miam'Alert, ouvrez ce lien (valable 30 minutes) :",
      link,
      '',
      "Si vous n'avez rien demandé, ignorez cet email : votre mot de passe actuel reste valable.",
    ].join('\n'),
    html: `<p>Bonjour,</p>
<p>Pour choisir un nouveau mot de passe sur Miam'Alert, cliquez sur ce lien (valable 30&nbsp;minutes)&nbsp;:</p>
<p><a href="${escapeHtml(link)}">Choisir un nouveau mot de passe</a></p>
<p>Si vous n'avez rien demandé, ignorez cet email&nbsp;: votre mot de passe actuel reste valable.</p>`,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}
