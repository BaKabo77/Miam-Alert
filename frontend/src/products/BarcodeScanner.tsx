import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { useEffect, useRef, useState } from 'react';

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
}

// Affiche la caméra arrière et lit les codes-barres EAN-13 / EAN-8 (ceux des produits alimentaires).
export function BarcodeScanner({ onDetected }: BarcodeScannerProps) {
  // useRef : une référence vers un élément HTML réel, ici le cadre qui accueille la vidéo.
  const containerRef = useRef<HTMLDivElement>(null);
  // La dernière version de onDetected, sans relancer la caméra à chaque affichage.
  const onDetectedRef = useRef(onDetected);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  // Démarre la caméra à l'affichage du composant, et l'ÉTEINT quand il disparaît (fonction de nettoyage) :
  // sinon la caméra resterait allumée après avoir quitté la page.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    // Une <video> neuve à chaque démarrage : si un démarrage précédent s'arrête en retard,
    // il ne coupe que SA vidéo, pas celle du démarrage en cours.
    const video = document.createElement('video');
    video.muted = true; // muted + playsInline : nécessaires pour démarrer sur mobile (notamment iPhone)
    video.playsInline = true;
    video.className = 'aspect-video w-full rounded bg-black object-cover';
    container.appendChild(video);

    let controls: IScannerControls | undefined;
    let cancelled = false;

    // On ne cherche que les formats des produits alimentaires : plus rapide, moins de fausses lectures.
    const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8]]]);
    const reader = new BrowserMultiFormatReader(hints);

    reader
      .decodeFromConstraints({ video: { facingMode: 'environment' } }, video, (result, _error, scannerControls) => {
        if (result) {
          scannerControls.stop();
          onDetectedRef.current(result.getText());
        }
      })
      .then((started) => {
        controls = started;
        // Le composant a disparu pendant le démarrage : on éteint tout de suite.
        if (cancelled) {
          started.stop();
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setCameraError(
            error instanceof DOMException && error.name === 'NotAllowedError'
              ? "L'accès à la caméra a été refusé. Autorisez-le dans le navigateur, ou saisissez le code à la main."
              : 'Aucune caméra disponible. Saisissez le code à la main.',
          );
        }
      });

    return () => {
      cancelled = true;
      controls?.stop();
      video.remove();
    };
  }, []);

  if (cameraError) {
    return (
      <p role="alert" className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
        {cameraError}
      </p>
    );
  }

  return <div ref={containerRef} />;
}
