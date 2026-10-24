import { By } from "selenium-webdriver";
import { BasePage } from "./BasePage.js";

export class InventarioPage extends BasePage {
  async crearInsumo({ nombre, tipo, unidad, stock, minimo, costo }) {
    await this.click(this.botonConTexto("Agregar Insumo"));
    await this.escribir(By.css('input[placeholder^="Ej: Carne de res"]'), nombre);
    await (await this.visible(this.campoPorEtiqueta("Tipo"))).sendKeys(tipo);       // texto visible de la opción
    await (await this.visible(this.campoPorEtiqueta("Unidad"))).sendKeys(unidad);
    await this.escribir(this.campoPorEtiqueta("Stock actual"), stock);
    await this.escribir(this.campoPorEtiqueta("Stock mínimo"), minimo);
    await this.escribir(this.campoPorEtiqueta("Costo unit."), costo);
    await this.click(this.boton("Crear insumo"));
  }

  async buscar(texto) { await this.escribir(By.css('input[placeholder="Buscar insumo..."]'), texto); }
  estadoVisible(estado) { return this.visible(By.xpath(`//*[normalize-space(.)='${estado}']`)); }
}
