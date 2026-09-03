# Frontend — Brasas OS

Aplicación web para la operación de locales gastronómicos. El frontend está
implementado como una SPA con React y consume la API REST ubicada en
`apps/api`.

## Stack

- React 19
- Vite 8
- React Router 7
- Zustand 5 para estado global
- Axios para comunicación HTTP
- Tailwind CSS 4 y HeroUI para estilos y componentes
- Recharts para gráficos
- React Icons para iconografía

## Puesta en marcha

Requisitos: Node.js 18 o superior y una instancia del backend disponible.

```bash
cd apps/web
npm install
npm run dev
```

Comandos disponibles:

| Comando | Uso |
|---|---|
| `npm run dev` | Servidor de desarrollo con Vite |
| `npm run build` | Compilación de producción |
| `npm run preview` | Sirve localmente la compilación |
| `npm run lint` | Ejecuta ESLint |

### Configuración

Crear `apps/web/.env` cuando la API no use la URL predeterminada:

```env
VITE_API_URL=http://localhost:3000/api/v1
```

Las variables `VITE_*` se incorporan al bundle del navegador; no deben
contener secretos.

## Arquitectura

```text
apps/web/src/
├── App.jsx                  # Inicializa la sesión y monta el router
├── main.jsx                 # Punto de entrada de React y HeroUI
├── index.css                # Estilos globales
├── routes/router.jsx        # Rutas públicas y protegidas
├── layout/                  # Layout del panel y sidebar
├── services/api.js          # Cliente Axios e interceptores
├── lib/                     # Adaptadores y utilidades de librerías
└── features/
    ├── analytics/           # Gráficos, márgenes y proyecciones
    ├── auth/                # Login, registro y sesión
    ├── dashboard/           # KPIs y resumen operativo
    ├── history/             # Historial de acciones
    ├── inventory/           # Insumos y movimientos de stock
    ├── landing/             # Página pública
    ├── menu/                # Productos y categorías
    ├── orders/              # Pedidos y pagos
    └── users/               # Usuarios, empleados e invitaciones
```

Cada feature separa:

- `components/`: presentación y flujo de interacción.
- `services/`: llamadas a los endpoints de la API.
- `stores/`: estado y operaciones asíncronas de la feature.

## Arranque y navegación

`main.jsx` monta `HeroUIProvider` y `App`. Al iniciar, `App` ejecuta
`checkAuth()` para recuperar la sesión guardada y luego renderiza
`RouterProvider`.

El cliente Axios usa `VITE_API_URL` o `http://localhost:3000/api/v1` como
base. Inyecta el JWT guardado en `localStorage` en cada petición y, ante una
respuesta `401`, elimina la sesión y redirige a `/login`.

## Rutas de la aplicación

| Ruta | Acceso | Pantalla |
|---|---|---|
| `/` | Público | Landing |
| `/login`, `/register` | Público | Autenticación |
| `/dashboard` | `ADMIN`, `JEFE` | Dashboard |
| `/inventory` | `ADMIN`, `JEFE` | Inventario |
| `/menu` | `ADMIN`, `JEFE` | Menú |
| `/pedidos` | `ADMIN`, `JEFE` | Pedidos |
| `/analisis` | `ADMIN`, `JEFE` | Analítica |
| `/historial` | `ADMIN`, `JEFE` | Historial |
| `/jefe/equipo` | `JEFE`, `ADMIN` | Equipo del local |
| `/admin/usuarios` | `ADMIN` | Administración de usuarios |
| `/empleado/pedidos` | `EMPLEADO` | Pedidos del empleado |
| `/empleado/menu` | `EMPLEADO` | Menú en modo lectura |

`ProtectedRoute` valida autenticación y rol antes de renderizar
`DashboardLayout`. Las rutas públicas redirigen al dashboard si ya existe
una sesión.

## Estado global

Los stores Zustand principales son:

- `useAuthStore`: login, registro, logout, usuario y estado de sesión.
- `useDashboardStore`: período, KPIs, inventario, historial y productos
  destacados. Carga las secciones en paralelo.
- `useMenuStore`: productos y categorías.
- `useInventoryStore`: insumos y movimientos.
- `useOrdersStore`: pedidos y cambios de estado.
- `useHistoryStore`: filtros y paginación del historial.
- `useAnalyticsStore`: costos, márgenes, pagos y proyecciones.
- `useUsersStore`: usuarios, empleados y códigos de invitación.

## Comunicación con el backend

Los servicios de cada feature consumen rutas relativas a `/api/v1`:

- `auth`: `/auth/login`, `/auth/register`.
- `dashboard` y `analytics`: `/reportes`, `/pedidos/todos`,
  `/productos/costos`.
- `inventory`: `/inventario`.
- `menu`: `/productos`.
- `orders`: `/pedidos`.
- `users`: `/usuarios`.
- `history`: `/historial`.

La autorización de la interfaz mejora la experiencia de usuario, pero la
autorización definitiva siempre corresponde al backend.

