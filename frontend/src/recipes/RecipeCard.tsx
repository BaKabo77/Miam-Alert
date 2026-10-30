import { Link } from 'react-router';
import { ClockIcon, LeafIcon } from '../components/icons';
import { URGENCY_STYLES } from '../pantry/urgency';
import { formatDuration, type RecipeSuggestion } from './recipes-api';

// Une idée de recette : ce qu'elle sauve de l'inventaire (pastilles aux couleurs de l'urgence)
// et ce qu'il faudrait acheter.
export function RecipeCard({ suggestion }: { suggestion: RecipeSuggestion }) {
  const { recipe, uses, missing } = suggestion;

  return (
    <li>
      <Link to={`/recipes/${recipe.id}`} className="card block p-4 transition hover:ring-ink-400">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[17px] font-bold tracking-[-0.01em]">{recipe.title}</p>
          {recipe.vegetarian && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-mint-100 px-2.5 py-0.5 text-xs font-bold text-mint-800">
              <LeafIcon className="h-3.5 w-3.5" /> Végétarien
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-ink-600">{recipe.summary}</p>
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-600">
          <ClockIcon className="h-3.5 w-3.5" /> {formatDuration(recipe.totalMinutes)} · {recipe.servings} pers.
        </p>

        <ul aria-label="Produits de l'inventaire utilisés" className="mt-3 flex flex-wrap gap-1.5">
          {uses.map((use) => (
            <li key={use.itemId} className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${URGENCY_STYLES[use.urgency].colors}`}>
              {use.itemName}
            </li>
          ))}
        </ul>

        <p className={`mt-3 text-xs font-semibold ${missing.length === 0 ? 'text-mint-800' : 'text-ink-600'}`}>
          {missing.length === 0 ? 'Tout est à la maison' : `À acheter : ${missing.join(', ')}`}
        </p>
      </Link>
    </li>
  );
}
