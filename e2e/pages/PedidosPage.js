import { By } from "selenium-webdriver";
import { BasePage } from "./BasePage.js";

export class PedidosPage extends BasePage {
  contadorCantidad = By.xpath("//form//span[contains(@class,'w-8')]");
  totalEstimado    = By.xpath("//span[normalize-space(.)='Total estimado']/following-sibling::span");

  async abrirModalNuevo() { await this.click(this.botonConTexto("Nuevo Pedido")); }

  async elegirPlato(nombre) {
    await this.click(this.botonConTexto("Seleccionar plato"));
    await this.click(By.xpath(`//button[.//p[normalize-space(.)='${nombre}']]`));
  }

  async aumentarCantidad(veces) {
    for (let i = 0; i < veces; i++) {
      await this.click(By.xpath("(//form//span[contains(@class,'w-8')])[1]/following-sibling::button[1]"));
    }
  }

  async total() { return (await this.visible(this.totalEstimado)).getText(); }
  async confirmarPedido() { await this.click(this.boton("Crear pedido")); }

  async completarPrimerPendiente(metodo = "Efectivo") {
    await this.click(By.xpath("(//button[normalize-space(.)='Completar'])[1]"));
    await this.click(By.xpath(`//button[.//p[normalize-space(.)='${metodo}']]`));
    await this.click(this.boton("Confirmar"));
  }
}
