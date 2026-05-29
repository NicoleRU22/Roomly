import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';

// Layouts
import { AuthLayout } from './components/layout/AuthLayout';
import { DashboardLayout } from './components/layout/DashboardLayout';

// Vistas / Páginas
import { Home } from './pages/Home';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { Dashboard } from './pages/dashboard/Dashboard';
import { Propiedades } from './pages/propiedades/Propiedades';
import { Rooms } from './pages/rooms/Rooms';
import { Inquilinos } from './pages/inquilinos/Inquilinos';
import { Servicios } from './pages/servicios/Servicios';
import { Pagos } from './pages/pagos/Pagos';
import { Contratos } from './pages/contratos/Contratos';

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
