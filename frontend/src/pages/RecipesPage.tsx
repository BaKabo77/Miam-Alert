import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { useHouseholdId } from '../auth/session';
import { PlusIcon, PotIcon, ScanIcon } from '../components/icons';
import { RecipeCard } from '../recipes/RecipeCard';
import { fetchSuggestions } from '../recipes/recipes-api';

// Les meilleures idées d'abord ; les suivantes, souvent avec plus de courses, sur demande.
const FIRST_SHOWN = 8;

export function RecipesPage() {
  const householdId = useHouseholdId();
  const [showAll, setShowAll] = useState(false);
  const { data: suggestions, isPending, isError } = useQuery({
    queryKey: ['recipe-suggestions', householdId],
    queryFn: () => fetchSuggestions(householdId),
  });

  return (
    <>
      <div className="mb-6">
        <h1 className="page-title">Idées recettes</h1>
        <p className="page-subtitle">Classées pour finir d'abord ce qui périme le plus vite.</p>
      </div>

      {isPending && <p className="text-ink-600">Recherche de recettes…</p>}

      {isError && (
        <p role="alert" className="alert-error">
          Impossible de charger les recettes. Réessayez plus tard.
        </p>
      )}

      {suggestions && suggestions.length === 0 && <EmptyState />}

      {suggestions && suggestions.length > 0 && (
        <>
          <ul className="space-y-3">
            {(showAll ? suggestions : suggestions.slice(0, FIRST_SHOWN)).map((suggestion) => (
              <RecipeCard key={suggestion.recipe.id} suggestion={suggestion} />
            ))}
          </ul>
          {!showAll && suggestions.length > FIRST_SHOWN && (
            <button type="button" onClick={() => setShowAll(true)} className="btn-secondary mt-4 w-full">
              Voir d'autres idées ({suggestions.length - FIRST_SHOWN})
            </button>
          )}
        </>
      )}

      {/* Rappel de sécurité alimentaire : la règle est appliquée par l'API, on l'explique ici. */}
      {suggestions && suggestions.length > 0 && (
        <p className="mt-6 text-xs text-ink-600">
          Les produits dont la DLC est dépassée ne sont jamais proposés : ils ne doivent plus être consommés.
        </p>
      )}
    </>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl bg-peach-100 px-6 py-10 text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white text-peach-800">
        <PotIcon className="h-8 w-8" />
      </span>
      <p className="mt-4 text-xl font-extrabold tracking-[-0.02em]">Pas encore d'idée</p>
      <p className="mt-1 text-[15px] text-ink-600">
        Ajoutez vos produits : les recettes qui les utilisent apparaîtront ici, en commençant par les plus urgents.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Link to="/scan" className="btn-primary">
          <ScanIcon className="h-4 w-4" /> Scanner
        </Link>
        <Link to="/add" className="btn-secondary">
          <PlusIcon className="h-4 w-4" /> Ajouter
        </Link>
      </div>
    </div>
  );
}
