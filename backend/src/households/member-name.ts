// Nom sous lequel un membre apparaît aux autres membres du foyer : prénom et nom s'ils sont
// renseignés, l'adresse email seulement sinon (il faut bien pouvoir reconnaître la personne).
// Minimisation : l'email n'est montré que s'il n'y a rien d'autre.
export function memberDisplayName(user: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}): string {
  const name = [user.firstName, user.lastName].filter((part) => part !== null && part !== '').join(' ');
  return name === '' ? user.email : name;
}
