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
      <h1 className="mb-4 text-2xl font-bold">Ajouter un produit</h1>

      {scanned && (
        <div className="mb-4 flex items-center gap-3 rounded bg-white p-3 shadow-sm">
          {/* Image servie par Open Food Facts : l'API n'accepte que des URL https de leur domaine. */}
          {scanned.imageUrl && (
            <img src={scanned.imageUrl} alt="" className="h-16 w-16 rounded object-contain" />
          )}
          <div>
            <p className="font-medium">{scanned.name}</p>
            {scanned.brand && <p className="text-sm text-gray-600">{scanned.brand}</p>}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 rounded bg-white p-4 shadow-sm">
        <label className="block">
          <span className="text-sm text-gray-700">Nom</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={200}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>

        <div className="flex gap-3">
          <label className="block flex-1">
            <span className="text-sm text-gray-700">Quantité</span>
            <input
              type="number"
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
              required
              min={1}
              max={1_000_000}
              step={1}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="block flex-1">
            <span className="text-sm text-gray-700">Unité</span>
            <select
              value={unit}
              onChange={(event) => setUnit(event.target.value as PantryItem['unit'])}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="PIECE">pièce(s)</option>
              <option value="GRAM">grammes</option>
              <option value="MILLILITER">millilitres</option>
            </select>
          </label>
        </div>

        <fieldset>
          <legend className="text-sm text-gray-700">Type de date</legend>
          <div className="mt-1 flex gap-4">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="expiryType"
                checked={expiryType === 'DLC'}
                onChange={() => setExpiryType('DLC')}
              />
              DLC <span className="text-xs text-gray-500">(à consommer jusqu'au)</span>
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="expiryType"
                checked={expiryType === 'DDM'}
                onChange={() => setExpiryType('DDM')}
              />
              DDM <span className="text-xs text-gray-500">(de préférence avant)</span>
            </label>
          </div>
        </fieldset>

        <div>
          <label className="block">
            <span className="text-sm text-gray-700">Date</span>
            <input
              type="date"
              value={expiryDate}
              onChange={(event) => setExpiryDate(event.target.value)}
              required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <div className="mt-2 flex gap-2">
            {DATE_SHORTCUTS.map((shortcut) => (
              <button
                key={shortcut.label}
                type="button"
                onClick={() => setExpiryDate(shortcut.value())}
                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
              >
                {shortcut.label}
              </button>
            ))}
          </div>
        </div>

        {create.isError && (
          <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage(create.error)}
          </p>
        )}

        <button
          type="submit"
          disabled={create.isPending}
          className="w-full rounded bg-green-700 px-3 py-2 font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
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
