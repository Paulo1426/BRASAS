// Comandos de apoyo para las pruebas e2e (integración de la capa de presentación)

/** Token con la misma forma que el JWT real: el frontend solo decodifica el payload (exp). */
const tokenFalso = (rol, segundos = 3600) => {
  const payload = { id: `u-${rol.toLowerCase()}`, rol, exp: Math.floor(Date.now() / 1000) + segundos };
  return `cabecera.${btoa(JSON.stringify(payload)).replace(/=+$/, "")}.firma`;
};

/** Abre la app con una sesión guardada en localStorage (driver de la sesión). */
Cypress.Commands.add("visitarConSesion", (ruta, rol = "JEFE", { segundos = 3600 } = {}) => {
  cy.visit(ruta, {
    onBeforeLoad(win) {
      win.localStorage.setItem("brasas_token", tokenFalso(rol, segundos));
      win.localStorage.setItem("brasas_user", JSON.stringify({ id: `u-${rol.toLowerCase()}`, nombre: `${rol} Prueba`, email: `${rol.toLowerCase()}@brasas.test`, rol }));
    },
  });
});

/** Stub de la capa de servicios (CS): todas las rutas /api/v1 responden datos controlados. */
Cypress.Commands.add("stubApi", () => {
  cy.intercept("GET", "**/api/v1/**", { body: [] }).as("cualquiera");
  cy.intercept("GET", "**/api/v1/pedidos/todos*", { fixture: "pedidos.json" }).as("pedidosTodos");
  cy.intercept("GET", "**/api/v1/pedidos", { fixture: "pedidos.json" }).as("pedidos");
  cy.intercept("GET", "**/api/v1/inventario/insumos", { fixture: "insumos.json" }).as("insumos");
  cy.intercept("GET", "**/api/v1/productos", { fixture: "productos.json" }).as("productos");
  cy.intercept("GET", "**/api/v1/reportes/resumen*", { fixture: "resumen.json" }).as("resumen");
  cy.intercept("GET", "**/api/v1/historial*", { fixture: "historial.json" }).as("historial");
});

/** Clic en una opción del menú lateral (navegación dentro de la SPA). */
Cypress.Commands.add("menuLateral", (opcion) => {
  cy.get("nav").contains("button", opcion).click();
});
