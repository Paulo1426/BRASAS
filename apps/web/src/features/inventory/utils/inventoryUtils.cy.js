import { getStockStatus, getStockPercentage } from "./inventoryUtils";

const semaforo = (actual, minimo) => getStockStatus({ stock_actual: actual, stock_minimo: minimo }).label;

describe("Módulo 2 · Inventario – Semáforo de stock (inventoryUtils)", () => {
  it("CP-10 · Valores límite con stock mínimo 4", () => {
    expect(semaforo(4, 4)).to.eq("Crítico");     // actual = mínimo
    expect(semaforo(4.01, 4)).to.eq("Bajo");     // justo por encima del mínimo
    expect(semaforo(6, 4)).to.eq("Bajo");        // actual = 1,5 × mínimo
    expect(semaforo(6.01, 4)).to.eq("OK");       // justo por encima de 1,5 × mínimo
  });

  it("CP-11 · Acepta los NUMERIC que devuelve PostgreSQL como texto", () => {
    expect(semaforo("2.000", "4.000")).to.eq("Crítico");
  });

  it("CP-12 · Porcentaje de la barra nunca supera 100 % ni es negativo", () => {
    expect(getStockPercentage({ stock_actual: 50, stock_minimo: 4 })).to.eq(100);
    expect(getStockPercentage({ stock_actual: 0, stock_minimo: 0 })).to.eq(0);
  });
});
