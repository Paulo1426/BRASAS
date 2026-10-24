import { PaymentModal } from "./PaymentModal";

const TOTAL = 90000;
const confirmar = () => cy.contains("button", "Confirmar");
const metodo    = (nombre) => cy.contains("button", nombre);
const monto     = (etiqueta) => cy.contains("label", etiqueta).parent().find("input");

describe("Módulo 1 · Gestión de pedidos – Método de pago (PaymentModal)", () => {
  beforeEach(() => {
    cy.mount(
      <PaymentModal isOpen total={TOTAL}
        onConfirm={cy.stub().as("onConfirm")} onClose={cy.stub().as("onClose")} />,
    );
  });

  it("CP-01 · Sin método seleccionado el botón Confirmar está deshabilitado", () => {
    confirmar().should("be.disabled");
  });

  it("CP-02 · Efectivo confirma con { metodo: 'efectivo' }", () => {
    metodo("Efectivo").click();
    confirmar().should("be.enabled").click();
    cy.get("@onConfirm").should("have.been.calledOnce")
      .and("have.been.calledWith", { metodo: "efectivo" });
  });

  it("CP-03 · Ambos con suma exacta (50.000 + 40.000) envía el pago dividido", () => {
    metodo("Ambos").click();
    monto("Efectivo").type("50000");
    monto("Transferencia").type("40000");
    confirmar().should("be.enabled").click();
    cy.get("@onConfirm").should("have.been.calledWith",
      { metodo: "ambos", efectivo: 50000, transferencia: 40000 });
  });

  it("CP-04 · Ambos con faltante muestra 'Faltan $10.000' y bloquea", () => {
    metodo("Ambos").click();
    monto("Efectivo").type("50000");
    monto("Transferencia").type("30000");
    cy.contains("Faltan $10.000").should("be.visible");
    confirmar().should("be.disabled");
  });

  it("CP-05 · Ambos con excedente muestra 'Excede $10.000' y bloquea", () => {
    metodo("Ambos").click();
    monto("Efectivo").type("60000");
    monto("Transferencia").type("40000");
    cy.contains("Excede $10.000").should("be.visible");
    confirmar().should("be.disabled");
  });

  it("CP-06 · Valor límite: diferencia de $1 bloquea y diferencia de $0,5 permite", () => {
    metodo("Ambos").click();
    monto("Efectivo").type("89999");
    monto("Transferencia").type("0");
    confirmar().should("be.disabled");          // |90.000 − 89.999| = 1  → no < 1
    monto("Efectivo").clear().type("89999.5");
    confirmar().should("be.enabled");           // |90.000 − 89.999,5| = 0,5 → < 1
  });

  it("CP-07 · Valor límite: Ambos con montos en cero no permite confirmar", () => {
    metodo("Ambos").click();
    monto("Efectivo").type("0");
    monto("Transferencia").type("0");
    confirmar().should("be.disabled");
  });

  it("CP-12 · Transferencia confirma con { metodo: 'transferencia' }", () => {
    metodo("Transferencia").click();
    confirmar().click();
    cy.get("@onConfirm").should("have.been.calledWith", { metodo: "transferencia" });
  });
});
