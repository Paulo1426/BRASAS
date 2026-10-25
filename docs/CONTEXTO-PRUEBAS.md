# Contexto del proceso de pruebas de Brasas OS v2

Este documento resume lo que se hizo en la sesión de trabajo con Claude Code del 17 al 24 de octubre de 2026, para que cualquier integrante del equipo pueda retomar el trabajo sin leer la conversación.

Los resultados completos están en el documento `Pruebas-Software-Brasas-OS-completado.docx` (lo guarda Paulo; pesa unos 16 MB y no está en el repositorio). Los logs y los reportes crudos están en `docs/resultados/`.

## 1. Qué se hizo, en orden

1. **Tema visual.** Se cambió la paleta del frontend a un fondo beige cálido (`#e6d9bd`), texto marrón (`#2a1810`) y acento naranja (`#ff6b35`), con tarjetas de borde grueso y sombra dura, según las capturas de referencia. Tipografías: Plus Jakarta Sans para títulos e Inter para el cuerpo. El menú lateral quedó oscuro con letras crema.
2. **Ambiente de pruebas.** Se copiaron los 57 archivos de prueba del zip a `apps/api/tests`, `apps/web` (Cypress) y `e2e` (Selenium), se instalaron las dependencias y se creó `apps/api/.env.test`.
3. **Ejecución de las pruebas** unitarias, de integración, de sistema y de aceptación, y llenado del documento con los resultados reales.
4. **Herramientas de sistema** instaladas y ejecutadas: Lighthouse, JMeter, OWASP ZAP y SonarQube.
5. **Commits** a nombre de Joannes Gutierrez, sin mención de Claude, en `feature/frontend` y `feature/backend`.

Todas las pruebas se hicieron en localhost. No hay pruebas de despliegue (se descartaron UptimeRobot, SSL y staging).

## 2. Dónde está cada cosa

| Qué | Dónde | Rama |
|---|---|---|
| Pruebas unitarias y de integración del frontend (Cypress) | `apps/web/src/**/*.cy.js(x)`, `apps/web/cypress/`, `apps/web/cypress.config.js` | `feature/frontend` |
| Pruebas de aceptación y portabilidad (Selenium) | `e2e/` | `feature/frontend` |
| Pruebas de integración del backend (Jest + Supertest) | `apps/api/tests/`, `apps/api/jest.config.js` | `feature/backend` |
| Documento de pruebas en Markdown y logs | `docs/pruebas-software-brasas-os.md`, `docs/resultados/` | `feature/frontend` |
| Plan de JMeter | `docs/resultados/jmeter/*.jmx`, `stats.json` | `feature/frontend` |
| Informe de ZAP | `docs/resultados/zap/zap-brasas.html` | `feature/frontend` |
| Métricas de SonarQube | `docs/resultados/sonarqube/metrics.json` | `feature/frontend` |

Las imágenes pesadas (capturas, reportes HTML de Lighthouse y JMeter) están en `.gitignore`; solo existen en el equipo de Paulo.

## 3. Cómo correr las pruebas

Requisitos: Node 22 o 24 y Java 17 o superior (para JMeter, ZAP y SonarQube).

1. En `apps/api`, `apps/web` y `e2e`, ejecutar `npm install`.
2. Crear `apps/api/.env.test` (está ignorado por git) con:
   ```
   DB_ENTORNO=pruebas
   DB_HOST=...
   DB_PORT=...
   DB_NAME=...
   DB_USER=...
   DB_PASSWORD=...
   JWT_SECRET=secreto-solo-para-pruebas
   ```
   Sin `DB_ENTORNO=pruebas` las suites con base de datos se detienen a propósito.
3. Pruebas del backend (rama `feature/backend`), en `apps/api`:
   - `npm run test:int` (componentes, no usa base de datos)
   - `npm run test:int:bd` (base de datos e hilos)
   - `npm run test:cov` (cobertura)
   - `npm run start:test` levanta la API con `.env.test`
4. Pruebas del frontend, en `apps/web`:
   - `npm run test:unit` (Cypress Component Testing, 53 casos unitarios más la integración de presentación)
   - Para E2E: levantar la API y `npm run dev` (puerto 5173, obligatorio por CORS), y luego `npm run test:int:web` y `npm run test:sis:web`.
5. Selenium, en `e2e`: con la API y el frontend arriba, `npm run seed` una vez y luego `npm test`, `npm run test:firefox`, `npm run test:edge` y `npm run test:responsive`.

## 4. Resultados principales

| Prueba | Resultado |
|---|---|
| Unitarias (Cypress) | 50 de 53 aprobadas; fallan Menú CP-03, CP-04 (DEF-04) y CP-08 (DEF-05) |
| Integración de presentación (Cypress) | 11 de 12; falla P5-03 (DEF-17) |
| Integración backend, componentes (Jest) | 83 de 92 |
| Integración backend, base de datos e hilos (Jest) | 44 de 63 |
| Cypress E2E | interfaz 7 de 8 (falla P1-06, DEF-18); sistema 3 de 3 |
| Aceptación (Selenium) | 6 de 8 en Chrome, Firefox y Edge; fallan CA006 (DEF-02) y CA008 (DEF-03) |
| Responsive a 768 px | 5 de 5, sin desbordamiento |
| Lighthouse | accesibilidad entre 59 y 91 (umbral 90); prácticas 100; rendimiento del Dashboard 76 |
| JMeter | 20 usuarios: p95 2.362 ms, 0 % de error, APDEX 0,83 (umbral 0,85); el punto de quiebre está entre 20 y 50 usuarios |
| ZAP | 3 alertas altas (falsos positivos comprobados a mano), 36 medias de configuración |
| SonarQube | Quality Gate Passed, mantenibilidad A, 8 bugs y 1 vulnerabilidad |
| Resistencia 30 min | 0 % de error; el p95 empeora 20,1 % (umbral 20 %) |
| Recuperabilidad | la API se cae ante un corte de la conexión a la BD y no se recupera sola |

## 5. Defectos encontrados (resumen)

Los defectos DEF-01 a DEF-23 están en el Anexo C del documento. Los más importantes:

- **DEF-16** (crítico): las entradas y salidas de inventario por API responden 500 (`operator is not unique: unknown * unknown`).
- **DEF-19** (nuevo): el valor `preparando` no existe en el enum `pedido_estado_enum` de la base; cambiar un pedido a ese estado responde 500.
- **DEF-12** (confirmado): sin `pool.on('error')` en `db.js`, un corte de conexión termina el proceso de la API.
- **DEF-03**: el Empleado recibe costo y margen de los productos (API e interfaz).
- **DEF-08**: editar un pedido como Administrador falla siempre.
- **DEF-02 y DEF-11**: el filtro por acción del historial no funciona y el filtro de un solo día excluye ese día.
- **DEF-18**: al recargar una URL con sesión válida, la app redirige a `/dashboard`.
- **DEF-21**: la API responde 500 ante entradas inválidas en lugar de 400.
- **DEF-22**: el código de invitación usa `Math.random()`.
- **DEF-09 y DEF-10**: la sesión dura 8 h (se exigen 30 min) y el login no limita intentos.

## 6. Cosas que hay que saber

- **Las pruebas usaron la base de datos real del proyecto**, no un proyecto `brasas-test` aparte. Quedaron datos de prueba: cuentas `jefe.e2e@brasas.test` y `empleado.e2e@brasas.test` (clave `Clave123*`), pedidos e insumos creados por Selenium y JMeter, y registros con textos de ataque creados por ZAP (por ejemplo insumos con nombres como `../../etc/passwd` y un producto con `<img src=x onerror=alert(1)>`). Conviene limpiarlos antes de usar la base para otra cosa.
- **No se hizo commit de `.env.test`.** Cada integrante crea el suyo.
- **Cypress 16 y `Cypress.env()`:** `cypress/e2e/sistema.cy.js` usa los valores por defecto de las credenciales porque Cypress 16 eliminó `Cypress.env()`.
- **`component-index.html` sin BOM:** si se vuelve a crear `apps/web/cypress/support/component-index.html` con un editor que añada BOM, Cypress cierra el navegador al montar cualquier componente.
- **P5 de integración:** el spec envuelve `DashboardPage` en `MemoryRouter` porque `QuickActions` usa `useNavigate`.
- **`git fetch` falla** con `cannot open '.git/FETCH_HEAD': Invalid argument` en el equipo de Paulo (archivo fantasma del sistema de archivos). Alternativa: `git fetch --no-write-fetch-head origin`.
- **SonarQube** está instalado en `C:\sq\sonarqube-26.10.0.133078` en el equipo de Paulo (arranque con `bin\windows-x86-64\StartSonar.bat`, `http://localhost:9000`).
- **Las imágenes de terminal** del documento (Jest, Cypress, Selenium) son imágenes generadas a partir de los resultados reales, no pantallazos de consola.

## 7. Pendiente

- Todas las capturas del documento ya están insertadas; no se usó un segundo equipo (todo se ejecutó en un solo computador, Ryzen 5 5600G con Windows 11).
- Corregir los defectos del Anexo C y repetir las pruebas fallidas como regresión.
- Verificar el documento en Word: actualizar la tabla de contenido (clic derecho, Actualizar campo).
