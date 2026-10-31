import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { RequireAuth } from './auth/session';
import { AppLayout } from './components/AppLayout';
import { AddItemPage } from './pages/AddItemPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { InventoryPage } from './pages/InventoryPage';
import { LegalNoticePage } from './pages/LegalNoticePage';
import { LoginPage } from './pages/LoginPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { ProfilePage } from './pages/ProfilePage';
import { RecipePage } from './pages/RecipePage';
import { RecipesPage } from './pages/RecipesPage';
import { RegisterPage } from './pages/RegisterPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { TermsPage } from './pages/TermsPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';

// Page de scan chargée à la demande : la bibliothèque de lecture de codes-barres est lourde,
// inutile de la faire télécharger à ceux qui ne scannent pas (connexion, inventaire...).
const ScanPage = lazy(() => import('./pages/ScanPage').then((module) => ({ default: module.ScanPage })));

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      {/* Pages légales : publiques, car elles doivent être consultables avant de créer un compte. */}
      <Route path="/legal" element={<LegalNoticePage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      {/* Publique : le lien de l'email peut être ouvert sur un appareil où l'on n'est pas connecté. */}
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      {/* Publiques : on a perdu son mot de passe, on ne peut donc pas être connecté. */}
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      {/* Toutes les routes placées ici exigent d'être connecté, et partagent la même barre de navigation. */}
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<InventoryPage />} />
          <Route path="/add" element={<AddItemPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/recipes" element={<RecipesPage />} />
          <Route path="/recipes/:recipeId" element={<RecipePage />} />
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
