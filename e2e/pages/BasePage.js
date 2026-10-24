import { By, Key, until } from "selenium-webdriver";
import { BASE_URL, TIMEOUT } from "../config.js";

// Ctrl+A + Retroceso dispara los eventos "input" que React escucha (el clear() de WebDriver no siempre lo hace)
const MOD = process.platform === "darwin" ? Key.COMMAND : Key.CONTROL;

export class BasePage {
  constructor(driver) { this.driver = driver; }

  abrir(ruta) { return this.driver.get(`${BASE_URL}${ruta}`); }

  async visible(locator) {
    const el = await this.driver.wait(until.elementLocated(locator), TIMEOUT);
    await this.driver.wait(until.elementIsVisible(el), TIMEOUT);
    return el;
  }

  async click(locator) {
    const el = await this.visible(locator);
    await this.driver.wait(until.elementIsEnabled(el), TIMEOUT);
    await el.click();
  }

  async escribir(locator, texto) {
    const el = await this.visible(locator);
    await el.sendKeys(Key.chord(MOD, "a"), Key.BACK_SPACE);
    await el.sendKeys(String(texto));
  }

  async contar(locator) { return (await this.driver.findElements(locator)).length; }

  esperarUrl(fragmento) { return this.driver.wait(until.urlContains(fragmento), TIMEOUT); }

  /** Navega con el menú lateral, sin recargar la SPA (un driver.get directo pierde la ruta: ver DEF-18). */
  async irA(modulo, fragmentoUrl) {
    await this.click(By.xpath(`//nav//button[.//span[normalize-space(.)='${modulo}']]`));
    if (fragmentoUrl) await this.esperarUrl(fragmentoUrl);
  }

  /** Cambia de ruta dentro de la SPA (útil cuando el menú lateral está colapsado, p. ej. a 768 px). */
  async navegarSpa(ruta) {
    await this.driver.executeScript(
      "window.history.pushState({}, '', arguments[0]); window.dispatchEvent(new PopStateEvent('popstate'));", ruta);
    await this.esperarUrl(ruta);
  }

  // Localizadores por texto visible (la UI no tiene data-testid todavía)
  boton(texto)          { return By.xpath(`//button[normalize-space(.)='${texto}']`); }
  botonConTexto(texto)  { return By.xpath(`//button[contains(normalize-space(.), '${texto}')]`); }
  campoPorEtiqueta(etq) { return By.xpath(`//label[starts-with(normalize-space(.), '${etq}')]/following-sibling::*[self::input or self::select][1]`); }
  badge(texto)          { return By.xpath(`//span[contains(@class,'rounded-full') and normalize-space(.)='${texto}']`); }
}
