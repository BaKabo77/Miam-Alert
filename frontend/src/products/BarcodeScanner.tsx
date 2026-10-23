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

    const hints = new Map<DecodeHintType, unknown>([
      // On ne cherche que les formats des produits alimentaires : moins de fausses lectures.
      [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8]],
      // Analyse plus poussée de chaque image : un peu plus lente, mais lit les codes flous
      // ou petits que filment les webcams d'ordinateur (mise au point approximative de près).
      [DecodeHintType.TRY_HARDER, true],
    ]);
    // Une analyse toutes les 100 ms au lieu de 500 : chaque image d'une webcam est un peu différente
    // (bruit, léger mouvement), analyser plus souvent multiplie les chances de tomber sur une image nette.
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 100 });

    reader
      .decodeFromConstraints(
        {
          video: {
            facingMode: 'environment',
            // Sans précision, le navigateur filme souvent en 640x480 : les barres fines se confondent.
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        },
        video, (result, _error, scannerControls) => {
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

  return (
    <div>
      <div className="relative">
        <div ref={containerRef} />
        {/* Cadre de visée, purement visuel : aide à centrer le code-barres. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded border-2 border-white/80"
        />
      </div>
      <p className="mt-2 text-sm text-gray-600">
        Placez le code-barres dans le cadre, à l'horizontale et bien éclairé, à 15–20 cm : trop près, la caméra
        n'arrive pas à faire la mise au point.
      </p>
    </div>
  );
}
