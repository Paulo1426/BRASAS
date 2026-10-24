# Backend — Brasas OS

API REST para la gestión operativa de locales gastronómicos. Está ubicada en
`apps/api` y utiliza Express, PostgreSQL alojado en Supabase y autenticación
stateless con JWT.

## Stack

- Node.js y Express 5
- PostgreSQL mediante `pg` (Supabase)
- JWT con `jsonwebtoken`
- bcrypt para contraseñas
- Helmet y CORS para seguridad HTTP
- Swagger UI y `swagger-jsdoc` para documentación
- Nodemon para desarrollo

## Puesta en marcha

```bash
cd apps/api
npm install
npm run dev
```

Comandos disponibles:

| Comando | Uso |
|---|---|
| `npm run dev` | Inicia el servidor con Nodemon |
| `npm start` | Inicia el servidor con Node |

Crear `apps/api/.env` con la configuración de ejecución y base de datos:

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=cambiar-por-un-secreto-seguro
DB_USER=...
DB_HOST=...
DB_NAME=...
DB_PASSWORD=...
DB_PORT=5432
```

El archivo `.env` está excluido del control de versiones. En producción se
debe configurar el origen permitido de CORS en `src/app.js` y utilizar
credenciales seguras.

## Arquitectura

```text
apps/api/src/
├── app.js                         # Express, middlewares y montaje de rutas
├── server.js                      # Carga .env y arranque HTTP
├── features/
│   ├── auth/                      # Registro, login y usuario actual
│   ├── users/                     # Usuarios y empleados
│   ├── productos/                 # Productos, categorías y costos
│   ├── inventario/                # Insumos, stock y movimientos
│   ├── pedidos/                   # Pedidos, estados y pagos
│   ├── reportes/                  # Resúmenes y proyecciones
│   └── historial/                 # Auditoría
└── shared/
    ├── database/db.js             # Pool PostgreSQL
    ├── middlewares/
    │   ├── auth.middleware.js     # JWT y autorización por rol
    │   └── audit.middleware.js    # Auditoría de mutaciones
    ├── constants/audit.js         # Tipos y entidades auditables
    └── swagger/swagger.js         # Especificación OpenAPI
```

Los dominios siguen el flujo `routes → controller → service → database`.
Las rutas definen la entrada y permisos, los controladores traducen la
petición HTTP y los servicios contienen las reglas de negocio y consultas.

## Servidor y middlewares

`app.js` configura:

1. `helmet()` para cabeceras HTTP de seguridad.
2. `express.json()` para cuerpos JSON.
3. CORS con credenciales.
4. Auditoría de operaciones mutables.
5. Swagger UI.
6. Las rutas bajo `/api/v1`.

El servidor escucha en `PORT` o en el puerto `3000` por defecto.

La documentación interactiva está disponible en:

```text
http://localhost:3000/api-docs
```

## Base de datos

`shared/database/db.js` crea un pool PostgreSQL con las variables `DB_*`,
SSL para Supabase, un máximo de tres conexiones y timeouts configurados.
Al iniciar se ejecuta una consulta `SELECT NOW()`; si la conexión falla, se
reintenta automáticamente cada cinco segundos.

Las operaciones que modifican pedidos usan transacciones. Al completar un
pedido, la actualización dispara el mecanismo de base de datos que descuenta
los insumos asociados.

## Autenticación y autorización

Los endpoints públicos son:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`

Ambos devuelven `{ token, user }`. El JWT expira en ocho horas e incluye
`id`, `rol`, `rol_id`, `local_id` y `email`. Las contraseñas se almacenan
hasheadas con bcrypt. `GET /api/v1/auth/me` devuelve el usuario del token.

`verifyToken` valida el encabezado `Authorization: Bearer <token>`.
`requireRole` exige un rol específico y `requireAnyRole` acepta cualquiera de
los roles indicados. Los roles disponibles son:

| Rol | Alcance |
|---|---|
| `ADMIN` | Administración global y CRUD de usuarios |
| `JEFE` | Gestión del menú, inventario, pedidos, equipo y reportes del local |
| `EMPLEADO` | Operación de pedidos y consulta del menú |

El registro como `JEFE` crea un local. El registro como `EMPLEADO` requiere un
código de invitación y hereda el `local_id` correspondiente.

## Endpoints

Base URL: `http://localhost:3000/api/v1`.
Salvo que se indique “público”, las rutas requieren JWT.

### Usuarios

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/usuarios` | `ADMIN` |
| `POST` | `/usuarios` | `ADMIN` |
| `GET` | `/usuarios/:id` | `ADMIN` |
| `PUT` | `/usuarios/:id` | `ADMIN` |
| `DELETE` | `/usuarios/:id` | `ADMIN` |
| `GET` | `/usuarios/mis-empleados` | `JEFE`, `ADMIN` |
| `GET/POST` | `/usuarios/codigo-invitacion` | `JEFE`, `ADMIN` |

### Productos y categorías

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/productos` | Token |
| `POST`, `PUT`, `DELETE` | `/productos`, `/productos/:id` | `JEFE`, `ADMIN` |
| `GET` | `/productos/:id` | Token |
| `GET` | `/productos/categorias` | Token |
| `POST`, `DELETE` | `/productos/categorias`, `/productos/categorias/:id` | `JEFE`, `ADMIN` |
| `GET` | `/productos/costos` | `JEFE`, `ADMIN` |
| `POST` | `/productos/recalcular-costos` | `JEFE`, `ADMIN` |

La eliminación de productos es lógica (soft delete).

### Inventario

| Método | Ruta | Acceso |
|---|---|---|
| `GET`, `POST` | `/inventario/insumos` | `JEFE`, `ADMIN` |
| `GET`, `PUT`, `DELETE` | `/inventario/insumos/:id` | `JEFE`, `ADMIN` |
| `PATCH` | `/inventario/insumos/:id/stock-minimo` | `ADMIN` |
| `GET` | `/inventario/movimientos` | `JEFE`, `ADMIN` |
| `POST` | `/inventario/entrada` | `JEFE`, `ADMIN` |
| `POST` | `/inventario/salida` | `JEFE`, `ADMIN` |

La salida de stock se rechaza cuando no existe cantidad suficiente.

### Pedidos

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/pedidos` | Token |
| `POST` | `/pedidos` | Token |
| `GET` | `/pedidos/:id` | Token |
| `PUT` | `/pedidos/:id/estado` | Token |
| `PUT` | `/pedidos/:id` | `ADMIN` |
| `DELETE` | `/pedidos/:id` | Token |
| `GET` | `/pedidos/todos` | `JEFE`, `ADMIN` |

### Reportes e historial

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/reportes/resumen` | `JEFE`, `ADMIN` |
| `GET` | `/reportes/turno` | Token |
| `GET` | `/reportes/proyecciones` | `JEFE`, `ADMIN` |
| `GET` | `/reportes/pagos` | `JEFE`, `ADMIN` |
| `GET` | `/reportes/top-productos` | `JEFE`, `ADMIN` |
| `GET` | `/historial` | Todos los roles autenticados |

`/reportes/resumen` acepta el período `diario`, `semanal` o `mensual` y
calcula ingresos, costos, utilidad, margen, pedidos y ticket promedio.

## Auditoría

El middleware registra automáticamente las mutaciones exitosas con estado
2xx: `POST`, `PUT`, `PATCH` y `DELETE`. Guarda usuario, local, tipo de acción,
entidad y `entidad_id` en el historial. Las rutas de autenticación e historial
se excluyen para evitar registros recursivos.

## Guía para pruebas de integración

El backend debe probarse como el sistema que recibe una petición del frontend,
valida autenticación y rol, ejecuta reglas de negocio, consulta PostgreSQL y
devuelve una respuesta que el frontend pueda consumir. El objetivo no es
probar cada función aislada, sino verificar la cadena completa:

```text
HTTP request
  → route
  → middleware JWT/rol
  → controller
  → service
  → PostgreSQL/Supabase
  → response JSON
  → store y componente del frontend
```

### Entorno de prueba

Levantar el backend y el frontend en procesos separados:

```bash
cd apps/api
npm run dev

cd apps/web
npm run dev
```

Antes de ejecutar casos dependientes, comprobar:

- `GET` o una petición equivalente responde desde
  `http://localhost:3000/api/v1`.
- `http://localhost:3000/api-docs` abre Swagger.
- La conexión PostgreSQL se establece correctamente en el arranque.
- `JWT_SECRET` y las variables `DB_*` apuntan a una base de datos de pruebas.
- El origen del frontend (`http://localhost:5173`) está permitido por CORS.

Se recomienda una base aislada o datos con un prefijo de prueba. No se deben
usar credenciales reales ni exponer valores de `.env` en evidencias.

### Contrato HTTP que debe verificarse

- Todas las peticiones protegidas llevan
  `Authorization: Bearer <token>`.
- Los cuerpos usan `Content-Type: application/json`.
- Las respuestas exitosas devuelven JSON con estado `200` o `201`.
- Los errores usan la forma `{ "message": "..." }`.
- `401` significa token ausente, inválido o expirado.
- `403` significa autenticación válida pero permisos insuficientes.
- `404` significa recurso inexistente en el alcance solicitado.
- `409` se usa para conflictos como email duplicado o pedido ya completado.

### Datos y dependencias de ejecución

La secuencia mínima para preparar una prueba de extremo a extremo es:

1. `POST /auth/register` como `jefe`; guardar `token`, `user.id` y
   `user.local_id`.
2. `POST /auth/login`; confirmar que el password se valida contra bcrypt y que
   se emite un JWT de ocho horas.
3. `POST /productos/categorias` y `POST /inventario/insumos`.
4. `POST /productos` usando la categoría y los insumos creados.
5. Generar un código con `POST /usuarios/codigo-invitacion`.
6. Registrar un `empleado` con ese código y confirmar el mismo `local_id`.
7. Crear un pedido con `POST /pedidos`.
8. Cambiar su estado hasta completarlo y confirmar el descuento de stock.
9. Consultar `/reportes/*` y `/historial` para comprobar los efectos.

Los identificadores deben obtenerse de las respuestas; no se deben asumir
UUID ni IDs fijos.

### Casos de integración por módulo

| Módulo | Flujo | Verificaciones |
|---|---|---|
| Auth | Registro y login | Status esperado, usuario retornado, JWT válido, password nunca retornado |
| Auth | `/auth/me` sin/con token | `401` sin token y datos del usuario con token válido |
| Usuarios | Invitación y registro de empleado | Código válido, rol `EMPLEADO` y herencia de `local_id` |
| Productos | Categoría → producto → listado | Persistencia, asociación de insumos y soft delete |
| Inventario | Insumo → entrada → salida | Stock actualizado, movimientos persistidos y rechazo de stock insuficiente |
| Pedidos | Crear → estados → completar | Total calculado en servidor, transición válida y pago persistido |
| Pedidos | Acceso por local | Un usuario no puede consultar o modificar pedidos de otro local |
| Reportes | Pedido completado → resumen | Ingresos, costos, utilidad, margen y ticket promedio coherentes |
| Historial | Mutación exitosa → consulta | Se registra usuario, local, acción, entidad e identificador |

### Estrategias Bottom-Up y Top-Down

La imagen de referencia describe una integración incremental. Para este
proyecto, una adaptación Bottom-Up es:

1. **Primera fase:** integrar las unidades base `E`, `F`, `G` y `D`:
   autenticación/middleware, acceso a base de datos, servicios de dominio y
   rutas o controladores.
2. **Segunda fase:** integrar `B` con `E`, `C` con `F` y `C` con `G`:
   conectar controladores con servicios, persistencia y contratos HTTP.
3. **Tercera fase:** integrar `A` con `B`, `A` con `C` y `A` con `D`:
   validar los flujos completos desde el frontend, incluyendo sesión,
   negocio, base de datos y respuesta visible.

En Top-Down se parte de la aplicación completa y se reemplazan o validan
dependencias por niveles:

- **Profundidad:** registro/login → creación de catálogo → pedido →
  completado → reportes e historial.
- **Anchura:** autenticar; después validar en paralelo usuarios, productos,
  inventario, pedidos, reportes e historial.

### Criterios de aceptación

- El status HTTP y el JSON coinciden con lo que espera el service del
  frontend.
- La información queda persistida y puede recuperarse en una segunda
  petición.
- Las restricciones de rol y `local_id` se cumplen en backend, aunque el
  frontend oculte botones.
- Cada mutación exitosa genera el registro de auditoría esperado.
- Un error de base de datos o de validación se devuelve como error explícito;
  no se considera exitoso un flujo que solo actualiza la interfaz.
