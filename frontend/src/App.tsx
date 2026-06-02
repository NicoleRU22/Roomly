import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './features/auth/store/useAuthStore';

// Layouts
import { AuthLayout } from './core/components/layout/AuthLayout';
import { DashboardLayout } from './core/components/layout/DashboardLayout';

// Vistas / Páginas
import { Home } from './features/home/pages/Home';
import { Login } from './features/auth/pages/Login';
import { Register } from './features/auth/pages/Register';
import { Dashboard } from './features/dashboard/pages/Dashboard';
import { Propiedades } from './features/propiedades/pages/Propiedades';
import { Rooms } from './features/propiedades/pages/Rooms';
import { Inquilinos } from './features/inquilinos/pages/Inquilinos';
import { Servicios } from './features/servicios/pages/Servicios';
import { Pagos } from './features/pagos/pages/Pagos';
import { Contratos } from './features/contratos/pages/Contratos';

// Componente para Proteger Rutas
const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const token = useAuthStore(state => state.token);
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Página de Inicio (Landing) */}
        <Route path="/" element={<Home />} />

        {/* Rutas Públicas de Acceso (AuthLayout) */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        {/* Rutas Privadas del Panel (DashboardLayout) */}
        <Route
          path="/:tenant"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="propiedades" element={<Propiedades />} />
          <Route path="propiedades/:id" element={<Rooms />} />
          <Route path="inquilinos" element={<Inquilinos />} />
          <Route path="servicios" element={<Servicios />} />
          <Route path="pagos" element={<Pagos />} />
          <Route path="contratos" element={<Contratos />} />
          
          {/* Redirección por defecto dentro del tenant */}
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>

        {/* Redirección por defecto global */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
