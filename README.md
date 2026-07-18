# Roomly - Sistema de Gestión de Propiedades

Roomly es una aplicación full-stack para la gestión de propiedades, inquilinos, pagos, contratos y tickets de mantenimiento. Está construida como un monorepo que incluye un backend en Node.js/Express y un frontend en React/Vite.

## 🏗️ Arquitectura

Este proyecto utiliza una arquitectura de monorepo con las siguientes carpetas principales:

- **backend/** - API REST construida con Express, TypeScript y Prisma
- **frontend/** - Aplicación React construida con Vite, TypeScript y TailwindCSS

## 🚀 Características

### Backend
- API RESTful con Express 5
- Autenticación con JWT
- Base de datos PostgreSQL con Prisma ORM
- Multi-tenant (soporte para múltiples empresas/organizaciones)
- Seguridad con Helmet y CORS configurado
- Gestión de:
  - Usuarios y autenticación
  - Propiedades y habitaciones
  - Inquilinos
  - Pagos
  - Servicios
  - Contratos
  - Tickets de mantenimiento

### Frontend
- React 19 con Vite
- TypeScript para tipado estático
- TailwindCSS para estilos
- Componentes UI con Radix UI y shadcn
- Gestión de estado con Zustand
- Enrutamiento con React Router DOM
- Validación de formularios
- Diseño responsivo

## 📋 Requisitos Previos

- Node.js 18+ 
- pnpm (gestor de paquetes)
- PostgreSQL 14+
- Git

## 🛠️ Instalación

### 1. Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd roomly-monorepo
```

### 2. Instalar dependencias

```bash
pnpm install
```

### 3. Configurar variables de entorno

#### Backend (.env)

Crea un archivo `.env` en la carpeta `backend/`:

```env
# Base de datos y app
DATABASE_URL="postgresql://usuario:password@localhost:5432/roomly?schema=public"
PORT=3000
JWT_SECRET="tu-secreto-jwt"
CORS_ORIGIN="http://localhost:5173,http://localhost:5174"
JSON_BODY_LIMIT="10mb"
FRONTEND_URL="http://localhost:5173"

# Cloudinary (imágenes: firmas, comprobantes, fotos de tickets y propiedades)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Mailjet (correos transaccionales: verificación, reset de contraseña, notificaciones)
MAILJET_API_KEY=
MAILJET_SECRET_KEY=
EMAIL_FROM="roomly.company@gmail.com"
EMAIL_FROM_NAME="Roomly"

# Google Sign-In (login/registro con cuenta de Google)
GOOGLE_CLIENT_ID=

# Culqi (pasarela de pagos con tarjeta, Perú)
CULQI_ENVIRONMENT="integration" # o "production"
CULQI_INTEGRATION_PUBLIC_KEY=
CULQI_INTEGRATION_PRIVATE_KEY=
CULQI_PRODUCTION_PUBLIC_KEY=
CULQI_PRODUCTION_PRIVATE_KEY=

# API Perú (consulta de DNI para autocompletar datos del inquilino)
APIPERU_TOKEN=
APIPERU_BASE_URL="https://apiperu.dev"
```

Ver la sección [🔌 APIs y Servicios Externos](#-apis-y-servicios-externos) para el detalle de cada integración y dónde obtener sus credenciales.

#### Frontend (.env)

Crea un archivo `.env` en la carpeta `frontend/`:

```env
VITE_API_URL=http://localhost:3000/api
VITE_GOOGLE_CLIENT_ID=
```

## 🔌 APIs y Servicios Externos

Roomly integra los siguientes servicios de terceros. Ninguna clave real vive en este README ni en el repositorio — cada una se configura vía variables de entorno (ver arriba).

| Servicio | Para qué se usa | Variables |
|---|---|---|
| **[Cloudinary](https://cloudinary.com/)** | Almacenamiento de imágenes: firmas de contrato, comprobantes de pago (Yape/transferencia), fotos de tickets de mantenimiento y fotos de propiedades/habitaciones. | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| **[Culqi](https://culqi.com/)** | Pasarela de pagos con tarjeta (mercado peruano) para que el inquilino pague su recibo de alquiler online desde la app. | `CULQI_ENVIRONMENT`, `CULQI_INTEGRATION_*`, `CULQI_PRODUCTION_*` |
| **[Mailjet](https://www.mailjet.com/)** | Envío de correos transaccionales: verificación de cuenta, restablecimiento de contraseña, aviso de cambio de contraseña. | `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME` |
| **[Google Identity (OAuth)](https://developers.google.com/identity)** | Inicio de sesión y registro con cuenta de Google, tanto en backend (verificación del token) como en frontend (botón de Google). | `GOOGLE_CLIENT_ID` (backend), `VITE_GOOGLE_CLIENT_ID` (frontend) |
| **[API Perú](https://apiperu.dev/)** | Consulta de DNI para autocompletar el nombre del inquilino al registrarlo, a partir de su documento de identidad. | `APIPERU_TOKEN`, `APIPERU_BASE_URL` |
| **PostgreSQL** | Base de datos principal de la aplicación (vía Prisma ORM). No es una API de terceros, pero requiere su propia cadena de conexión. | `DATABASE_URL` |

Todas estas integraciones son opcionales en desarrollo local en el sentido de que la app arranca sin ellas configuradas, pero la funcionalidad correspondiente queda deshabilitada o solo simulada en consola (por ejemplo, sin credenciales de Mailjet los correos se imprimen en el log del backend en vez de enviarse).

### 4. Configurar la base de datos

```bash
# Generar el cliente de Prisma
pnpm backend:generate

# Ejecutar migraciones
pnpm backend:migrate

# (Opcional) Seedear la base de datos con datos de prueba
cd backend
npx ts-node src/seed-buildings.ts
```

## 🏃‍♂️ Desarrollo

### Iniciar ambos servicios (backend y frontend)

```bash
pnpm dev
```

### Iniciar solo el backend

```bash
pnpm --filter backend dev
```

### Iniciar solo el frontend

```bash
pnpm --filter frontend dev
```

## 🧪 Tests

El backend usa [Vitest](https://vitest.dev) con mocks type-safe de Prisma (`vitest-mock-extended`), sin necesidad de una base de datos real.

```bash
pnpm --filter backend test            # correr toda la suite una vez
pnpm --filter backend test:watch      # modo watch mientras desarrollas
pnpm --filter backend test:coverage   # con reporte de cobertura (texto + HTML en backend/coverage)
```

Convenciones:
- Los tests viven junto al código que prueban (`archivo.ts` → `archivo.test.ts`).
- `src/test-utils/prisma-mock.ts` expone `prismaMock` (mock profundo de `PrismaClient`) y `resetPrismaMock()`; mockea `../../core/db/prisma` con `vi.mock` en cada archivo de test para aislar la base de datos.
- `src/test-utils/express-mocks.ts` expone `mockRequest`/`mockResponse` para probar controladores sin levantar Express.
- Cobertura actual: mora y facturación recurrente de pagos (`recurring.service.ts`, `payment.controller.ts`), vencimiento automático de contratos (`contract-expiration.service.ts`), autenticación (`auth.controller.ts`), tickets de mantenimiento y su SLA (`maintenance.controller.ts`), preferencias de notificación (`notification.service.ts`) y utilidades compartidas (`pagination.ts`, `csv.ts`). Propiedades, inquilinos, mensajes, admin y servicios todavía no tienen tests — son el siguiente objetivo a cubrir.

### CI

El workflow [`.github/workflows/backend-tests.yml`](.github/workflows/backend-tests.yml) corre la suite de tests del backend automáticamente en cada push y pull request contra `main` (instala dependencias, genera el cliente de Prisma y ejecuta `pnpm --filter backend test`). No requiere una base de datos real porque los tests mockean Prisma. El frontend todavía no tiene tests ni un job de lint en CI (el linter actual reporta errores preexistentes que están fuera del alcance de este cambio).

## 📦 Build de Producción

### Construir todos los servicios

```bash
pnpm build
```

### Construir solo el backend

```bash
pnpm --filter backend build
```

### Construir solo el frontend

```bash
pnpm --filter frontend build
```

## 📁 Estructura del Proyecto

```
roomly-monorepo/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # Esquema de base de datos
│   │   └── migrations/        # Migraciones de Prisma
│   ├── src/
│   │   ├── core/              # Módulos base (auth, config, etc.)
│   │   ├── features/          # Módulos de funcionalidad
│   │   │   ├── auth/          # Autenticación
│   │   │   ├── propiedades/   # Gestión de propiedades
│   │   │   ├── inquilinos/    # Gestión de inquilinos
│   │   │   ├── pagos/         # Gestión de pagos
│   │   │   ├── servicios/     # Gestión de servicios
│   │   │   ├── contratos/     # Gestión de contratos
│   │   │   └── mantenimiento/ # Tickets de mantenimiento
│   │   └── index.ts           # Punto de entrada
│   ├── .env.production
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── public/                # Archivos estáticos
│   ├── src/
│   │   ├── assets/            # Recursos (imágenes, iconos)
│   │   ├── core/              # Componentes y utilidades base
│   │   ├── features/          # Módulos de funcionalidad
│   │   ├── App.tsx            # Componente principal
│   │   └── main.tsx           # Punto de entrada
│   ├── .env.production
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── package.json               # Configuración del monorepo
├── pnpm-workspace.yaml        # Configuración de workspaces
└── README.md
```

## 🔧 Scripts Disponibles

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Inicia ambos servicios en modo desarrollo |
| `pnpm build` | Construye ambos servicios para producción |
| `pnpm backend:generate` | Genera el cliente de Prisma |
| `pnpm backend:migrate` | Ejecuta migraciones de Prisma |

## 🔐 Seguridad

- Autenticación basada en JWT
- Protección de rutas con middleware de autenticación
- Helmet para cabeceras de seguridad HTTP
- CORS configurado con lista blanca de orígenes
- Validación y sanitización de entradas
- Hash de contraseñas con bcryptjs

## 📝 Tecnologías

### Backend
- **Runtime:** Node.js
- **Framework:** Express 5
- **Lenguaje:** TypeScript
- **ORM:** Prisma
- **Base de datos:** PostgreSQL
- **Autenticación:** JSON Web Tokens (JWT)
- **Hash:** bcryptjs

### Frontend
- **Framework:** React 19
- **Build tool:** Vite
- **Lenguaje:** TypeScript
- **Estilos:** TailwindCSS 4
- **Componentes UI:** Radix UI, shadcn
- **Estado:** Zustand
- **Enrutamiento:** React Router DOM
- **HTTP Client:** Axios

## 🤝 Contribución

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la licencia ISC.

## 👥 Equipo

Desarrollado por el equipo de Roomly.

## 📞 Soporte

Para soporte, envía un correo a support@roomly.com o abre un issue en el repositorio.
