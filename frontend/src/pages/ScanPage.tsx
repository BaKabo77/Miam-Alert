import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { trackEvent } from '../lib/analytics';
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
      trackEvent('product-scanned');
      const scanned: ScannedProduct = {
        id: product.id,
        name: product.name,
        brand: product.brand,
        imageUrl: product.imageUrl,
        suggestedExpiry: product.suggestedExpiry,
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
      <div className="mb-6">
        <h1 className="page-title">Scanner un produit</h1>
        <p className="page-subtitle">Visez le code-barres : la fiche du produit se remplit toute seule.</p>
      </div>

      {lookup.isIdle && <BarcodeScanner key={scanAttempt} onDetected={(barcode) => lookup.mutate(barcode)} />}

      {lookup.isPending && (
        <div className="card flex items-center gap-3 p-5">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-mist border-t-brand" />
          <p className="font-semibold">Recherche du produit…</p>
        </div>
      )}

      {lookup.isError && (
        <div role="alert" className="space-y-4 rounded-3xl bg-sun-100 p-5">
          <p className="text-[15px] font-medium text-sun-800">{errorMessage(lookup.error)}</p>
          <div className="flex gap-2">
            <button type="button" onClick={scanAgain} className="btn-secondary flex-1">
              Scanner un autre produit
            </button>
            <Link to="/add" className="btn-primary flex-1">
              Saisir à la main
            </Link>
          </div>
        </div>
      )}

      {/* Secours : caméra indisponible, code abîmé... La validation EAN complète est faite par l'API. */}
      <form onSubmit={handleManualSubmit} className="mt-6">
        <label className="label" htmlFor="manual-barcode">
          Ou tapez le code-barres
        </label>
        <div className="flex gap-2">
          <input
            id="manual-barcode"
            value={manualBarcode}
            onChange={(event) => setManualBarcode(event.target.value)}
            inputMode="numeric"
            pattern="\d{8}|\d{13}"
            placeholder="8 ou 13 chiffres"
            required
            className="input"
          />
          <button type="submit" disabled={lookup.isPending} className="btn-primary">
            Chercher
          </button>
        </div>
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
