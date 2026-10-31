import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useHouseholdId } from '../auth/session';
import { ArrowLeftIcon, CheckIcon, ClockIcon, LeafIcon } from '../components/icons';
import { trackEvent } from '../lib/analytics';
import { ApiError } from '../lib/api';
import { updatePantryItemStatus } from '../pantry/pantry-api';
import { formatDaysLeft, URGENCY_STYLES } from '../pantry/urgency';
import { fetchRecipe, fetchSuggestions, formatDuration, type RecipeSuggestion } from '../recipes/recipes-api';

export function RecipePage() {
  const { recipeId = '' } = useParams();
  const householdId = useHouseholdId();
  // Nombre de produits retirés de l'inventaire après « J'ai cuisiné ça » (message de confirmation).
  const [cookedCount, setCookedCount] = useState<number | null>(null);

  const recipe = useQuery({ queryKey: ['recipe', recipeId], queryFn: () => fetchRecipe(recipeId) });

  // Une seule mesure par recette affichée (React exécute les effets deux fois en développement).
  const viewed = useRef<string | null>(null);
  const loadedId = recipe.data?.id;
  useEffect(() => {
    if (loadedId && viewed.current !== loadedId) {
      viewed.current = loadedId;
      trackEvent('recipe-viewed');
    }
  }, [loadedId]);
  // Les suggestions (déjà en cache depuis la page Recettes) disent ce que la recette utilise de l'inventaire.
  const suggestions = useQuery({
    queryKey: ['recipe-suggestions', householdId],
    queryFn: () => fetchSuggestions(householdId),
  });
  const suggestion = suggestions.data?.find((candidate) => candidate.recipe.id === recipeId);
  const atHome = new Set(suggestion?.uses.map(({ ingredientName }) => ingredientName));

  return (
    <>
      <Link to="/recipes" className="mb-4 inline-flex items-center gap-1 text-sm font-bold hover:text-peach-800">
        <ArrowLeftIcon className="h-4 w-4" /> Idées recettes
      </Link>

      {recipe.isPending && <p className="text-ink-600">Chargement de la recette…</p>}

      {recipe.isError && (
        <p role="alert" className="alert-error">
          {recipe.error instanceof ApiError && (recipe.error.status === 404 || recipe.error.status === 400)
            ? "Cette recette n'existe pas ou plus."
            : 'Impossible de charger la recette. Réessayez plus tard.'}
        </p>
      )}

      {recipe.data && (
        <article>
          <h1 className="page-title">{recipe.data.title}</h1>
          <p className="page-subtitle">{recipe.data.summary}</p>
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-ink-600">
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon className="h-4 w-4" /> {formatDuration(recipe.data.prepMinutes + recipe.data.cookMinutes)}
              {recipe.data.cookMinutes > 0 && ` (dont ${formatDuration(recipe.data.cookMinutes)} de cuisson)`}
            </span>
            <span>{recipe.data.servings} pers.</span>
            {recipe.data.vegetarian && (
              <span className="inline-flex items-center gap-1 text-mint-800">
                <LeafIcon className="h-4 w-4" /> Végétarien
              </span>
            )}
          </p>

          {cookedCount !== null && (
            <p role="status" className="alert-success mt-6">
              {cookedCount} produit{cookedCount > 1 ? 's' : ''} retiré{cookedCount > 1 ? 's' : ''} de l'inventaire. Bon appétit !
            </p>
          )}

          <section aria-labelledby="ingredients-title" className="mt-8">
            <h2 id="ingredients-title" className="text-lg font-extrabold">
              Ingrédients
            </h2>
            <ul className="mt-3 divide-y divide-line rounded-3xl ring-1 ring-line">
              {recipe.data.ingredients.map((ingredient) => (
                <li key={ingredient.name} className="flex items-center justify-between gap-3 px-4 py-3 text-[15px]">
                  <span>
                    <span className="font-semibold">{ingredient.name}</span>
                    {ingredient.optional && <span className="text-ink-600"> (facultatif)</span>}
                    {ingredient.staple && <span className="text-ink-600"> · placard</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-sm text-ink-600">
                    {ingredient.quantity}
                    {atHome.has(ingredient.name) && (
                      <span title="Dans votre inventaire" className="grid h-5 w-5 place-items-center rounded-full bg-mint-100 text-mint-800">
                        <CheckIcon className="h-3.5 w-3.5" />
                        <span className="sr-only">dans votre inventaire</span>
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="steps-title" className="mt-8">
            <h2 id="steps-title" className="text-lg font-extrabold">
              Préparation
            </h2>
            <ol className="mt-3 space-y-3">
              {recipe.data.steps.map((step, index) => (
                <li key={step} className="flex gap-3 text-[15px] leading-relaxed">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink-900 text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </section>

          {suggestion && suggestion.uses.length > 0 && (
            <CookedSection
              // Nouvelle section si les produits utilisés changent (après un premier « J'ai cuisiné ça »).
              key={suggestion.uses.map(({ itemId }) => itemId).join()}
              uses={suggestion.uses}
              onCooked={setCookedCount}
            />
          )}
        </article>
      )}
    </>
  );
}

// « J'ai cuisiné ça » : les produits utilisés passent en « consommé », ce qui alimentera les
// statistiques anti-gaspi. Tous cochés par défaut ; on décoche ce qu'il reste (la recette n'a pas
// forcément utilisé les 6 œufs de la boîte).
function CookedSection({
  uses,
  onCooked,
}: {
  uses: RecipeSuggestion['uses'];
  onCooked: (count: number) => void;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(() => new Set(uses.map(({ itemId }) => itemId)));

  const markConsumed = useMutation({
    mutationFn: (itemIds: string[]) => Promise.all(itemIds.map((id) => updatePantryItemStatus(id, 'CONSUMED'))),
    onSuccess: async (_result, itemIds) => {
      trackEvent('recipe-cooked');
      onCooked(itemIds.length);
      // Le message de confirmation est en haut de la recette, le bouton tout en bas.
      window.scrollTo({ top: 0, behavior: 'smooth' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['pantry-items'] }),
        queryClient.invalidateQueries({ queryKey: ['recipe-suggestions'] }),
      ]);
    },
  });

  function toggle(itemId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    markConsumed.mutate([...selected]);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 rounded-3xl bg-mint-100 p-5">
      <h2 className="text-lg font-extrabold">J'ai cuisiné ça</h2>
      <p className="mt-1 text-sm">Les produits cochés sortent de votre inventaire. Décochez ceux qu'il vous reste.</p>

      <fieldset className="mt-4 space-y-2">
        <legend className="sr-only">Produits utilisés</legend>
        {uses.map((use) => (
          <label key={use.itemId} className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white px-4 py-3">
            <input
              type="checkbox"
              checked={selected.has(use.itemId)}
              onChange={() => toggle(use.itemId)}
              className="h-5 w-5 accent-ink-900"
            />
            <span className="flex-1 font-semibold">{use.itemName}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${URGENCY_STYLES[use.urgency].colors}`}>
              {formatDaysLeft(use.daysLeft)}
            </span>
          </label>
        ))}
      </fieldset>

      {markConsumed.isError && (
        <p role="alert" className="alert-error mt-3">
          L'inventaire n'a pas pu être mis à jour. Réessayez.
        </p>
      )}

      <button type="submit" disabled={selected.size === 0 || markConsumed.isPending} className="btn-primary mt-4 w-full">
        {markConsumed.isPending
          ? 'Mise à jour…'
          : `Retirer ${selected.size} produit${selected.size > 1 ? 's' : ''} de l'inventaire`}
      </button>
    </form>
  );
}
