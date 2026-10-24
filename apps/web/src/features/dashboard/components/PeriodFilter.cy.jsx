import PeriodFilter from "./PeriodFilter";

describe("Módulo 4 · Dashboard financiero – Selector de período (PeriodFilter)", () => {
  it("CP-07 · Marca el período activo y notifica el cambio", () => {
    cy.mount(<PeriodFilter periodo="mes" onPeriodoChange={cy.stub().as("cambio")} />);
    cy.contains("button", "Mensual").should("have.class", "text-orange-400");
    cy.contains("button", "Semanal").click();
    cy.get("@cambio").should("have.been.calledWith", "semana");
  });
});
