import type { Urgency } from '../pantry/urgency.js';
import { type PantryItemForRecipes, type RecipeForScoring, scoreRecipes } from './suggestions.js';

const DAYS: Record<Urgency, number> = { EXPIRED: -2, PAST_BEST_BEFORE: -1, URGENT: 1, SOON: 5, OK: 30 };

let nextId = 0;
function item(ingredientKey: string, urgency: Urgency, daysLeft = DAYS[urgency]): PantryItemForRecipes {
  nextId++;
  return { id: `item-${nextId}`, name: `${ingredientKey} ${nextId}`, ingredientKey, urgency, daysLeft };
}

function recipe(id: string, ...keys: string[]): RecipeForScoring {
  return {
    id,
    ingredients: keys.map((entry) => {
      // « ?clé » = facultatif, « !clé » = basique du placard.
      const optional = entry.startsWith('?');
      const staple = entry.startsWith('!');
      const key = entry.replace(/^[?!]/, '');
      return { key, name: key, optional, staple };
    }),
  };
}

const ids = (results: { recipeId: string }[]) => results.map(({ recipeId }) => recipeId);

describe('scoreRecipes', () => {
  it('ranks first the recipe that saves the most urgent products', () => {
    const recipes = [recipe('omelette', 'egg', 'mushroom'), recipe('salade', 'salad', 'tomato')];
    const pantry = [item('egg', 'URGENT'), item('salad', 'OK'), item('tomato', 'OK')];

    expect(ids(scoreRecipes(recipes, pantry, 10))).toEqual(['omelette', 'salade']);
  });

  it('prefers saving one product due today over using several products that can wait', () => {
    // many-soon : tout est à la maison, 3 produits de la semaine ; one-urgent : 1 produit urgent, un achat.
    const recipes = [recipe('many-soon', 'a', 'b', 'c', 'd'), recipe('one-urgent', 'e', 'f')];
    const pantry = [item('a', 'SOON'), item('b', 'SOON'), item('c', 'SOON'), item('d', 'OK'), item('e', 'URGENT')];

    expect(ids(scoreRecipes(recipes, pantry, 10))).toEqual(['one-urgent', 'many-soon']);
  });

  it('then prefers the recipe that uses the most products of the week', () => {
    const recipes = [recipe('one-soon', 'a', 'b'), recipe('two-soon', 'c', 'd')];
    const pantry = [item('a', 'SOON'), item('b', 'OK'), item('c', 'SOON'), item('d', 'SOON')];

    expect(ids(scoreRecipes(recipes, pantry, 10))).toEqual(['two-soon', 'one-soon']);
  });

  it('never suggests using a product past its DLC (health risk)', () => {
    const recipes = [recipe('omelette', 'egg', 'mushroom')];
    const pantry = [item('egg', 'EXPIRED'), item('mushroom', 'EXPIRED')];

    expect(scoreRecipes(recipes, pantry, 10)).toEqual([]);
  });

  it('still uses a product past its DDM, as an urgent one (still safe to eat)', () => {
    const [result] = scoreRecipes([recipe('pates', 'pasta', 'tomato-sauce')], [item('pasta', 'PAST_BEST_BEFORE')], 10);

    expect(result.urgentCount).toBe(1);
    expect(result.uses[0].urgency).toBe('PAST_BEST_BEFORE');
  });

  it('uses the most urgent of several items of the same ingredient', () => {
    const pantry = [item('egg', 'OK'), item('egg', 'URGENT', 0), item('egg', 'SOON')];
    const [result] = scoreRecipes([recipe('omelette', 'egg', 'mushroom')], pantry, 10);

    expect(result.uses).toHaveLength(1);
    expect(result.uses[0].daysLeft).toBe(0);
  });

  it('lists the missing ingredients, never the staples nor the optional ones', () => {
    const [result] = scoreRecipes(
      [recipe('quiche', 'pastry', 'egg', 'cream', '?grated-cheese', '!salt')],
      [item('egg', 'URGENT')],
      10,
    );

    expect(result.missing).toEqual(['pastry', 'cream']);
    expect(result.coverage).toBeCloseTo(1 / 3);
  });

  it('counts an urgent staple or optional ingredient, but never suggests a recipe for it alone', () => {
    const recipes = [recipe('crepes', '!flour', 'egg', 'milk', '?sugar')];

    // Seul un basique est présent : la recette n'aide à sauver aucun produit « réel ».
    expect(scoreRecipes(recipes, [item('flour', 'URGENT')], 10)).toEqual([]);

    // Avec un œuf, la farine urgente compte : la recette aide aussi à la finir.
    const [result] = scoreRecipes(recipes, [item('flour', 'URGENT'), item('egg', 'SOON')], 10);
    expect(result).toMatchObject({ urgentCount: 1, soonCount: 1 });
  });

  it('breaks ties by the share of ingredients already at home', () => {
    const recipes = [recipe('needs-shopping', 'egg', 'x', 'y'), recipe('almost-ready', 'egg', 'z')];
    const pantry = [item('egg', 'URGENT'), item('z', 'OK')];

    // Même nombre de produits urgents ; almost-ready n'a rien à acheter, needs-shopping deux ingrédients.
    expect(ids(scoreRecipes(recipes, pantry, 10))).toEqual(['almost-ready', 'needs-shopping']);
  });

  it('returns at most the requested number of recipes', () => {
    const recipes = Array.from({ length: 5 }, (_, index) => recipe(`r${index}`, 'egg', 'milk'));

    expect(scoreRecipes(recipes, [item('egg', 'OK')], 3)).toHaveLength(3);
  });

  it('returns nothing for an empty inventory', () => {
    expect(scoreRecipes([recipe('omelette', 'egg')], [], 10)).toEqual([]);
  });
});
