import { Navigate, Route, Routes } from 'react-router';
import { RequireAuth } from './auth/session';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { InventoryPage } from './pages/InventoryPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      {/* Toutes les routes placées ici exigent d'être connecté. */}
      <Route element={<RequireAuth />}>
      <Route path="/" element={<InventoryPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
