import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { PotIcon } from '../components/icons';
import { fetchSuggestions } from './recipes-api';

// Sur l'inventaire : la meilleure idée de recette, seulement si elle sauve un produit urgent.
// Même requête (et même cache) que la page Recettes.
export function RecipeTeaser({ householdId }: { householdId: string }) {
  const { data: suggestions } = useQuery({
    queryKey: ['recipe-suggestions', householdId],
    queryFn: () => fetchSuggestions(householdId),
  });
  const best = suggestions?.[0];
  if (!best || best.urgentCount === 0) {
    return null;
  }

  const urgent = best.uses.filter(({ urgency }) => urgency === 'URGENT' || urgency === 'PAST_BEST_BEFORE');

  return (
    <Link
      to={`/recipes/${best.recipe.id}`}
      className="mb-6 flex items-center gap-3.5 rounded-3xl bg-peach-100 p-4 transition hover:brightness-[0.98]"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-peach-800">
        <PotIcon />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold tracking-wide text-peach-800 uppercase">
          Idée pour finir {urgent.map(({ itemName }) => itemName).join(', ')}
        </span>
        <span className="block truncate text-[17px] font-bold">{best.recipe.title}</span>
      </span>
      <span aria-hidden="true" className="text-xl font-bold text-peach-800">
        →
      </span>
    </Link>
  );
}
