import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { RequireAuth } from './auth/session';
import { AppLayout } from './components/AppLayout';
import { AddItemPage } from './pages/AddItemPage';
import { InventoryPage } from './pages/InventoryPage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { RegisterPage } from './pages/RegisterPage';

// Page de scan chargée à la demande : la bibliothèque de lecture de codes-barres est lourde,
// inutile de la faire télécharger à ceux qui ne scannent pas (connexion, inventaire...).
const ScanPage = lazy(() => import('./pages/ScanPage').then((module) => ({ default: module.ScanPage })));

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      {/* Toutes les routes placées ici exigent d'être connecté, et partagent la même barre de navigation. */}
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<InventoryPage />} />
          <Route path="/add" element={<AddItemPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route
            path="/scan"
            element={
              <Suspense fallback={<p className="text-gray-500">Chargement du scanner…</p>}>
                <ScanPage />
              </Suspense>
            }
          />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
