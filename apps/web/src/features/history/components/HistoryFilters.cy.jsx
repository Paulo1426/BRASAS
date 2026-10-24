import { HistoryFilters } from "./HistoryFilters";
import { historyViewConfig } from "../config/historyViewConfig";

const montar = (rol, usuarios = []) => cy.mount(
  <HistoryFilters config={historyViewConfig[rol]} filtros={{}} usuarios={usuarios}
    onChange={cy.stub().as("onChange")} />,
);

describe("Módulo 5 · Historial de auditoría – Filtros por rol (HistoryFilters)", () => {
  it("CP-09 · ADMIN sin lista de usuarios ve el campo 'ID de usuario'", () => {
    montar("ADMIN");
    cy.get('input[placeholder="ID de usuario"]').should("be.visible");
  });

  it("CP-10 · ADMIN con usuarios ve el selector 'Todos los usuarios'", () => {
    montar("ADMIN", [{ id: "u-1", nombre: "Ana" }]);
    cy.contains("option", "Todos los usuarios").should("exist");
  });

  it("CP-11 · JEFE: sin filtro de usuario y solo 5 entidades de negocio", () => {
    montar("JEFE");
    cy.get('input[placeholder="ID de usuario"]').should("not.exist");
    cy.contains("option", "Todas las entidades").parent("select")
      .find("option").should("have.length", 6);            // "Todas" + 5 entidades
  });

  it("CP-12 · EMPLEADO: sin selector de entidad; acción y 2 fechas", () => {
    montar("EMPLEADO");
    cy.contains("option", "Todas las entidades").should("not.exist");
    cy.get("select").should("have.length", 1);
    cy.get('input[type="date"]').should("have.length", 2);
  });

  it("CP-13 · Cambiar la acción notifica { accion: 'COMPLETAR' }", () => {
    montar("JEFE");
    cy.contains("option", "Todas las acciones").parent("select").select("COMPLETAR");
    cy.get("@onChange").should("have.been.calledWith", { accion: "COMPLETAR" });
  });
});
