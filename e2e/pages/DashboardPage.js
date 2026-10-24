import { By } from "selenium-webdriver";
import { BasePage } from "./BasePage.js";

export class DashboardPage extends BasePage {
  tarjeta(etiqueta) {
    return By.xpath(`//p[normalize-space(.)='${etiqueta}']/following-sibling::*[1]`);
  }
  async valor(etiqueta) {                          // "$1,234,000" → 1234000
    const txt = await (await this.visible(this.tarjeta(etiqueta))).getText();
    return Number(txt.replace(/[^\d-]/g, ""));
  }
  async periodo(nombre) {
    await this.click(this.botonConTexto(nombre));
    await this.driver.sleep(1500);                // deja que el store recargue las métricas del período
  }
}
