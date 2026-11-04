import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useAuth, useHouseholdId } from '../auth/session';
import { CopyIcon, ShareIcon, TrashIcon } from '../components/icons';
import { initials } from '../components/initials';
import {
  createInvitation,
  fetchHousehold,
  fetchInvitations,
  removeMember,
  renameHousehold,
  revokeInvitation,
  transferOwnership,
  type Household,
  type HouseholdMember,
} from '../households/households-api';
import { ApiError } from '../lib/api';

// « Mon foyer » : les membres du foyer affiché, et ce que chacun peut y faire selon son rôle.
// L'interface masque les actions réservées au propriétaire, mais c'est l'API qui décide : un membre
// qui les tenterait quand même recevrait 403.
export function HouseholdPage() {
  const householdId = useHouseholdId();
  const { session, reloadUser } = useAuth();
  const queryClient = useQueryClient();
  const householdCount = session.status === 'authenticated' ? session.user.households.length : 0;

  const { data: household, isPending, isError } = useQuery({
    queryKey: ['household', householdId],
    queryFn: () => fetchHousehold(householdId),
  });

  // Après une action : le foyer est relu, ainsi que le profil (nom et rôle dans le sélecteur de foyer).
  async function refresh(updated?: Household) {
    if (updated) {
      queryClient.setQueryData(['household', householdId], updated);
    } else {
      await queryClient.invalidateQueries({ queryKey: ['household', householdId] });
    }
    await reloadUser();
  }

  if (isPending) {
    return <p className="text-ink-600">Chargement…</p>;
  }
  if (isError) {
    return (
      <p role="alert" className="alert-error">
        Le foyer n'a pas pu être chargé. Réessayez dans un instant.
      </p>
    );
  }

  const isOwner = household.role === 'OWNER';

  return (
    <>
      <div className="mb-6">
        <h1 className="page-title">Mon foyer</h1>
        <p className="page-subtitle">
          L'inventaire, les alertes et les recettes sont partagés entre tous les membres du foyer.
        </p>
      </div>

      <HouseholdName household={household} onRenamed={refresh} />

      <section className="mt-8">
        <h2 className="text-lg font-extrabold">
          Membres <span className="font-semibold text-ink-600">({household.members.length}/{household.maxMembers})</span>
        </h2>
        <ul className="mt-3 space-y-2">
          {household.members.map((member) => (
            <MemberRow
              key={member.userId}
              householdId={householdId}
              member={member}
              canManage={isOwner && !member.isMe}
              onChanged={refresh}
            />
          ))}
        </ul>
      </section>

      {isOwner && (
        <section className="mt-8 border-t border-line pt-6">
          <InvitationsSection householdId={householdId} full={household.members.length >= household.maxMembers} />
        </section>
      )}

      <section className="mt-8 border-t border-line pt-6">
        <LeaveSection
          household={household}
          householdCount={householdCount}
          // Le foyer quitté n'est plus accessible (404) : on ne le relit pas, on passe au foyer suivant.
          onLeft={async () => {
            await reloadUser();
            queryClient.removeQueries({ queryKey: ['household', householdId] });
          }}
        />
      </section>
    </>
  );
}

function HouseholdName({ household, onRenamed }: { household: Household; onRenamed: (updated: Household) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(household.name);
  const rename = useMutation({
    mutationFn: (newName: string) => renameHousehold(household.id, newName),
    onSuccess: async (updated) => {
      setEditing(false);
      await onRenamed(updated);
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    rename.mutate(name);
  }

  if (editing) {
    return (
      <form onSubmit={handleSubmit} className="card space-y-3 p-5">
        <label className="block">
          <span className="label">Nom du foyer</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={100}
            className="input"
          />
        </label>
        {rename.isError && (
          <p role="alert" className="alert-error">
            Lettres, chiffres, espaces et ponctuation simple uniquement (100 caractères max).
          </p>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={() => setEditing(false)} className="btn-secondary flex-1">
            Annuler
          </button>
          <button type="submit" disabled={rename.isPending} className="btn-primary flex-1">
            Enregistrer
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-3xl bg-ink-900 p-5 text-white">
      <div className="min-w-0">
        <p className="truncate text-[17px] font-bold">{household.name}</p>
        <p className="text-sm text-white/75">{household.role === 'OWNER' ? 'Vous en êtes propriétaire' : 'Vous en êtes membre'}</p>
      </div>
      {household.role === 'OWNER' && (
        <button
          type="button"
          onClick={() => {
            setName(household.name);
            setEditing(true);
          }}
          className="shrink-0 rounded-full bg-white/15 px-4 py-2 text-sm font-bold transition hover:bg-white/25"
        >
          Renommer
        </button>
      )}
    </div>
  );
}

function MemberRow({
  householdId,
  member,
  canManage,
  onChanged,
}: {
  householdId: string;
  member: HouseholdMember;
  canManage: boolean;
  onChanged: (updated?: Household) => Promise<void>;
}) {
  // Action en attente de confirmation : un clic malheureux ne retire personne.
  const [pending, setPending] = useState<'remove' | 'transfer' | null>(null);
  const action = useMutation({
    mutationFn: async (kind: 'remove' | 'transfer') =>
      kind === 'remove' ? removeMember(householdId, member.userId) : transferOwnership(householdId, member.userId),
    onSuccess: async (result) => {
      setPending(null);
      await onChanged(result ?? undefined);
    },
  });

  // L'email n'apparaît que pour un membre sans prénom : on n'en déduit pas d'initiales.
  const [first, ...rest] = member.displayName.includes('@') ? [] : member.displayName.split(' ');
  const avatar = initials(first ?? null, rest.join(' ') || null);

  return (
    <li className="card p-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-peach-100 text-sm font-bold text-peach-800"
        >
          {avatar || '?'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">
            {member.displayName}
            {member.isMe && <span className="font-semibold text-ink-600"> (vous)</span>}
          </p>
          <p className="text-sm text-ink-600">{member.role === 'OWNER' ? 'Propriétaire' : 'Membre'}</p>
        </div>
      </div>

      {canManage && pending === null && (
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => setPending('transfer')} className="chip">
            Rendre propriétaire
          </button>
          <button type="button" onClick={() => setPending('remove')} className="chip text-tomato-700 hover:bg-tomato-100">
            Retirer
          </button>
        </div>
      )}

      {pending !== null && (
        <div className="mt-3 space-y-3 rounded-2xl bg-mist p-3">
          <p className="text-sm">
            {pending === 'remove'
              ? `${member.displayName} n'aura plus accès à l'inventaire de ce foyer.`
              : `${member.displayName} deviendra propriétaire du foyer, et vous en deviendrez membre.`}
          </p>
          {action.isError && (
            <p role="alert" className="alert-error">
              L'action n'a pas pu aboutir. Réessayez.
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setPending(null)} className="btn-secondary h-10 flex-1">
              Annuler
            </button>
            <button
              type="button"
              disabled={action.isPending}
              onClick={() => action.mutate(pending)}
              className="btn-primary h-10 flex-1"
            >
              Confirmer
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function InvitationsSection({ householdId, full }: { householdId: string; full: boolean }) {
  const queryClient = useQueryClient();
  const queryKey = ['household-invitations', householdId];
  // Le lien n'est connu qu'au moment de sa création : il ne vit que dans cet état, en mémoire.
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: invitations = [] } = useQuery({ queryKey, queryFn: () => fetchInvitations(householdId) });
  const create = useMutation({
    mutationFn: () => createInvitation(householdId),
    onSuccess: async (created) => {
      setLink(created.url);
      setCopied(false);
      await queryClient.invalidateQueries({ queryKey });
    },
  });
  const revoke = useMutation({
    mutationFn: (invitationId: string) => revokeInvitation(householdId, invitationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <h2 className="text-lg font-extrabold">Inviter quelqu'un</h2>
      <p className="mt-1 text-sm text-ink-600">
        Un lien d'invitation permet à <strong>une seule personne</strong> de rejoindre votre foyer, pendant 7 jours. Elle
        devra se connecter ou créer un compte.
      </p>

      {link ? (
        <div className="mt-4 space-y-3 rounded-3xl bg-mint-100 p-4">
          <p className="text-sm font-semibold text-mint-800">
            Envoyez ce lien maintenant : il ne sera plus affiché ensuite.
          </p>
          <input readOnly value={link} onFocus={(event) => event.target.select()} aria-label="Lien d'invitation" className="input" />
          <div className="flex gap-2">
            <button type="button" onClick={() => void copy(link)} className="btn-secondary h-10 flex-1">
              <CopyIcon className="h-4 w-4" /> {copied ? 'Copié' : 'Copier'}
            </button>
            {'share' in navigator && (
              <button
                type="button"
                onClick={() => void navigator.share({ title: "Miam'Alert", text: 'Rejoins mon foyer sur Miam\'Alert', url: link }).catch(() => {})}
                className="btn-primary h-10 flex-1"
              >
                <ShareIcon className="h-4 w-4" /> Partager
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            disabled={create.isPending || full}
            onClick={() => create.mutate()}
            className="btn-primary mt-4 w-full"
          >
            Créer un lien d'invitation
          </button>
          {full && <p className="mt-2 text-sm text-ink-600">Le foyer est complet.</p>}
          {create.isError && (
            <p role="alert" className="alert-error mt-3">
              {create.error instanceof ApiError && create.error.status === 409
                ? 'Trop de liens sont en circulation : retirez-en un avant d\'en créer un autre.'
                : "Le lien n'a pas pu être créé. Réessayez."}
            </p>
          )}
        </>
      )}

      {invitations.length > 0 && (
        <ul className="mt-4 space-y-2">
          {invitations.map((invitation) => (
            <li key={invitation.id} className="card flex items-center justify-between gap-3 p-4">
              <p className="text-sm">
                Lien créé le {formatDate(invitation.createdAt)}
                <br />
                <span className="text-ink-600">valable jusqu'au {formatDate(invitation.expiresAt)}</span>
              </p>
              <button
                type="button"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(invitation.id)}
                aria-label="Retirer ce lien"
                title="Retirer ce lien"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-tomato-700 transition hover:bg-tomato-100"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function LeaveSection({
  household,
  householdCount,
  onLeft,
}: {
  household: Household;
  // Combien de foyers a l'utilisateur : qui quitte son dernier foyer en reçoit un nouveau, vide.
  householdCount: number;
  onLeft: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const me = household.members.find((member) => member.isMe);
  const leave = useMutation({
    mutationFn: () => removeMember(household.id, me?.userId ?? ''),
    onSuccess: () => onLeft(),
  });

  // Les mêmes règles que l'API, pour expliquer plutôt que proposer un bouton voué à l'échec.
  let reason: string | null = null;
  if (household.members.length === 1) {
    reason = 'Vous êtes le seul membre de ce foyer.';
  } else if (household.role === 'OWNER') {
    reason = "Pour quitter ce foyer, rendez d'abord un autre membre propriétaire.";
  }

  if (reason) {
    return <p className="text-sm text-ink-600">{reason}</p>;
  }
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="btn w-full text-tomato-700 hover:bg-tomato-100">
        Quitter ce foyer
      </button>
    );
  }
  return (
    <div className="space-y-3 rounded-3xl bg-tomato-100 p-5">
      <p className="text-sm">
        Vous n'aurez plus accès à l'inventaire de « {household.name} ». Il faudra une nouvelle invitation pour revenir.
        {householdCount <= 1 && " C'est votre seul foyer : un nouveau foyer vide sera créé pour vous."}
      </p>
      {leave.isError && (
        <p role="alert" className="alert-error">
          Vous n'avez pas pu quitter le foyer. Réessayez.
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={() => setConfirming(false)} className="btn-secondary flex-1">
          Annuler
        </button>
        <button
          type="button"
          disabled={leave.isPending}
          onClick={() => leave.mutate()}
          className="btn flex-1 bg-tomato-700 text-white hover:bg-tomato-700/90"
        >
          Quitter
        </button>
      </div>
    </div>
  );
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}
