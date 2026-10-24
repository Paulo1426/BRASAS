import { By } from "selenium-webdriver";
import { BasePage } from "./BasePage.js";

export class MenuPage extends BasePage {
  async crearProducto({ nombre, precio, insumo, cantidad }) {
    await this.click(this.botonConTexto("Nuevo Producto"));
    await this.escribir(By.css('input[placeholder^="Ej: Chuleta"]'), nombre);
    await this.escribir(this.campoPorEtiqueta("Precio de venta"), precio);
    await this.click(this.boton("+ Agregar insumo"));
    await this.click(this.botonConTexto("Seleccionar insumo"));
    await this.click(By.xpath(`//button[.//span[normalize-space(.)='${insumo}']]`));
    await this.escribir(By.xpath("//span[normalize-space(.)='Cantidad:']/following-sibling::input"), cantidad);
    await this.click(this.boton("Crear producto"));
  }

  filaDe(nombre) { return this.visible(By.xpath(`//table//tr[.//*[normalize-space(.)='${nombre}']]`)); }
  columnaCosto() { return By.xpath("//table//th[normalize-space(.)='Costo Prod.']"); }
}
