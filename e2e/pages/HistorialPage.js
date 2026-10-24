import { By } from "selenium-webdriver";
import { BasePage } from "./BasePage.js";

export class HistorialPage extends BasePage {
  async filtrarAccion(accion) {
    const select = await this.visible(By.xpath("//select[option[normalize-space(.)='Todas las acciones']]"));
    await select.sendKeys(accion);
    await this.driver.sleep(800);                 // debounce de 400 ms + respuesta
  }
  async accionesEnTabla() {
    // celdas de la columna "Acción" (posición calculada desde el encabezado)
    const col = "count(//table//thead//th[normalize-space(.)='Acción']/preceding-sibling::th)+1";
    const badges = await this.driver.findElements(By.xpath(`//table//tbody/tr/td[${col}]`));
    return Promise.all(badges.map((b) => b.getText()));
  }
}
