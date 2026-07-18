import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './features/auth/store/useAuthStore';

// Layouts
import { AuthLayout } from './core/components/layout/AuthLayout';
import { DashboardLayout } from './core/components/layout/DashboardLayout';
import { AdminLayout } from './core/components/layout/AdminLayout';

// Vistas / Páginas
import { Home } from './features/home/pages/Home';
import { Login } from './features/auth/pages/Login';
import { Register } from './features/auth/pages/Register';
import { VerifyEmail } from './features/auth/pages/VerifyEmail';
import { ForgotPassword } from './features/auth/pages/ForgotPassword';
import { ResetPassword } from './features/auth/pages/ResetPassword';
import { Dashboard } from './features/dashboard/pages/Dashboard';
import { Propiedades } from './features/propiedades/pages/Propiedades';
import { Rooms } from './features/propiedades/pages/Rooms';
import { Inquilinos } from './features/inquilinos/pages/Inquilinos';
import { Servicios } from './features/servicios/pages/Servicios';
import { Pagos } from './features/pagos/pages/Pagos';
import { Contratos } from './features/contratos/pages/Contratos';
import { Mantenimiento } from './features/mantenimiento/pages/Mantenimiento';
import { Mensajes } from './features/mensajes/pages/Mensajes';
import { Perfil } from './features/perfil/pages/Perfil';
import { Configuracion } from './features/configuracion/pages/Configuracion';
import { AdminOverview } from './features/admin/pages/AdminOverview';
import { AdminTenants } from './features/admin/pages/AdminTenants';
import { AdminUsuarios } from './features/admin/pages/AdminUsuarios';
import { AdminAuditoria } from './features/admin/pages/AdminAuditoria';
import { AdminAlertas } from './features/admin/pages/AdminAlertas';
import { AdminSesiones } from './features/admin/pages/AdminSesiones';
import { AdminSalud } from './features/admin/pages/AdminSalud';

// Componente para Proteger Rutas
const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const token = useAuthStore(state => state.token);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Solo accesible por el rol ADMIN (superadmin de plataforma, sin tenant propio)
const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (user?.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
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
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Route>

        {/* Panel de administración de plataforma (rol ADMIN) */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route path="dashboard" element={<AdminOverview />} />
          <Route path="tenants" element={<AdminTenants />} />
          <Route path="usuarios" element={<AdminUsuarios />} />
          <Route path="auditoria" element={<AdminAuditoria />} />
          <Route path="alertas" element={<AdminAlertas />} />
          <Route path="sesiones" element={<AdminSesiones />} />
          <Route path="salud" element={<AdminSalud />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
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
          <Route path="mantenimiento" element={<Mantenimiento />} />
          <Route path="mensajes" element={<Mensajes />} />
          <Route path="perfil" element={<Perfil />} />
          <Route path="configuracion" element={<Configuracion />} />
          
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
