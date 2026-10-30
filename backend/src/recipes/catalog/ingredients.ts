// Catalogue des ingrédients que l'application sait reconnaître dans un inventaire et utiliser dans
// une recette. C'est une donnée de référence : elle vit dans le code (relue en revue, versionnée) et
// est recopiée en base au démarrage de l'API (voir recipe-catalog.sync.ts).
//
// Reconnaissance d'un article de l'inventaire (voir ingredient-matcher.ts) :
// - produit scanné : ses catégories Open Food Facts (offTags), la plus précise l'emporte ;
// - sinon, son nom : mots-clés en minuscules, sans accents (« oeufs » et non « Œufs »), écrits au
//   singulier ET au pluriel quand les deux existent. Le mot-clé le plus long l'emporte : « pommes de
//   terre » (pomme de terre) passe avant « pommes » (pomme).

export interface IngredientDefinition {
  // Identifiant stable, utilisé par les recettes et en base : ne jamais le renommer.
  key: string;
  name: string;
  // Basique du placard (sel, huile, farine...) : jamais compté comme « manquant » dans une recette.
  staple?: boolean;
  offTags?: string[];
  keywords: string[];
}

export const INGREDIENTS: IngredientDefinition[] = [
  // ---------- Basiques du placard ----------
  { key: 'salt', name: 'Sel', staple: true, keywords: ['sel', 'fleur de sel'] },
  { key: 'pepper', name: 'Poivre', staple: true, keywords: ['poivre'] },
  { key: 'oil', name: 'Huile', staple: true, offTags: ['en:vegetable-oils', 'en:olive-oils'], keywords: ['huile', 'huile d olive', 'huile de tournesol', 'huile de colza'] },
  { key: 'flour', name: 'Farine', staple: true, offTags: ['en:flours', 'en:wheat-flours'], keywords: ['farine'] },
  { key: 'sugar', name: 'Sucre', staple: true, offTags: ['en:sugars'], keywords: ['sucre', 'sucre en poudre', 'cassonade'] },
  { key: 'garlic', name: 'Ail', staple: true, offTags: ['en:garlic'], keywords: ['ail', 'gousse d ail'] },
  { key: 'onion', name: 'Oignon', staple: true, offTags: ['en:onions'], keywords: ['oignon', 'oignons', 'echalote', 'echalotes'] },
  { key: 'herbs', name: 'Herbes aromatiques', staple: true, keywords: ['herbes de provence', 'persil', 'basilic', 'ciboulette', 'coriandre', 'thym', 'menthe', 'aneth'] },
  { key: 'spices', name: 'Épices', staple: true, offTags: ['en:spices'], keywords: ['epices', 'curry', 'cumin', 'paprika', 'cannelle', 'muscade', 'piment'] },
  { key: 'stock', name: 'Bouillon', staple: true, offTags: ['en:broths', 'en:stock-cubes'], keywords: ['bouillon', 'cube de bouillon'] },
  { key: 'mustard', name: 'Moutarde', staple: true, offTags: ['en:mustards'], keywords: ['moutarde'] },
  { key: 'vinegar', name: 'Vinaigre', staple: true, offTags: ['en:vinegars'], keywords: ['vinaigre'] },
  { key: 'baking-powder', name: 'Levure chimique', staple: true, keywords: ['levure chimique', 'levure'] },
  { key: 'soy-sauce', name: 'Sauce soja', staple: true, offTags: ['en:soy-sauces'], keywords: ['sauce soja'] },
  { key: 'honey', name: 'Miel', staple: true, offTags: ['en:honeys'], keywords: ['miel'] },

  // ---------- Œufs et produits laitiers ----------
  { key: 'egg', name: 'Œufs', offTags: ['en:eggs', 'en:chicken-eggs'], keywords: ['oeuf', 'oeufs'] },
  { key: 'milk', name: 'Lait', offTags: ['en:milks', 'en:semi-skimmed-milks', 'en:whole-milks', 'en:skimmed-milks'], keywords: ['lait', 'lait demi ecreme', 'lait entier'] },
  { key: 'butter', name: 'Beurre', offTags: ['en:butters'], keywords: ['beurre'] },
  { key: 'cream', name: 'Crème fraîche', offTags: ['en:creams', 'en:fresh-creams', 'en:cooking-creams'], keywords: ['creme', 'creme fraiche', 'creme liquide', 'creme epaisse'] },
  { key: 'yogurt', name: 'Yaourt', offTags: ['en:yogurts', 'en:plain-yogurts', 'en:greek-style-yogurts'], keywords: ['yaourt', 'yaourts', 'yogourt', 'yoghourt'] },
  { key: 'fromage-blanc', name: 'Fromage blanc', offTags: ['en:fromages-blancs'], keywords: ['fromage blanc', 'faisselle'] },
  { key: 'grated-cheese', name: 'Fromage râpé', offTags: ['en:grated-cheeses'], keywords: ['fromage rape', 'emmental rape', 'gruyere rape'] },
  { key: 'cheese', name: 'Fromage', offTags: ['en:cheeses'], keywords: ['fromage', 'emmental', 'comte', 'gruyere', 'cheddar', 'raclette', 'camembert', 'brie', 'reblochon'] },
  { key: 'mozzarella', name: 'Mozzarella', offTags: ['en:mozzarella'], keywords: ['mozzarella', 'mozza'] },
  { key: 'goat-cheese', name: 'Fromage de chèvre', offTags: ['en:goat-cheeses'], keywords: ['chevre', 'fromage de chevre', 'buche de chevre'] },
  { key: 'feta', name: 'Feta', offTags: ['en:feta'], keywords: ['feta'] },
  { key: 'parmesan', name: 'Parmesan', offTags: ['en:parmigiano-reggiano', 'en:grana-padano'], keywords: ['parmesan', 'grana padano'] },

  // ---------- Viandes et poissons ----------
  { key: 'poultry', name: 'Poulet ou dinde', offTags: ['en:poultries', 'en:chickens', 'en:chicken-breasts', 'en:turkeys'], keywords: ['poulet', 'blanc de poulet', 'escalope de poulet', 'cuisse de poulet', 'cuisses de poulet', 'dinde', 'escalope de dinde'] },
  { key: 'minced-meat', name: 'Viande hachée', offTags: ['en:ground-meats', 'en:ground-beef', 'en:minced-meats'], keywords: ['viande hachee', 'steak hache', 'steaks haches', 'boeuf hache'] },
  { key: 'ham', name: 'Jambon', offTags: ['en:hams', 'en:white-hams', 'en:cooked-hams'], keywords: ['jambon', 'jambon blanc', 'jambon cru'] },
  { key: 'bacon', name: 'Lardons', offTags: ['en:lardons', 'en:bacon'], keywords: ['lardon', 'lardons', 'bacon', 'poitrine fumee'] },
  { key: 'sausage', name: 'Saucisses', offTags: ['en:sausages'], keywords: ['saucisse', 'saucisses', 'chipolata', 'chipolatas', 'merguez', 'knacki'] },
  { key: 'salmon', name: 'Saumon', offTags: ['en:salmons', 'en:smoked-salmons'], keywords: ['saumon', 'saumon fume', 'pave de saumon'] },
  { key: 'tuna', name: 'Thon', offTags: ['en:tunas', 'en:canned-tunas'], keywords: ['thon'] },
  { key: 'white-fish', name: 'Poisson blanc', offTags: ['en:cods', 'en:white-fishes'], keywords: ['cabillaud', 'colin', 'merlu', 'lieu', 'poisson blanc'] },
  { key: 'shrimp', name: 'Crevettes', offTags: ['en:shrimps', 'en:prawns'], keywords: ['crevette', 'crevettes', 'gambas'] },

  // ---------- Légumes ----------
  { key: 'tomato', name: 'Tomates', offTags: ['en:tomatoes', 'en:cherry-tomatoes'], keywords: ['tomate', 'tomates', 'tomate cerise', 'tomates cerises'] },
  { key: 'tomato-sauce', name: 'Sauce tomate', offTags: ['en:tomato-sauces', 'en:canned-tomatoes', 'en:crushed-tomatoes', 'en:tomato-purees'], keywords: ['sauce tomate', 'coulis', 'coulis de tomate', 'tomates concassees', 'pulpe de tomate', 'passata', 'concentre de tomate'] },
  { key: 'zucchini', name: 'Courgettes', offTags: ['en:zucchinis', 'en:courgettes'], keywords: ['courgette', 'courgettes'] },
  { key: 'eggplant', name: 'Aubergine', offTags: ['en:eggplants', 'en:aubergines'], keywords: ['aubergine', 'aubergines'] },
  { key: 'bell-pepper', name: 'Poivron', offTags: ['en:bell-peppers', 'en:sweet-peppers'], keywords: ['poivron', 'poivrons'] },
  { key: 'carrot', name: 'Carottes', offTags: ['en:carrots'], keywords: ['carotte', 'carottes'] },
  { key: 'potato', name: 'Pommes de terre', offTags: ['en:potatoes'], keywords: ['pomme de terre', 'pommes de terre', 'patate', 'patates'] },
  { key: 'leek', name: 'Poireaux', offTags: ['en:leeks'], keywords: ['poireau', 'poireaux'] },
  { key: 'mushroom', name: 'Champignons', offTags: ['en:mushrooms', 'en:button-mushrooms'], keywords: ['champignon', 'champignons', 'champignons de paris'] },
  { key: 'spinach', name: 'Épinards', offTags: ['en:spinachs', 'en:spinach'], keywords: ['epinard', 'epinards', 'pousses d epinard'] },
  { key: 'salad', name: 'Salade verte', offTags: ['en:salads', 'en:lettuces'], keywords: ['salade', 'laitue', 'mache', 'roquette', 'mesclun', 'batavia'] },
  { key: 'cucumber', name: 'Concombre', offTags: ['en:cucumbers'], keywords: ['concombre', 'concombres'] },
  { key: 'broccoli', name: 'Brocoli', offTags: ['en:broccoli'], keywords: ['brocoli', 'brocolis'] },
  { key: 'cauliflower', name: 'Chou-fleur', offTags: ['en:cauliflowers'], keywords: ['chou fleur', 'choux fleurs'] },
  { key: 'green-beans', name: 'Haricots verts', offTags: ['en:green-beans'], keywords: ['haricot vert', 'haricots verts'] },
  { key: 'peas', name: 'Petits pois', offTags: ['en:peas', 'en:garden-peas'], keywords: ['petit pois', 'petits pois'] },
  { key: 'squash', name: 'Courge', offTags: ['en:squashes', 'en:pumpkins'], keywords: ['courge', 'potiron', 'butternut', 'potimarron', 'citrouille'] },
  { key: 'avocado', name: 'Avocat', offTags: ['en:avocados'], keywords: ['avocat', 'avocats'] },
  { key: 'corn', name: 'Maïs', offTags: ['en:sweet-corns'], keywords: ['mais', 'mais doux'] },

  // ---------- Fruits ----------
  { key: 'lemon', name: 'Citron', offTags: ['en:lemons'], keywords: ['citron', 'citrons', 'jus de citron'] },
  { key: 'apple', name: 'Pommes', offTags: ['en:apples'], keywords: ['pomme', 'pommes'] },
  { key: 'banana', name: 'Bananes', offTags: ['en:bananas'], keywords: ['banane', 'bananes'] },
  { key: 'pear', name: 'Poires', offTags: ['en:pears'], keywords: ['poire', 'poires'] },
  { key: 'red-fruits', name: 'Fruits rouges', offTags: ['en:strawberries', 'en:raspberries', 'en:blueberries'], keywords: ['fruits rouges', 'fraise', 'fraises', 'framboise', 'framboises', 'myrtille', 'myrtilles'] },

  // ---------- Féculents et épicerie ----------
  { key: 'pasta', name: 'Pâtes', offTags: ['en:pastas', 'en:dry-pastas', 'en:fresh-pastas', 'en:spaghetti'], keywords: ['pates', 'spaghetti', 'spaghettis', 'penne', 'tagliatelle', 'tagliatelles', 'coquillettes', 'fusilli', 'macaroni', 'farfalle'] },
  { key: 'rice', name: 'Riz', offTags: ['en:rices'], keywords: ['riz', 'riz basmati', 'riz thai', 'riz rond'] },
  { key: 'bread', name: 'Pain', offTags: ['en:breads'], keywords: ['pain', 'baguette', 'pain de campagne'] },
  { key: 'sandwich-bread', name: 'Pain de mie', offTags: ['en:sandwich-breads', 'en:sliced-breads'], keywords: ['pain de mie'] },
  { key: 'pastry', name: 'Pâte à tarte', offTags: ['en:puff-pastries', 'en:shortcrust-pastries', 'en:pie-doughs'], keywords: ['pate brisee', 'pate feuilletee', 'pate sablee', 'pate a tarte'] },
  { key: 'tortilla', name: 'Tortillas', offTags: ['en:tortillas', 'en:wraps'], keywords: ['tortilla', 'tortillas', 'wrap', 'wraps'] },
  { key: 'coconut-milk', name: 'Lait de coco', offTags: ['en:coconut-milks'], keywords: ['lait de coco', 'creme de coco'] },
  { key: 'chickpeas', name: 'Pois chiches', offTags: ['en:chickpeas'], keywords: ['pois chiche', 'pois chiches'] },
  { key: 'lentils', name: 'Lentilles', offTags: ['en:lentils'], keywords: ['lentille', 'lentilles', 'lentilles corail'] },
  { key: 'oats', name: "Flocons d'avoine", offTags: ['en:oat-flakes', 'en:rolled-oats'], keywords: ['flocons d avoine', 'avoine'] },
  { key: 'chocolate', name: 'Chocolat', offTags: ['en:chocolates', 'en:dark-chocolates'], keywords: ['chocolat', 'chocolat noir', 'pepites de chocolat'] },
];
