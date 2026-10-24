// Portabilidad / adaptabilidad (RNF-09): pantallas a 768 px sin desbordamiento horizontal
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { crearDriver, evidencia } from "../support/driver.js";
import { USUARIOS } from "../config.js";
import { LoginPage } from "../pages/LoginPage.js";

const RUTAS = ["/dashboard", "/pedidos", "/inventory", "/menu", "/historial"];

describe("Portabilidad · tablet 768 × 1024", { timeout: 120_000 }, () => {
  let driver, login;
  before(async () => {
    driver = await crearDriver({ ancho: 768, alto: 1024 });
    login = new LoginPage(driver);
    await login.ingresar(USUARIOS.jefe);
    await login.esperarUrl("/dashboard");
  });
  after(async () => { await driver?.quit(); });

  for (const ruta of RUTAS) {
    it(`PT-768 · ${ruta} sin scroll horizontal`, async () => {
      await login.navegarSpa(ruta);           // a 768 px el menú lateral está colapsado
      await driver.sleep(1500);
      await evidencia(driver, "PT-768", RUTAS.indexOf(ruta) + 1, ruta.slice(1));
      const desborde = await driver.executeScript(
        "return document.documentElement.scrollWidth - document.documentElement.clientWidth;");
      assert.ok(desborde <= 0, `${ruta} desborda ${desborde}px`);
    });
  }
});
