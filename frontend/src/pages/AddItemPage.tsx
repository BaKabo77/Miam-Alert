import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useHouseholdId } from '../auth/session';
import { ApiError } from '../lib/api';
import { createPantryItem, type NewPantryItem, type PantryItem } from '../pantry/pantry-api';
import { todayPlusDays, todayPlusMonths } from '../pantry/dates';

// Raccourcis de date : l'utilisateur saisit la péremption en un clic dans la plupart des cas.
const DATE_SHORTCUTS = [
  { label: '+3 j', value: () => todayPlusDays(3) },
  { label: '+1 sem', value: () => todayPlusDays(7) },
  { label: '+1 mois', value: () => todayPlusMonths(1) },
];

const EXPIRY_TYPES: { value: PantryItem['expiryType']; hint: string }[] = [
  { value: 'DLC', hint: "À consommer jusqu'au" },
  { value: 'DDM', hint: 'De préférence avant' },
];

// Produit trouvé par le scan (page /scan), transmis à ce formulaire pour le pré-remplir.
export interface ScannedProduct {
  id: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
}

export function AddItemPage() {
  const householdId = useHouseholdId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const scanned = (useLocation().state as { product?: ScannedProduct } | null)?.product;

  // Formulaire « contrôlé » : chaque champ est lié à un state, que React tient à jour à chaque frappe.
  const [name, setName] = useState(scanned?.name ?? '');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState<PantryItem['unit']>('PIECE');
  const [expiryType, setExpiryType] = useState<PantryItem['expiryType']>('DLC');
  const [expiryDate, setExpiryDate] = useState(todayPlusDays(3));

  const create = useMutation({
    mutationFn: (item: NewPantryItem) => createPantryItem(householdId, item),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pantry-items'] });
      navigate('/');
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.mutate({
      name,
      quantity,
      unit,
      expiryDate,
      expiryType,
      // Lien vers la fiche produit seulement si l'article vient d'un scan.
      productId: scanned?.id,
    });
  }

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Ajouter un produit</h1>
        <p className="text-sm text-ink-500">Le code-barres ne contient pas la date : indiquez-la ici.</p>
      </div>

      {scanned && (
        <div className="card mb-4 flex items-center gap-3 p-3">
          {/* Image servie par Open Food Facts : l'API n'accepte que des URL https de leur domaine. */}
          {scanned.imageUrl && (
            <img
              src={scanned.imageUrl}
              alt=""
              className="h-16 w-16 rounded-xl bg-card object-contain ring-1 ring-brand-900/10"
            />
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Produit scanné</p>
            <p className="truncate font-semibold">{scanned.name}</p>
            {scanned.brand && <p className="text-sm text-ink-500">{scanned.brand}</p>}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-5 p-5">
        <label className="block">
          <span className="label">Nom</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={200}
            placeholder="Ex. : Yaourts nature"
            className="input"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Quantité</span>
            <input
              type="number"
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
              required
              min={1}
              max={1_000_000}
              step={1}
              className="input"
            />
          </label>
          <label className="block">
            <span className="label">Unité</span>
            <select
              value={unit}
              onChange={(event) => setUnit(event.target.value as PantryItem['unit'])}
              className="input"
            >
              <option value="PIECE">pièce(s)</option>
              <option value="GRAM">grammes</option>
              <option value="MILLILITER">millilitres</option>
            </select>
          </label>
        </div>

        <fieldset>
          <legend className="label">Type de date</legend>
          {/* Deux boutons radio présentés comme un sélecteur : has-checked colore l'option choisie. */}
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-brand-900/8 p-1">
            {EXPIRY_TYPES.map((option) => (
              <label
                key={option.value}
                className="cursor-pointer rounded-lg px-3 py-2 text-center transition has-checked:bg-card has-checked:shadow-sm has-focus-visible:outline-2 has-focus-visible:outline-brand-600"
              >
                <input
                  type="radio"
                  name="expiryType"
                  value={option.value}
                  checked={expiryType === option.value}
                  onChange={() => setExpiryType(option.value)}
                  className="sr-only"
                />
                <span className="block text-sm font-semibold">{option.value}</span>
                <span className="block text-[11px] text-ink-500">{option.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label className="block">
            <span className="label">Date</span>
            <input
              type="date"
              value={expiryDate}
              onChange={(event) => setExpiryDate(event.target.value)}
              required
              className="input"
            />
          </label>
          <div className="mt-2 flex gap-2">
            {DATE_SHORTCUTS.map((shortcut) => (
              <button
                key={shortcut.label}
                type="button"
                onClick={() => setExpiryDate(shortcut.value())}
                className="chip"
              >
                {shortcut.label}
              </button>
            ))}
          </div>
        </div>

        {create.isError && (
          <p role="alert" className="alert-error">
            {errorMessage(create.error)}
          </p>
        )}

        <button type="submit" disabled={create.isPending} className="btn-primary w-full">
          {create.isPending ? 'Ajout…' : "Ajouter à l'inventaire"}
        </button>
      </form>
    </>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 400) {
    return 'Vérifiez les champs : nom, quantité entière positive et date valide.';
  }
  return "L'ajout n'a pas pu être enregistré. Réessayez.";
}
