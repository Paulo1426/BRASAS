import { By } from "selenium-webdriver";
import { BasePage } from "./BasePage.js";

export class LoginPage extends BasePage {
  async ingresar({ email, password }) {
    await this.abrir("/login");
    await this.escribir(By.css('input[type="email"]'), email);
    await this.escribir(By.css('input[type="password"]'), password);
    await this.click(By.css('button[type="submit"]'));
  }
}
