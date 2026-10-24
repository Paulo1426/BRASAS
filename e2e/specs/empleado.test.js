import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { By } from "selenium-webdriver";
import { crearDriver, evidencia } from "../support/driver.js";
import { USUARIOS, DATOS } from "../config.js";
import { LoginPage } from "../pages/LoginPage.js";
import { PedidosPage } from "../pages/PedidosPage.js";
import { MenuPage } from "../pages/MenuPage.js";

describe("Aceptación · rol EMPLEADO", { timeout: 120_000 }, () => {
  let driver, login, pedidos, menu;

  before(async () => {
    driver  = await crearDriver();
    login   = new LoginPage(driver);
    pedidos = new PedidosPage(driver);
    menu    = new MenuPage(driver);
    await login.ingresar(USUARIOS.empleado);
    await login.esperarUrl("/empleado/pedidos");
  });

  after(async () => { await driver?.quit(); });

  it("CA001 · Crear pedido con total automático (RF-16, RF-17)", async () => {
    await evidencia(driver, "CA001", 1, "mis-pedidos");
    const pendientesAntes = await pedidos.contar(pedidos.badge("Pendiente"));
    await pedidos.abrirModalNuevo();
    await pedidos.elegirPlato(DATOS.producto.nombre);
    await pedidos.aumentarCantidad(1);
    await evidencia(driver, "CA001", 2, "pedido-armado");
    assert.equal(await pedidos.total(), "$90.000");
    await pedidos.confirmarPedido();
    await driver.wait(async () => (await pedidos.contar(pedidos.badge("Pendiente"))) === pendientesAntes + 1, 10_000);
    await evidencia(driver, "CA001", 3, "pedido-creado");
  });

  it("CA002 · Completar pedido registrando el pago (RF-13, RF-16)", async () => {
    const completadosAntes = await pedidos.contar(pedidos.badge("Completado"));
    await pedidos.completarPrimerPendiente("Efectivo");
    await driver.wait(async () => (await pedidos.contar(pedidos.badge("Completado"))) === completadosAntes + 1, 10_000);
    await evidencia(driver, "CA002", 1, "pedido-completado");
  });

  it("CA007 · El empleado no puede abrir el dashboard financiero (RF-03)", async () => {
    await pedidos.abrir("/dashboard");
    await pedidos.esperarUrl("/empleado/pedidos");
    await evidencia(driver, "CA007", 1, "redirigido");
  });

  it("CA008 · El menú del empleado no muestra costo ni margen (RF-09)", async () => {
    await menu.irA("Menú", "/empleado/menu");
    await menu.filaDe(DATOS.producto.nombre);
    await evidencia(driver, "CA008", 1, "menu-empleado");
    assert.equal(await menu.contar(menu.columnaCosto()), 0, "La columna 'Costo Prod.' es visible para el EMPLEADO");
    assert.equal(await menu.contar(By.xpath("//table//th[normalize-space(.)='Margen']")), 0, "La columna 'Margen' es visible para el EMPLEADO");
  });
});
