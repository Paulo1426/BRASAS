import fs from "node:fs/promises";
import { Builder, Browser } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import firefox from "selenium-webdriver/firefox.js";
import edge from "selenium-webdriver/edge.js";

export const NAVEGADOR = (process.env.BROWSER ?? "chrome").toLowerCase();
const HEADLESS = process.env.HEADLESS === "1";

/** Crea el WebDriver. Selenium Manager (incluido desde Selenium 4.6) descarga
 *  y actualiza automáticamente chromedriver / geckodriver / msedgedriver. */
export async function crearDriver({ ancho = 1366, alto = 900 } = {}) {
  const builder = new Builder();
  if (NAVEGADOR === "firefox") {
    const o = new firefox.Options(); if (HEADLESS) o.addArguments("-headless");
    builder.forBrowser(Browser.FIREFOX).setFirefoxOptions(o);
  } else if (NAVEGADOR === "edge") {
    const o = new edge.Options(); if (HEADLESS) o.addArguments("--headless=new");
    builder.forBrowser(Browser.EDGE).setEdgeOptions(o);
  } else {
    const o = new chrome.Options(); if (HEADLESS) o.addArguments("--headless=new");
    builder.forBrowser(Browser.CHROME).setChromeOptions(o);
  }
  const driver = await builder.build();
  await driver.manage().window().setRect({ width: ancho, height: alto });
  return driver;
}

/** Guarda un pantallazo numerado: evidencias/<navegador>/<caso>/<paso>.png */
export async function evidencia(driver, caso, paso, descripcion = "") {
  const dir = `evidencias/${NAVEGADOR}/${caso}`;
  await fs.mkdir(dir, { recursive: true });
  const nombre = `${String(paso).padStart(2, "0")}${descripcion ? "-" + descripcion : ""}.png`;
  await fs.writeFile(`${dir}/${nombre}`, await driver.takeScreenshot(), "base64");
}
