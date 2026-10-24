import InventoryModal from "./InventoryModal";

const campo   = (etiqueta) => cy.contains("label", etiqueta).parent().find("input, select");
const nombre  = () => cy.get('input[placeholder^="Ej: Carne de res"]');
const crear   = () => cy.contains("button", "Crear insumo");
const esValido = (etiqueta, esperado) =>
  campo(etiqueta).then(($el) => expect($el[0].checkValidity(), etiqueta).to.eq(esperado));

const montar = (props = {}) => cy.mount(
  <InventoryModal isOpen editing={null}
    onAdd={cy.stub().as("onAdd").resolves()} onEdit={cy.stub().as("onEdit").resolves()}
    onClose={cy.stub().as("onClose")} {...props} />,
);

describe("Módulo 2 · Inventario – Nuevo / editar insumo (InventoryModal)", () => {
  it("CP-01 · Nombre vacío (solo espacios) muestra 'El nombre es requerido'", () => {
    montar();
    nombre().type("   ");
    crear().click();
    cy.contains("El nombre es requerido").should("be.visible");
    cy.get("@onAdd").should("not.have.been.called");
  });

  it("CP-02 · Insumo válido de tipo carne en kg se crea con valores numéricos", () => {
    montar();
    nombre().type("Punta de anca");
    campo("Tipo").select("carne");
    campo("Unidad").select("kg");
    campo("Stock actual").type("10");
    campo("Stock mínimo").type("2");
    campo("Costo unit.").type("30000");
    crear().click();
    cy.get("@onAdd").should("have.been.calledWith", {
      nombre: "Punta de anca", tipo: "carne", unidad_medida: "kg",
      stock_actual: 10, stock_minimo: 2, costo_unitario_prom: 30000,
    });
    cy.get("@onClose").should("have.been.calledOnce");
  });

  it("CP-03 · Campos numéricos vacíos se envían como 0", () => {
    montar();
    nombre().type("Sal gruesa");
    crear().click();
    cy.get("@onAdd").should("have.been.calledWithMatch",
      { stock_actual: 0, stock_minimo: 0, costo_unitario_prom: 0 });
  });

  it("CP-04 · Stock negativo es inválido y bloquea el envío (validación HTML5)", () => {
    montar();
    nombre().type("Carbón");
    campo("Stock actual").type("-1");
    esValido("Stock actual", false);
    crear().click();
    cy.get("@onAdd").should("not.have.been.called");
  });

  it("CP-05 · Valores límite del paso 0,01: 0,01 válido y 0,001 inválido", () => {
    montar();
    campo("Stock mínimo").type("0.01");
    esValido("Stock mínimo", true);
    campo("Stock mínimo").clear().type("0.001");
    esValido("Stock mínimo", false);
  });

  it("CP-06 · Costo unitario con decimales (1500,5) queda inválido (step = 1)", () => {
    montar();
    campo("Costo unit.").type("1500.5");
    esValido("Costo unit.", false);   // hallazgo de usabilidad: no admite centavos
  });

  it("CP-07 · Edición: limpia ceros ('2.0000' → 2) y llama a onEdit con el id", () => {
    montar({ editing: { id: "ins-1", nombre: "Sal", tipo: "insumo", unidad_medida: "kg",
      stock_actual: "2.0000", stock_minimo: "1.0000", costo_unitario_prom: "800.00" } });
    campo("Stock actual").should("have.value", "2");
    cy.contains("button", "Guardar cambios").click();
    cy.get("@onEdit").should("have.been.calledWith", "ins-1",
      { nombre: "Sal", tipo: "insumo", unidad_medida: "kg", stock_actual: 2, stock_minimo: 1, costo_unitario_prom: 800 });
  });

  it("CP-08 · Error del servidor se muestra y el modal no se cierra", () => {
    montar({ onAdd: cy.stub().as("onAdd").rejects({ response: { data: { message: "Ya existe un insumo con ese nombre" } } }) });
    nombre().type("Sal");
    crear().click();
    cy.contains("Ya existe un insumo con ese nombre").should("be.visible");
    cy.get("@onClose").should("not.have.been.called");
  });

  it("CP-09 · Edición que falla sin mensaje del servidor usa 'Error al editar el insumo'", () => {
    montar({
      editing: { id: "ins-1", nombre: "Sal", tipo: "insumo", unidad_medida: "kg" },
      onEdit: cy.stub().as("onEdit").rejects(new Error("Network Error")),
    });
    cy.contains("button", "Guardar cambios").click();
    cy.contains("Error al editar el insumo").should("be.visible");
  });
});
