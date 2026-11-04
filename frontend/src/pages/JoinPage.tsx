import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/session';
import { HomeIcon } from '../components/icons';
import { acceptInvitation, previewInvitation } from '../households/households-api';
import { ApiError } from '../lib/api';

// Jeton dans le fragment de l'URL (#token=…) : le navigateur ne l'envoie jamais au serveur du front.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function readToken(hash: string): string | null {
  const token = new URLSearchParams(hash.slice(1)).get('token');
  return token !== null && TOKEN_PATTERN.test(token) ? token : null;
}

// Ouverture d'un lien d'invitation (page réservée aux utilisateurs connectés : sans session, la
// connexion ou l'inscription ramène ici avec le lien). Rien n'est accepté sans confirmation.
export function JoinPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { reloadUser, selectHousehold } = useAuth();
  // Le jeton est lu une fois, puis retiré de la barre d'adresse et de l'historique : il ne reste
  // qu'en mémoire, le temps de cette page.
  const [token] = useState(() => readToken(location.hash));

  useEffect(() => {
    if (location.hash) {
      void navigate('/join', { replace: true });
    }
  }, [location.hash, navigate]);

  const preview = useQuery({
    queryKey: ['invitation-preview', token],
    queryFn: () => previewInvitation(token ?? ''),
    enabled: token !== null,
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () => acceptInvitation(token ?? ''),
    onSuccess: async ({ householdId }) => {
      await reloadUser();
      selectHousehold(householdId);
      queryClient.removeQueries({ queryKey: ['invitation-preview'] });
      void navigate('/', { replace: true });
    },
  });

  if (token === null || preview.isError) {
    return (
      <JoinMessage title="Lien d'invitation invalide">
        Ce lien n'est plus valable : il a déjà servi, il a expiré (7 jours) ou il a été retiré. Demandez un nouveau lien à
        la personne qui vous a invité.
      </JoinMessage>
    );
  }
  if (preview.isPending) {
    return <p className="text-ink-600">Chargement de l'invitation…</p>;
  }
  if (preview.data.alreadyMember) {
    return (
      <JoinMessage title="Vous êtes déjà membre">
        Vous faites déjà partie du foyer « {preview.data.householdName} ».
      </JoinMessage>
    );
  }

  return (
    <div className="card p-6">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-peach-100 text-peach-800">
        <HomeIcon className="h-6 w-6" />
      </span>
      <h1 className="mt-4 text-[22px] leading-tight font-extrabold">Rejoindre « {preview.data.householdName} » ?</h1>
      {preview.data.invitedBy && <p className="mt-1 text-ink-600">Invitation de {preview.data.invitedBy}</p>}

      <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm">
        <li>Vous partagerez l'inventaire, les alertes et les recettes de ce foyer avec ses membres.</li>
        <li>Ils verront votre prénom et votre nom, ou votre adresse email si vous ne les avez pas renseignés.</li>
        <li>Vous gardez votre propre foyer, et vous pourrez quitter celui-ci à tout moment.</li>
      </ul>

      {accept.isError && (
        <p role="alert" className="alert-error mt-4">
          {acceptErrorMessage(accept.error)}
        </p>
      )}

      <div className="mt-6 flex gap-2">
        <Link to="/" className="btn-secondary flex-1">
          Plus tard
        </Link>
        <button type="button" disabled={accept.isPending} onClick={() => accept.mutate()} className="btn-primary flex-1">
          Rejoindre
        </button>
      </div>
    </div>
  );
}

function JoinMessage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-6">
      <h1 className="text-[22px] leading-tight font-extrabold">{title}</h1>
      <p className="mt-2 text-ink-600">{children}</p>
      <Link to="/" className="btn-primary mt-6 w-full">
        Aller à mon inventaire
      </Link>
    </div>
  );
}

function acceptErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) {
    return 'Ce foyer est complet, ou vous en faites déjà partie.';
  }
  if (error instanceof ApiError && error.status === 400) {
    return "Ce lien n'est plus valable. Demandez-en un nouveau.";
  }
  return "L'invitation n'a pas pu être acceptée. Réessayez.";
}
