import { defineConfig } from "cypress";

export default defineConfig({
  video: false,
  screenshotOnRunFailure: true,
  // Pruebas unitarias (sección 2.3) e integración de módulos de la capa de presentación (CI-A01)
  component: {
    devServer: { framework: "react", bundler: "vite" },
    specPattern: "src/**/*.cy.{js,jsx}",
    viewportWidth: 1280,
    viewportHeight: 800,
  },
  // Integración de la Interfaz Web P1 con los módulos (CI-A05, CI-A09, CI-DP1, CI-DP2) y del sistema completo (CI-A12)
  e2e: {
    baseUrl: "http://localhost:5173",
    specPattern: "cypress/e2e/**/*.cy.js",
    supportFile: "cypress/support/e2e.js",
    viewportWidth: 1366,
    viewportHeight: 900,
  },
});
