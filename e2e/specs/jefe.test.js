import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { crearDriver, evidencia } from "../support/driver.js";
import { USUARIOS, DATOS } from "../config.js";
import { LoginPage } from "../pages/LoginPage.js";
import { InventarioPage } from "../pages/InventarioPage.js";
import { MenuPage } from "../pages/MenuPage.js";
import { DashboardPage } from "../pages/DashboardPage.js";
import { PedidosPage } from "../pages/PedidosPage.js";
import { HistorialPage } from "../pages/HistorialPage.js";

const sufijo = Date.now().toString().slice(-6);

describe("Aceptación · rol JEFE", { timeout: 180_000 }, () => {
  let driver;

  before(async () => {
    driver = await crearDriver();
    const login = new LoginPage(driver);
    await login.ingresar(USUARIOS.jefe);
    await login.esperarUrl("/dashboard");
  });

  after(async () => { await driver?.quit(); });

  it("CA003 · Insumo bajo el mínimo aparece en estado Crítico (RF-14, RF-15)", async () => {
    const inv = new InventarioPage(driver);
    const nombre = `Sal marina ${sufijo}`;
    await inv.irA("Inventario", "/inventory");
    await inv.crearInsumo({ nombre, tipo: "Insumo general", unidad: "kg", stock: 1, minimo: 5, costo: 2000 });
    await inv.buscar(nombre);
    await inv.estadoVisible("Crítico");
    await evidencia(driver, "CA003", 1, "insumo-critico");
  });

  it("CA004 · Producto con receta calcula su costo (RF-06, RF-07)", async () => {
    const menu = new MenuPage(driver);
    const nombre = `Punta 400 g ${sufijo}`;
    await menu.irA("Menú", "/menu");
    await menu.crearProducto({ nombre, precio: 48000, insumo: DATOS.insumo.nombre, cantidad: 0.4 });
    const fila = await menu.filaDe(nombre);
    await evidencia(driver, "CA004", 1, "producto-creado");
    assert.match(await fila.getText(), /\$12[.,]?000/);   // 0,4 kg × $30.000
  });

  it("CA005 · El dashboard refleja un pedido completado en < 5 s (RF-20, RNF-06)", async () => {
    const dash = new DashboardPage(driver);
    const ped  = new PedidosPage(driver);
    await dash.irA("Dashboard", "/dashboard");
    await dash.periodo("Diario");
    const ingresosAntes = await dash.valor("Ingresos");
    await evidencia(driver, "CA005", 1, "dashboard-antes");

    await ped.irA("Pedidos", "/pedidos");
    await ped.abrirModalNuevo();
    await ped.elegirPlato(DATOS.producto.nombre);
    await ped.confirmarPedido();
    await ped.completarPrimerPendiente("Efectivo");

    await dash.irA("Dashboard", "/dashboard");
    await dash.periodo("Diario");
    const inicio = Date.now();
    await driver.wait(async () => (await dash.valor("Ingresos")) >= ingresosAntes + DATOS.producto.precio, 5_000);
    await evidencia(driver, "CA005", 2, "dashboard-despues");
    assert.ok(Date.now() - inicio < 5_000);
  });

  it("CA006 · Filtrar el historial por acción muestra solo esa acción (RF-23)", async () => {
    const hist = new HistorialPage(driver);
    await hist.irA("Historial", "/historial");
    await hist.filtrarAccion("CREAR");
    await evidencia(driver, "CA006", 1, "filtro-crear");
    const acciones = await hist.accionesEnTabla();
    assert.ok(acciones.length > 0, "No hay registros para evaluar");
    assert.ok(acciones.every((a) => a.trim() === "CREAR"), `Acciones encontradas: ${[...new Set(acciones)].join(", ")}`);
  });
});
