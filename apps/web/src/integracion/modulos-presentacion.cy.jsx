/**
 * P2–P6 · Módulos de la capa de presentación montados SOLOS (hojas de la integración ascendente, CI-A01).
 * Cada página se integra con su store (Zustand), su servicio y services/api.js (Axios);
 * el backend se reemplaza con cy.intercept (stub) y la sesión se precarga en useAuthStore (driver).
 */
import { OrdersPage } from "../features/orders/components/OrdersPage";
import { InventoryPage } from "../features/inventory/components/InventoryPage";
import { MenuPage } from "../features/menu/components/MenuPage";
import DashboardPage from "../features/dashboard/components/DashboardPage";
import { MemoryRouter } from "react-router-dom";
import { HistoryPage } from "../features/history/components/HistoryPage";
import { useAuthStore } from "../features/auth/stores/useAuthStore";
import { useOrdersStore } from "../features/orders/stores/useOrdersStore";
import { useMenuStore } from "../features/menu/stores/useMenuStore";
import useInventoryStore from "../features/inventory/stores/useInventoryStore";
import { useHistoryStore } from "../features/history/stores/useHistoryStore";
import useDashboardStore from "../features/dashboard/stores/useDashboardStore";

const API = "**/api/v1";
const PEDIDO = { id: "9f1c2a7e-0000-4000-8000-000000000001", estado: "pendiente", total: "90000.00", empleado_nombre: "Ana", items: [] };
const PRODUCTO = { id: "p-churrasco", nombre: "Churrasco 400 g", precio_venta: 45000, costo_produccion: 15000, categoria: "Carnes", categoria_id: "c-1" };
const INSUMOS = [
  { id: "i-1", nombre: "Punta de anca", tipo: "carne", unidad_medida: "kg", stock_actual: "1.500", stock_minimo: "3.000", costo_unitario_prom: "30000" },
  { id: "i-2", nombre: "Sal marina", tipo: "insumo", unidad_medida: "kg", stock_actual: "20.000", stock_minimo: "2.000", costo_unitario_prom: "2000" },
];

/** Driver: sesión de JEFE en el store y estado limpio de los stores de cada módulo. */
const sesionJefe = () => {
  useAuthStore.setState({ user: { id: "u-jefe", nombre: "Jefe Prueba", rol: "JEFE" }, isAuthenticated: true });
  useOrdersStore.setState({ orders: [], error: null });
  useMenuStore.setState({ items: [], error: null });
  useInventoryStore.setState({ insumos: [], movimientos: [], error: null });
  useHistoryStore.getState().reset();
  useDashboardStore.setState({ periodo: "dia" });
};

beforeEach(() => {
  cy.intercept("GET", `${API}/**`, { body: [] });             // cualquier otra consulta: lista vacía
  sesionJefe();
});

describe("P2 · Pedidos (OrdersPage + useOrdersStore + ordersService)", () => {
  it("P2-01 · Como JEFE consulta /pedidos/todos y pinta la tarjeta del pedido", () => {
    cy.intercept("GET", `${API}/pedidos/todos*`, { body: [PEDIDO] }).as("todos");
    cy.mount(<OrdersPage />);
    cy.wait("@todos");
    cy.contains("#9f1c2a7e").should("exist");
    cy.contains("button", "Completar").should("exist");          // acción disponible para un pedido pendiente
  });

  it("P2-02 · Crear pedido envía POST /pedidos con los ítems y agrega la tarjeta", () => {
    cy.intercept("GET", `${API}/productos`, { body: [PRODUCTO] });
    cy.intercept("POST", `${API}/pedidos`, { statusCode: 201, body: { ...PEDIDO, id: "9f1c2a7e-0000-4000-8000-000000000002" } }).as("crear");
    cy.mount(<OrdersPage />);
    cy.contains("button", "Nuevo Pedido").click();
    cy.contains("button", "Seleccionar plato...").click();
    cy.contains("button", "Churrasco 400 g").click();
    cy.contains("button", "Crear pedido").click();
    cy.wait("@crear").its("request.body").should("deep.equal", { items: [{ producto_id: "p-churrasco", cantidad: 1 }] });
    cy.contains("#9f1c2a7e").should("exist");
  });

  it("P2-03 · Completar con pago en efectivo envía PUT /pedidos/:id/estado con el pago normalizado", () => {
    cy.intercept("GET", `${API}/pedidos/todos*`, { body: [PEDIDO] });
    cy.intercept("PUT", `${API}/pedidos/*/estado`, { body: { ...PEDIDO, estado: "completado", metodo_pago: "efectivo" } }).as("estado");
    cy.mount(<OrdersPage />);
    cy.contains("button", "Completar").click();
    cy.contains("button", "Efectivo").click();
    cy.contains("button", "Confirmar").click();
    cy.wait("@estado").its("request.body").should("deep.equal", {
      estado: "completado", pago: { metodo: "efectivo", efectivo: "90000.00", transferencia: 0 },
    });
    cy.contains("button", "Completar").should("not.exist");     // la tarjeta pasó a estado final
  });
});

describe("P3 · Inventario (InventoryPage + useInventoryStore + inventoryService)", () => {
  it("P3-01 · Lista los insumos y marca en Crítico el que está bajo el mínimo", () => {
    cy.intercept("GET", `${API}/inventario/insumos`, { body: INSUMOS }).as("insumos");
    cy.mount(<InventoryPage />);
    cy.wait("@insumos");
    cy.contains("h3", "Punta de anca").should("exist");
    cy.contains("h3", "Sal marina").should("exist");
    cy.contains("Crítico").should("exist");                         // 1,5 kg con mínimo 3 kg
  });

  it("P3-02 · Agregar insumo envía POST /inventario/insumos y la tarjeta aparece", () => {
    cy.intercept("GET", `${API}/inventario/insumos`, { body: [] });
    cy.intercept("POST", `${API}/inventario/insumos`, (req) => req.reply(201, { id: "i-3", ...req.body })).as("crear");
    cy.mount(<InventoryPage />);
    cy.contains("button", "Agregar Insumo").click();
    cy.get('input[placeholder^="Ej: Carne de res"]').type("Carbón vegetal");
    cy.contains("button", "Crear insumo").click();
    cy.wait("@crear").its("request.body").should("include", { nombre: "Carbón vegetal", tipo: "insumo" });
    cy.contains("h3", "Carbón vegetal").should("exist");
  });
});

describe("P4 · Menú y costeo (MenuPage + useMenuStore + menuService)", () => {
  it("P4-01 · Lista los productos con precio, costo y margen para el JEFE", () => {
    cy.intercept("GET", `${API}/productos`, { body: [PRODUCTO] }).as("productos");
    cy.mount(<MenuPage />);
    cy.wait("@productos");
    cy.contains("tr", "Churrasco 400 g").should("contain", "45").and("contain", "30");
  });

  it("P4-02 · Crear producto pide los insumos, envía POST /productos con la receta y agrega la fila", () => {
    cy.intercept("GET", `${API}/productos`, { body: [] });
    cy.intercept("GET", `${API}/inventario/insumos`, { body: INSUMOS }).as("insumos");
    cy.intercept("POST", `${API}/productos`, (req) => req.reply(201, { id: "p-nuevo", ...req.body })).as("crear");
    cy.mount(<MenuPage />);
    cy.contains("button", "Nuevo Producto").click();
    cy.wait("@insumos");
    cy.get('input[placeholder^="Ej: Chuleta"]').type("Punta 400 g");
    cy.contains("label", "Precio de venta").parent().find("input").type("48000");
    cy.contains("button", "+ Agregar insumo").click();
    cy.contains("button", "Seleccionar insumo...").click();
    cy.contains("button", "Punta de anca").click();
    cy.contains("button", "Crear producto").click();
    cy.wait("@crear").its("request.body.insumos").should("deep.equal", [{ insumo_id: "i-1", cantidad_requerida: 0.1 }]);
    cy.contains("tr", "Punta 400 g").should("exist");
  });
});

describe("P5 · Dashboard (DashboardPage + useDashboardStore + dashboardService)", () => {
  const RESUMEN = { ingresos: 100000, costo_total: 50000, utilidad: 50000, margen: 50, utilidad_positiva: true, periodo_anterior: { variacion_utilidad: 10 } };

  it("P5-01 · Carga el período Diario y muestra Ingresos y Costos del resumen", () => {
    cy.intercept("GET", `${API}/reportes/resumen*`, { body: RESUMEN }).as("resumen");
    cy.mount(<MemoryRouter><DashboardPage /></MemoryRouter>);
    cy.wait("@resumen").its("request.query.periodo").should("eq", "diario");
    cy.contains("p", "Ingresos").next().invoke("text").should("match", /100[.,]000/);
  });

  it("P5-02 · Cambiar a Semanal vuelve a consultar con periodo=semanal", () => {
    cy.intercept("GET", `${API}/reportes/resumen*`, { body: RESUMEN }).as("resumen");
    cy.mount(<MemoryRouter><DashboardPage /></MemoryRouter>);
    cy.wait("@resumen");
    cy.contains("button", "Semanal").click();
    cy.wait("@resumen").its("request.query.periodo").should("eq", "semanal");
  });

  it("P5-03 · Las secciones de productos e historial terminan de cargar y muestran los datos", () => {
    cy.intercept("GET", `${API}/reportes/resumen*`, { body: RESUMEN });
    cy.intercept("GET", `${API}/reportes/turno`, { body: { top_productos: [{ nombre: "Churrasco 400 g", total_vendido: "5" }] } }).as("turno");
    cy.intercept("GET", `${API}/pedidos`, { body: [PEDIDO] }).as("pedidos");
    cy.mount(<MemoryRouter><DashboardPage /></MemoryRouter>);
    cy.wait(["@turno", "@pedidos"]);
    cy.contains("Productos más rentables", { timeout: 6000 }).should("exist");
    cy.contains("Historial de Acciones").should("exist");
  });
});

describe("P6 · Historial (HistoryPage + useHistoryStore + historyService)", () => {
  const FILA = { id: "h-1", accion: "CREAR", entidad: "pedidos", entidad_id: PEDIDO.id, usuario_nombre: "Ana", detalle: { descripcion: "Pedido creado" }, created_at: new Date().toISOString() };

  it("P6-01 · Consulta /historial (página 1, límite 20) y pinta la tabla del JEFE", () => {
    cy.intercept("GET", `${API}/historial*`, { body: { data: [FILA], total: 1 } }).as("historial");
    cy.mount(<HistoryPage />);
    cy.wait("@historial").its("request.query").should("deep.include", { page: "1", limit: "20" });
    cy.contains("Historial operativo del negocio").should("exist");
    cy.contains("td", "Pedido creado").should("exist");
  });

  it("P6-02 · Elegir la acción CREAR vuelve a consultar con el filtro de acción", () => {
    cy.intercept("GET", `${API}/historial*`, { body: { data: [FILA], total: 1 } }).as("historial");
    cy.mount(<HistoryPage />);
    cy.wait("@historial");
    cy.contains("option", "Todas las acciones").parent("select").select("CREAR");
    cy.wait("@historial").its("request.query").should("have.property", "accion", "CREAR");
  });
});
