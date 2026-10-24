import { OrderCreateModal } from "./OrderCreateModal";
import { useMenuStore } from "../../menu/stores/useMenuStore";

const MENU = [
  { id: "p-churrasco", nombre: "Churrasco 400 g",  precio_venta: 45000, categoria: "Carnes",  categoria_id: "c-1" },
  { id: "p-limonada",  nombre: "Limonada de coco", precio_venta: 9000,  categoria: "Bebidas", categoria_id: "c-2" },
];

const crear     = () => cy.contains("button", "Crear pedido");
const cantidad  = () => cy.get("form span.w-8").first();          // contador de la línea 1
const elegir    = (plato) => {
  cy.contains("button", "Seleccionar plato...").click();
  cy.contains("button", plato).click();
};

describe("Módulo 1 · Gestión de pedidos – Nuevo pedido (OrderCreateModal)", () => {
  beforeEach(() => {
    useMenuStore.setState({ items: MENU });                        // stub del store del menú
    cy.mount(<OrderCreateModal isOpen isLoading={false}
      onSubmit={cy.stub().as("onSubmit")} onClose={cy.stub()} />);
  });

  it("CP-08 · Sin plato seleccionado no permite crear el pedido", () => {
    crear().should("be.disabled");
  });

  it("CP-09 · Valor límite: la cantidad nunca baja de 1", () => {
    cantidad().should("have.text", "1");
    cantidad().prev("button").click();
    cantidad().should("have.text", "1");
  });

  it("CP-10 · Calcula el total (2 × $45.000) y envía los ítems", () => {
    elegir("Churrasco 400 g");
    cantidad().next("button").click();
    cantidad().should("have.text", "2");
    cy.contains("Total estimado").next().should("have.text", "$90.000");
    crear().click();
    cy.get("@onSubmit").should("have.been.calledWith", [{ producto_id: "p-churrasco", cantidad: 2 }]);
  });

  it("CP-11 · Un plato ya elegido no se ofrece en otra línea", () => {
    elegir("Churrasco 400 g");
    cy.contains("button", "Agregar otro plato").click();
    cy.contains("button", "Seleccionar plato...").click();
    cy.contains("button", "Limonada de coco").should("exist");
    cy.contains("button", "Churrasco 400 g").should("not.exist");
  });
});
