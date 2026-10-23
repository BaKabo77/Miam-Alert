import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiError } from '../lib/api';
import { BarcodeScanner } from '../products/BarcodeScanner';
import { fetchProduct } from '../products/product-api';
import type { ScannedProduct } from './AddItemPage';

export function ScanPage() {
  const navigate = useNavigate();
  const [manualBarcode, setManualBarcode] = useState('');
  // Change de valeur pour relancer un scanner neuf après un échec.
  const [scanAttempt, setScanAttempt] = useState(0);

  const lookup = useMutation({
    mutationFn: fetchProduct,
    // Produit trouvé : on passe au formulaire d'ajout, pré-rempli avec la fiche.
    onSuccess: (product) => {
      const scanned: ScannedProduct = {
        id: product.id,
        name: product.name,
        brand: product.brand,
        imageUrl: product.imageUrl,
      };
      navigate('/add', { state: { product: scanned } });
    },
  });

  function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    lookup.mutate(manualBarcode.trim());
  }

  function scanAgain() {
    lookup.reset();
    setScanAttempt((attempt) => attempt + 1);
  }

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Scanner un produit</h1>

      {lookup.isIdle && <BarcodeScanner key={scanAttempt} onDetected={(barcode) => lookup.mutate(barcode)} />}

      {lookup.isPending && <p className="text-gray-500">Recherche du produit…</p>}

      {lookup.isError && (
        <div role="alert" className="space-y-3 rounded bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-800">{errorMessage(lookup.error)}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={scanAgain}
              className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
            >
              Scanner un autre produit
            </button>
            <Link to="/add" className="rounded bg-green-700 px-3 py-1 text-sm text-white hover:bg-green-800">
              Saisir à la main
            </Link>
          </div>
        </div>
      )}

      {/* Secours : caméra indisponible, code abîmé... La validation EAN complète est faite par l'API. */}
      <form onSubmit={handleManualSubmit} className="mt-6 flex gap-2">
        <label className="flex-1">
          <span className="sr-only">Code-barres</span>
          <input
            value={manualBarcode}
            onChange={(event) => setManualBarcode(event.target.value)}
            inputMode="numeric"
            pattern="\d{8}|\d{13}"
            placeholder="Ou tapez le code-barres (8 ou 13 chiffres)"
            required
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={lookup.isPending}
          className="rounded bg-green-700 px-3 py-2 text-white hover:bg-green-800 disabled:opacity-50"
        >
          Chercher
        </button>
      </form>
    </>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) {
    return "Ce produit n'est pas encore connu d'Open Food Facts. Vous pouvez le saisir à la main.";
  }
  if (error instanceof ApiError && error.status === 400) {
    return "Ce code-barres n'est pas valide. Réessayez le scan ou saisissez-le à la main.";
  }
  if (error instanceof ApiError && error.status === 429) {
    return 'Trop de recherches en peu de temps. Patientez une minute.';
  }
  return 'La recherche de produit est indisponible pour le moment. Vous pouvez saisir le produit à la main.';
}
