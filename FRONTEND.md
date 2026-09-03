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

## Guía para pruebas de integración

Este documento sirve como referencia para probar la integración entre los
componentes React, los stores Zustand, el cliente Axios y la API. Una prueba
de integración no debe validar únicamente que una pantalla se renderiza:
debe comprobar que una acción del usuario genera la petición correcta, que la
respuesta actualiza el store y que la interfaz refleja el nuevo estado.

### Flujo que se debe probar

```text
Usuario
  → componente de la feature
  → store Zustand
  → service de la feature
  → services/api.js
  → API REST /api/v1
  → respuesta HTTP
  → store
  → render actualizado
```

Para pruebas contra el backend real se deben levantar ambos procesos:

```bash
# terminal 1
cd apps/api
npm run dev

# terminal 2
cd apps/web
npm run dev
```

La URL esperada del frontend es `http://localhost:5173` y la de la API
`http://localhost:3000/api/v1`. Si se ejecutan pruebas automatizadas desde
otra URL, el origen debe estar permitido por CORS.

### Preparación de datos

1. Crear un usuario `JEFE` mediante `/register`.
2. Iniciar sesión y conservar el JWT y el `local_id` devueltos.
3. Crear un insumo y una categoría.
4. Crear un producto asociado a la categoría y, si aplica, a los insumos.
5. Crear un usuario `EMPLEADO` usando el código de invitación del jefe.
6. Reutilizar los identificadores creados en los casos dependientes y limpiar
   los datos de prueba al finalizar.

No se debe guardar un token fijo en la documentación ni en el repositorio.
Cada ejecución debe obtenerlo desde el login y verificar que el frontend lo
envía como `Authorization: Bearer <token>`.

### Casos de integración por feature

| Feature | Acción UI | Petición esperada | Resultado a verificar |
|---|---|---|---|
| Auth | Enviar login válido | `POST /auth/login` | `useAuthStore` queda autenticado, se guardan usuario/token y se navega al dashboard |
| Auth | Login inválido | `POST /auth/login` | Se muestra el mensaje de error y no se crea sesión |
| Auth | Recargar una sesión válida | `GET /auth/me` o recuperación local | La ruta protegida sigue disponible |
| Menú | Crear producto | `POST /productos` | El producto aparece en la lista y conserva precio, costo y categoría |
| Inventario | Registrar entrada | `POST /inventario/entrada` | El stock mostrado se incrementa y el movimiento aparece en el historial |
| Inventario | Registrar salida | `POST /inventario/salida` | El stock disminuye; con stock insuficiente se muestra el error del backend |
| Pedidos | Crear pedido | `POST /pedidos` | Se muestra el pedido con total calculado por el backend |
| Pedidos | Cambiar estado | `PUT /pedidos/:id/estado` | La tarjeta cambia de estado y el pago, si existe, permanece visible |
| Dashboard | Cambiar período | `GET /reportes/resumen?...` | Se actualizan KPIs, utilidad, margen y comparación del período |
| Analítica | Consultar costos | `GET /productos/costos` | La tabla y los gráficos reflejan costos y márgenes recibidos |
| Usuarios | Generar invitación | `POST /usuarios/codigo-invitacion` | El código se muestra y permite registrar un empleado |
| Historial | Consultar acciones | `GET /historial` | Se muestran las mutaciones realizadas con filtros y paginación |

### Validaciones de sesión y roles

- Sin token, acceder a `/dashboard` debe redirigir a `/login`.
- Un `EMPLEADO` debe poder usar `/empleado/pedidos` y
  `/empleado/menu`, pero no debe ver pantallas exclusivas de jefe o admin.
- Un `JEFE` debe ver únicamente la información de su local.
- Un `ADMIN` debe poder acceder a `/admin/usuarios`.
- Cualquier `401` de la API debe limpiar `brasas_token` y `brasas_user` y
  enviar al usuario a `/login`.
- Un `403` debe mostrarse como permiso insuficiente sin borrar una sesión
  válida.

### Estrategias de integración

La estrategia incremental ascendente (Bottom-Up) puede aplicarse así:

1. Probar primero servicios y stores independientes: auth, menú, inventario
   y pedidos.
2. Integrar cada service con `services/api.js` y verificar método, URL,
   parámetros, cuerpo y encabezado JWT.
3. Integrar cada store con sus componentes y comprobar loading, errores y
   actualización de datos.
4. Integrar las páginas con `DashboardLayout`, router y protección de roles.

La estrategia incremental descendente (Top-Down) parte de la interfaz:

- **Profundidad:** landing/login → autenticación → dashboard → menú,
  inventario, pedidos e historial, completando una rama funcional.
- **Anchura:** login, dashboard, menú, inventario, pedidos, analítica,
  usuarios e historial, completando cada nivel antes de pasar al siguiente.

En ambos casos se deben conservar evidencias de request, response, estado
final y comportamiento visible.
