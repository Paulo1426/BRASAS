/**
 * P1 · Interfaz Web (router.jsx + DashboardLayout/Sidebar + services/api.js) integrada con P2–P6.
 * La capa de servicios se reemplaza con stubs (cy.stubApi); la sesión la prepara el driver (cy.visitarConSesion).
 * Se usa en CI-A05 (P1-P2…P6), CI-A09 (CP-P1, sobre el build de producción) y CI-DP1/CI-DP2.
 * Ejecutar con el frontend corriendo: npm run dev (o vite preview --port 5173).
 */
describe("P1 · Interfaz Web con la API simulada", () => {
  beforeEach(() => cy.stubApi());

  it("P1-01 · Sin sesión, una ruta protegida redirige a /login", () => {
    cy.visit("/dashboard");
    cy.location("pathname").should("eq", "/login");
  });

  it("P1-02 · El JEFE ve su menú (sin 'Usuarios') y aterriza en /dashboard", () => {
    cy.visitarConSesion("/dashboard", "JEFE");
    cy.location("pathname").should("eq", "/dashboard");
    ["Dashboard", "Menú", "Inventario", "Pedidos", "Historial", "Mi Equipo"].forEach((op) => cy.get("nav").contains("button", op));
    cy.get("nav").contains("button", "Usuarios").should("not.exist");
  });

  it("P1-03 · El EMPLEADO que abre /dashboard termina en /empleado/pedidos (RF-03)", () => {
    cy.visitarConSesion("/dashboard", "EMPLEADO");
    cy.location("pathname").should("eq", "/empleado/pedidos");
  });

  it("P1-04 · El menú lateral integra los 5 módulos: cada uno carga su ruta y consulta su API", () => {
    cy.visitarConSesion("/dashboard", "JEFE");
    cy.wait("@resumen");
    [["Pedidos", "/pedidos", "@pedidosTodos"], ["Inventario", "/inventory", "@insumos"],
     ["Menú", "/menu", "@productos"], ["Historial", "/historial", "@historial"], ["Dashboard", "/dashboard", "@resumen"],
    ].forEach(([opcion, ruta, alias]) => {
      cy.menuLateral(opcion);
      cy.location("pathname").should("eq", ruta);
      cy.wait(alias);
    });
  });

  it("P1-05 · services/api.js agrega Authorization: Bearer <token> a cada petición", () => {
    cy.visitarConSesion("/dashboard", "JEFE");
    cy.wait("@resumen").its("request.headers.authorization").should("match", /^Bearer cabecera\./);
  });

  it("P1-06 · Recargar un módulo con sesión válida conserva la ruta (/inventory)", () => {
    cy.visitarConSesion("/inventory", "JEFE");
    cy.wait(1000);
    cy.location("pathname").should("eq", "/inventory");
  });

  it("P1-07 · Una respuesta 401 de la API cierra la sesión y lleva a /login", () => {
    cy.intercept("GET", "**/api/v1/reportes/resumen*", { statusCode: 401, body: { message: "Token inválido" } });
    cy.visitarConSesion("/dashboard", "JEFE");
    cy.location("pathname").should("eq", "/login");
    cy.window().its("localStorage.brasas_token").should("be.undefined");
  });

  it("P1-08 · Un token vencido en el navegador no abre sesión", () => {
    cy.visitarConSesion("/dashboard", "JEFE", { segundos: -60 });
    cy.location("pathname").should("eq", "/login");
  });
});
