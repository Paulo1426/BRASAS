# Resumen de pruebas — Brasas OS v2

## Ambiente
- **Base de datos:** opción C (la base actual de `apps/api/.env`), confirmada por el usuario. `.env.test` creado con `DB_ENTORNO=pruebas`; `.env.*` está en `.gitignore`.
- Node v24.15.0, npm 11.12.1. Docker y Java no están instalados (no se necesitaron para la opción C; Java hace falta para JMeter y ZAP).
- Los 57 archivos de `docs/scripts-pruebas-brasas.zip` se copiaron sin conflictos.
- Ajustes al ambiente (no al código de la app):
  1. Se creó `apps/web/cypress/support/component-index.html`, que el zip no traía y Cypress exige.
  2. `apps/web/cypress/e2e/sistema.cy.js` línea 7: Cypress 16 eliminó `Cypress.env()`; se dejaron los valores por defecto (`jefe.e2e@brasas.test` / `Clave123*`).
- Datos que quedaron en la base real: cuentas `*.e2e@brasas.test` y los registros creados por las pruebas de aceptación.

## Resultados
| # | Suite | Aprobadas / total | Fallos |
|---|---|---|---|
| 1 | Jest integración (componentes) | 83 / 92 | N1-13, N1-17, N2-09, N3-07, N4-06, N5-07, N5-08, T2-06, T2-07. Coincide con la referencia (83/92). |
| 2 | Jest BD + hilos | 44 / 63 | CI-H01-01 P2, CI-H01-03 P1–P2, CI-H02-01 P1–P4, CI-H02-02 P1–P2, CI-H02-03 P2–P3, CI-H05-01 P4, CI-H05-03 P1–P2, D2-04, SIS-01, SIS-03, SIS-04, SIS-06 |
| 3 | Cypress componentes (unitarias) | no ejecutada | El renderer de Electron y de Edge se cierra al montar cualquier spec (ver abajo) |
| 7a | Cypress e2e interfaz-web | 7 / 8 | P1-06 (DEF-18, esperado) |
| 7b | Cypress e2e sistema | 3 / 3 | Ninguno |
| 8 | Cypress componentes `src/integracion` | no ejecutada | Mismo problema que la suite 3 |
| 9 | Selenium (Chrome por defecto, Firefox, Edge) | 6 / 8 en cada navegador | CA006 (DEF-02) y CA008 (DEF-03), esperados |
| 10 | Selenium responsive 768 px | 5 / 5 | Ninguno |
| 11 | Cobertura Jest | 83 / 92 | Statements 51.25 %, branches 43.9 %, functions 39.83 %, lines 54.58 % |

## Pendiente de revisar
- Suite 2: los fallos de CI-H02-xx, CI-H05-xx, SIS y D2-04 dependen de datos y del trigger de la BD real. Hay que contrastarlos uno a uno con el Anexo C (DEF-xx). D2-04 (roles cargados) y los pasos H02 pueden ser del ambiente.
- Suites 3 y 8: el crash es de Cypress 16 con vite 8 en este equipo (los e2e sí funcionan en Electron). Opciones: probar `cypress@15`, o correrlas con `npx cypress open`.
- A mano: OWASP ZAP (no activo contra esta BD), JMeter (no RP-02 contra esta BD), Lighthouse, SonarQube y los pantallazos de cada caso.
