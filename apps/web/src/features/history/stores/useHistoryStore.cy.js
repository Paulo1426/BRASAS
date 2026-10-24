import { useHistoryStore } from "./useHistoryStore";

const HISTORIAL_URL = "**/api/v1/historial*";
const estado = () => useHistoryStore.getState();

describe("Módulo 5 · Historial de auditoría – Consulta y filtros (useHistoryStore)", () => {
  beforeEach(() => estado().reset());

  it("CP-01 · Respuesta con datos → items, total y fin de carga", () => {
    cy.intercept("GET", HISTORIAL_URL, { body: { data: [{ id: 1, accion: "CREAR" }], total: 1 } });
    cy.then(() => estado().fetchHistorial()).then(() => {
      expect(estado().items).to.have.length(1);
      expect(estado().total).to.eq(1);
      expect(estado().isLoading).to.eq(false);
    });
  });

  it("CP-02 · Respuesta vacía ({}) → items [] y total 0", () => {
    cy.intercept("GET", HISTORIAL_URL, { body: {} });
    cy.then(() => estado().fetchHistorial()).then(() => {
      expect(estado().items).to.deep.eq([]);
      expect(estado().total).to.eq(0);
    });
  });

  it("CP-03 · Respuesta con data pero sin total → total 0", () => {
    cy.intercept("GET", HISTORIAL_URL, { body: { data: [{ id: 7, accion: "EDITAR" }] } });
    cy.then(() => estado().fetchHistorial()).then(() => {
      expect(estado().items).to.have.length(1);
      expect(estado().total).to.eq(0);
    });
  });

  it("CP-04 · Error con mensaje del servidor lo expone en 'error'", () => {
    cy.intercept("GET", HISTORIAL_URL, { statusCode: 400, body: { message: "tipo_accion inválido" } });
    cy.then(() => estado().fetchHistorial()).then(() => {
      expect(estado().error).to.eq("tipo_accion inválido");
      expect(estado().isLoading).to.eq(false);
    });
  });

  it("CP-05 · Error sin mensaje usa el texto por defecto", () => {
    cy.intercept("GET", HISTORIAL_URL, { statusCode: 500, body: "" });
    cy.then(() => estado().fetchHistorial()).then(() => {
      expect(estado().error).to.eq("Error al cargar historial");
    });
  });

  it("CP-06 · Valor límite del debounce: a los 399 ms no consulta, a los 400 ms sí (página 1)", () => {
    cy.clock();
    cy.intercept("GET", HISTORIAL_URL, { body: { data: [], total: 0 } }).as("historial");
    cy.then(() => {
      useHistoryStore.setState({ page: 3 });
      estado().setFiltros({ accion: "CREAR" });
      expect(estado().page).to.eq(1);
    });
    cy.tick(399);
    cy.get("@historial.all").should("have.length", 0);
    cy.tick(1);
    cy.wait("@historial").its("request.query")
      .should("deep.include", { accion: "CREAR", page: "1", limit: "20" });
  });

  it("CP-07 · Varios cambios seguidos generan UNA sola petición con los filtros acumulados", () => {
    cy.clock();
    cy.intercept("GET", HISTORIAL_URL, { body: { data: [], total: 0 } }).as("historial");
    cy.then(() => estado().setFiltros({ accion: "CREAR" }));
    cy.tick(200);
    cy.then(() => estado().setFiltros({ fecha_inicio: "2026-10-01" }));
    cy.tick(400);
    cy.wait("@historial").its("request.query")
      .should("deep.include", { accion: "CREAR", fecha_inicio: "2026-10-01" });
    cy.get("@historial.all").should("have.length", 1);
  });

  it("CP-08 · Los filtros vacíos no se envían al backend", () => {
    cy.intercept("GET", HISTORIAL_URL, { body: { data: [], total: 0 } }).as("historial");
    cy.then(() => {
      useHistoryStore.setState({ filtros: { accion: "", entidad: null, fecha_fin: "2026-10-17" } });
      return estado().fetchHistorial();
    });
    cy.wait("@historial").its("request.query").then((q) => {
      expect(q).to.have.property("fecha_fin", "2026-10-17");
      expect(q).not.to.have.property("accion");
      expect(q).not.to.have.property("entidad");
    });
  });
});
