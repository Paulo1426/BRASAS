import { fetchFinancialSummary } from "./dashboardService";

// "**/" hace que el intercept funcione aunque VITE_API_URL apunte a otro host
const RESUMEN_URL = "**/api/v1/reportes/resumen*";
const PEDIDOS_URL = "**/api/v1/pedidos/todos*";
const RESUMEN = {
  ingresos: 100000, costo_total: 50000, utilidad: 50000, margen: 50,
  utilidad_positiva: true, periodo_anterior: { variacion_utilidad: 25 },
};
const PEDIDOS = [
  { estado: "completado", total: "45000" },
  { estado: "completado", total: "30000.50" },
  { estado: "pendiente",  total: "99999" },     // no suma
  { estado: "cancelado",  total: "10000" },     // no suma
];

describe("Módulo 4 · Dashboard financiero – Resumen por período (fetchFinancialSummary)", () => {
  it("CP-01 · 'mes' consulta periodo=mensual y mapea la respuesta", () => {
    cy.intercept("GET", RESUMEN_URL, { body: RESUMEN }).as("resumen");
    cy.then(() => fetchFinancialSummary("mes")).should("deep.equal", {
      ingresos: 100000, costos: 50000, ganancia: 50000, margen: 50,
      utilidad_positiva: true, variacion_utilidad: 25,
    });
    cy.wait("@resumen").its("request.query.periodo").should("eq", "mensual");
  });

  ["dia:diario", "semana:semanal", "anio:mensual", ":mensual"].forEach((par) => {
    const [entrada, esperado] = par.split(":");
    it(`CP-02 · periodo '${entrada}' se traduce a '${esperado}'`, () => {
      cy.intercept("GET", RESUMEN_URL, { body: RESUMEN }).as("resumen");
      cy.then(() => fetchFinancialSummary(entrada));
      cy.wait("@resumen").its("request.query.periodo").should("eq", esperado);
    });
  });

  it("CP-03 · Sin periodo_anterior la variación es null", () => {
    cy.intercept("GET", RESUMEN_URL, { body: { ...RESUMEN, periodo_anterior: undefined } });
    cy.then(() => fetchFinancialSummary("mes")).its("variacion_utilidad").should("be.null");
  });

  it("CP-04 · Si /reportes/resumen falla, calcula ingresos solo con pedidos completados", () => {
    cy.intercept("GET", RESUMEN_URL, { statusCode: 500, body: {} });
    cy.intercept("GET", PEDIDOS_URL, { body: PEDIDOS }).as("pedidos");
    cy.then(() => fetchFinancialSummary("dia")).should("deep.equal", {
      ingresos: 75000.5, costos: 0, ganancia: 75000.5, margen: 0,
      utilidad_positiva: true, variacion_utilidad: null,
    });
  });

  it("CP-05 · Valores límite de fecha_inicio en el respaldo (1 de noviembre de 2026)", () => {
    cy.clock(new Date(2026, 10, 1, 10, 30, 0).getTime(), ["Date"]);   // solo se congela Date
    cy.intercept("GET", RESUMEN_URL, { statusCode: 500, body: {} });
    cy.intercept("GET", PEDIDOS_URL, { body: [] }).as("pedidos");

    const casos = [
      ["dia",    new Date(2026, 10, 1)],   // inicio del día actual
      ["semana", new Date(2026, 9, 26)],   // hoy − 6 días → cruza al mes anterior
      ["mes",    new Date(2026, 10, 1)],   // primer día del mes
    ];
    casos.forEach(([periodo, inicio]) => {
      cy.then(() => fetchFinancialSummary(periodo));
      cy.wait("@pedidos").its("request.query.fecha_inicio").should("eq", inicio.toISOString());
    });
  });

  it("CP-06 · Si ambas peticiones fallan devuelve todo en cero", () => {
    cy.intercept("GET", RESUMEN_URL, { statusCode: 500, body: {} });
    cy.intercept("GET", PEDIDOS_URL, { statusCode: 500, body: {} });
    cy.then(() => fetchFinancialSummary("mes")).should("deep.equal", {
      ingresos: 0, costos: 0, ganancia: 0, margen: 0, utilidad_positiva: false, variacion_utilidad: null,
    });
  });
});
