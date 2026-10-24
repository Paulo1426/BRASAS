import { mount } from "cypress/react";
import "../../src/index.css"; // estilos Tailwind reales del proyecto

Cypress.Commands.add("mount", mount);

// Evidencia: una captura del runner por caso CP-xx (carpeta cypress/screenshots/<spec>/)
afterEach(function () {
  const id = (this.currentTest.title.match(/CP-\d+/) || [])[0];
  if (id) cy.screenshot(id, { capture: "runner", overwrite: true });
});
