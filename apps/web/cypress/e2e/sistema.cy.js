/**
 * SIS · Sistema completo SIN stubs: navegador → React → Express → PostgreSQL de PRUEBAS.
 * Cierra la integración (CI-A12, CI-DP7, CI-DA4) desde la interfaz.
 * Requisitos: API en :3000 con apps/api/.env.test, frontend en :5173 y cuentas creadas con e2e/support/seed.js.
 * Ejecutar: npx cypress run --e2e --spec cypress/e2e/sistema.cy.js
 */
const JEFE = { email: "jefe.e2e@brasas.test", password: "Clave123*" }; // Cypress 16 eliminó Cypress.env(); se usan los valores por defecto

const iniciarSesion = ({ email, password }) => {
  cy.visit("/login");
  cy.get('input[type="email"]').type(email);
  cy.get('input[type="password"]').type(password, { log: false });
  cy.get('button[type="submit"]').click();
};

describe("SIS · Interfaz integrada con la API y la base de datos reales", () => {
  it("SIS-UI-01 · El JEFE inicia sesión con la API real y recibe un JWT", () => {
    cy.intercept("POST", "**/api/v1/auth/login").as("login");
    iniciarSesion(JEFE);
    cy.wait("@login").its("response.statusCode").should("eq", 200);
    cy.location("pathname").should("eq", "/dashboard");
    cy.window().its("localStorage.brasas_token").should("match", /^[\w-]+\.[\w-]+\.[\w-]+$/);
  });

  it("SIS-UI-02 · Los 5 módulos responden 200 desde PostgreSQL al navegar por el menú", () => {
    cy.intercept("GET", "**/api/v1/pedidos/todos*").as("pedidos");
    cy.intercept("GET", "**/api/v1/inventario/insumos").as("insumos");
    cy.intercept("GET", "**/api/v1/productos").as("productos");
    cy.intercept("GET", "**/api/v1/historial*").as("historial");
    cy.intercept("GET", "**/api/v1/reportes/resumen*").as("resumen");
    iniciarSesion(JEFE);
    cy.wait("@resumen").its("response.statusCode").should("eq", 200);
    [["Pedidos", "@pedidos"], ["Inventario", "@insumos"], ["Menú", "@productos"], ["Historial", "@historial"]].forEach(([opcion, alias]) => {
      cy.menuLateral(opcion);
      cy.wait(alias).its("response.statusCode").should("eq", 200);
    });
  });

  it("SIS-UI-03 · El producto sembrado (seed) llega de la BD a la tabla del Menú", () => {
    iniciarSesion(JEFE);
    cy.location("pathname").should("eq", "/dashboard");
    cy.menuLateral("Menú");
    cy.contains("tr", "Churrasco 400 g (prueba)").should("exist");
  });
});
