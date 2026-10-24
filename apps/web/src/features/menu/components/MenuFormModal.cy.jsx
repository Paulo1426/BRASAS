import { MenuFormModal } from "./MenuFormModal";

const INSUMOS = [
  { id: "i-carne", nombre: "Punta de anca", unidad_medida: "kg",     tipo: "carne"  },
  { id: "i-papa",  nombre: "Papa criolla",  unidad_medida: "unidad", tipo: "insumo" },
];
const CATEGORIAS = [{ id: "c-carnes", nombre: "Carnes" }];

const nombre    = () => cy.get('input[placeholder^="Ej: Chuleta"]');
const precio    = () => cy.contains("label", "Precio de venta").parent().find("input");
const categoria = () => cy.contains("label", "Categoría").parent().find("select");
const guardar   = () => cy.contains("button", "Crear producto");
const cantidad  = (i = 0) => cy.contains("span", "Cantidad:").parent().find("input").eq(i);
const agregarInsumo = (insumo) => {
  cy.contains("button", "+ Agregar insumo").click();
  cy.contains("button", "Seleccionar insumo...").click();
  cy.contains("button", insumo).click();
};

const montar = (props = {}) => cy.mount(
  <MenuFormModal isOpen isLoading={false} editing={null}
    allInsumos={INSUMOS} categorias={CATEGORIAS}
    onSubmit={cy.stub().as("onSubmit")} onClose={cy.stub()} {...props} />,
);

describe("Módulo 3 · Menú y costeo – Nuevo / editar producto (MenuFormModal)", () => {
  it("CP-01 · Sin insumos muestra el error y no envía", () => {
    montar();
    nombre().type("Churrasco 400 g");
    precio().type("45000");
    guardar().click();
    cy.contains("Debés agregar al menos un insumo").should("be.visible");
    cy.get("@onSubmit").should("not.have.been.called");
  });

  it("CP-02 · Producto válido (0,4 kg de carne, categoría Carnes) se envía normalizado", () => {
    montar();
    nombre().type("Churrasco 400 g");
    precio().type("45000");
    categoria().select("Carnes");
    agregarInsumo("Punta de anca");
    cantidad().should("have.value", "0.1");          // valor inicial para insumos en kg
    cantidad().clear().type("0.4");
    guardar().click();
    cy.get("@onSubmit").should("have.been.calledWith", {
      nombre: "Churrasco 400 g", precio_venta: 45000, costo_produccion: 0,
      categoria_id: "c-carnes", insumos: [{ insumo_id: "i-carne", cantidad_requerida: 0.4 }],
    });
  });

  it("CP-03 · Nombre vacío NO debe enviarse (RNF-08)", () => {
    montar();
    precio().type("45000");
    agregarInsumo("Punta de anca");
    guardar().click();
    cy.get("@onSubmit").should("not.have.been.called");
  });

  it("CP-04 · Precio de venta vacío NO debe enviarse (RNF-08)", () => {
    montar();
    nombre().type("Churrasco 400 g");
    agregarInsumo("Punta de anca");
    guardar().click();
    cy.get("@onSubmit").should("not.have.been.called");
  });

  it("CP-05 · Valores límite de cantidad en 'unidad': 0 y 1,5 inválidos; 1 y 2 válidos", () => {
    montar();
    agregarInsumo("Papa criolla");
    cantidad().should("have.value", "1");
    cantidad().clear().type("1.5").then(($i) => expect($i[0].checkValidity()).to.eq(false));
    cantidad().clear().type("0").then(($i) => expect($i[0].checkValidity()).to.eq(false));
    cantidad().clear().type("2").then(($i) => expect($i[0].checkValidity()).to.eq(true));
  });

  it("CP-06 · Edición: muestra margen positivo en verde (45.000 − 15.000)", () => {
    montar({ editing: { id: "p-1", nombre: "Churrasco", precio_venta: 45000, costo_produccion: 15000,
      categoria_id: "c-carnes", insumos: [{ insumo_id: "i-carne", cantidad_requerida: 0.5 }] } });
    cy.contains("Margen: +$30.000 (66.7%)").should("have.class", "text-emerald-400");
  });

  it("CP-07 · Edición: costo > precio muestra margen negativo en rojo (RF-10)", () => {
    montar({ editing: { id: "p-2", nombre: "Plato caro", precio_venta: 45000, costo_produccion: 50000,
      categoria_id: "", insumos: [{ insumo_id: "i-carne", cantidad_requerida: 1 }] } });
    cy.contains("Margen: $-5.000").should("have.class", "text-red-400");
    cy.contains("button", "Guardar cambios").click();          // camino C3: costo > 0, sin categoría
    cy.get("@onSubmit").should("have.been.calledWithMatch", { costo_produccion: 50000, categoria_id: null });
  });

  it("CP-08 · Valor límite RF-10: costo = precio debe mostrarse como alerta (rojo)", () => {
    montar({ editing: { id: "p-3", nombre: "Plato justo", precio_venta: 45000, costo_produccion: 45000,
      categoria_id: "", insumos: [{ insumo_id: "i-carne", cantidad_requerida: 1 }] } });
    cy.contains("Margen:").should("have.class", "text-red-400");   // RF-10: "supere o iguale"
  });

  it("CP-09 · Producto sin categoría se envía con categoria_id = null y costo 0", () => {
    montar();
    nombre().type("Limonada de coco");
    precio().type("9000");
    agregarInsumo("Papa criolla");
    guardar().click();
    cy.get("@onSubmit").should("have.been.calledWithMatch", { categoria_id: null, costo_produccion: 0 });
  });
});
