/**
 * N2 · Inventario con el servicio REAL (inventario.service) y la BD simulada (stub de D1)
 * - Hoja (CI-A02): el driver invoca createMovimiento / createInsumo.
 * - Integrado (CI-A06, CI-A10, CI-DP4, CI-DA4): petición HTTP → controller → service.
 */
jest.mock('../../../src/shared/database/db', () => require('../../helpers/fakeDb').crearFakeDb());

const request = require('supertest');
const app = require('../../../src/app');
const db = require('../../../src/shared/database/db');
const inventarioService = require('../../../src/features/inventario/inventario.service');
const { IDS, tokenPara } = require('../../helpers/auth');

const INSUMO_ID = '33333333-3333-4333-8333-333333333333';

/** Insumo con stock 10 kg y mínimo 3 kg; el UPDATE aplica el signo igual que la BD. */
function prepararInsumo({ stock = '10.000', minimo = '3.000', existe = true } = {}) {
  db.__reset();
  db.__cuando(/SELECT stock_actual, stock_minimo FROM insumos/, () => ({ rows: existe ? [{ stock_actual: stock, stock_minimo: minimo }] : [] }));
  db.__cuando(/INSERT INTO stock_movimientos/, (p) => ({ rows: [{ id: 'mov-1', insumo_id: p[0], usuario_id: p[1], tipo: p[2], cantidad: p[3] }] }));
  db.__cuando(/UPDATE insumos SET stock_actual/, ([cantidad, signo]) => ({
    rows: [{ stock_actual: String(parseFloat(stock) + cantidad * signo), stock_minimo: minimo }],
  }));
  db.__cuando(/INSERT INTO insumos/, (p) => ({ rows: [{ id: 'ins-nuevo', local_id: p[0], nombre: p[1], tipo: p[2], stock_actual: p[4], stock_minimo: p[5] }] }));
}

const movimiento = (tipo, cantidad, extra = {}) => ({
  insumo_id: INSUMO_ID, usuario_id: IDS.JEFE, local_id: IDS.LOCAL, tipo, cantidad, ...extra,
});

describe('N2 · hoja con driver (servicio + stub de BD)', () => {
  test('N2-01 · Entrada de 5 kg → stock 15, movimiento con usuario y COMMIT', async () => {
    prepararInsumo();
    const r = await inventarioService.createMovimiento(movimiento('entrada', 5, { costo_unitario: 30000 }));
    expect(parseFloat(r.stock_actual)).toBe(15);
    expect(r.movimiento.usuario_id).toBe(IDS.JEFE);
    expect(db.__client.query).toHaveBeenCalledWith('COMMIT');
  });

  test('N2-02 · Salida igual al stock (10 de 10) → permitida, stock 0 y alerta_stock (valor límite)', async () => {
    prepararInsumo();
    const r = await inventarioService.createMovimiento(movimiento('salida', 10));
    expect(parseFloat(r.stock_actual)).toBe(0);
    expect(r.alerta_stock).toBe(true);
  });

  test('N2-03 · Salida de 10,01 sobre 10 → STOCK_INSUFICIENTE y ROLLBACK (valor límite)', async () => {
    prepararInsumo();
    await expect(inventarioService.createMovimiento(movimiento('salida', 10.01))).rejects.toThrow('STOCK_INSUFICIENTE');
    expect(db.__client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  test('N2-04 · Insumo de otro local → INSUMO_NO_ENCONTRADO', async () => {
    prepararInsumo({ existe: false });
    await expect(inventarioService.createMovimiento(movimiento('entrada', 1))).rejects.toThrow('INSUMO_NO_ENCONTRADO');
  });

  test('N2-05 · createInsumo sin tipo ni stock → tipo "insumo" y stock 0 por defecto', async () => {
    prepararInsumo();
    const r = await inventarioService.createInsumo({ local_id: IDS.LOCAL, nombre: 'Sal', unidad_medida: 'kg' });
    expect(r).toMatchObject({ tipo: 'insumo', stock_actual: 0, stock_minimo: 0 });
  });
});

describe('N2 · integrado (HTTP → controller → servicio real)', () => {
  test('N2-06 · POST /inventario/salida válida (4 de 10) → 201, stock 6 y sin alerta', async () => {
    prepararInsumo();
    const res = await request(app).post('/api/v1/inventario/salida').set('Authorization', tokenPara('JEFE'))
      .send({ insumo_id: INSUMO_ID, cantidad: 4, motivo: 'Descarte' });
    expect(res.status).toBe(201);
    expect(parseFloat(res.body.stock_actual)).toBe(6);
    expect(res.body.alerta_stock).toBe(false);
  });

  test('N2-07 · POST /inventario/salida mayor al stock (15 de 10) → 400', async () => {
    prepararInsumo();
    const res = await request(app).post('/api/v1/inventario/salida').set('Authorization', tokenPara('JEFE'))
      .send({ insumo_id: INSUMO_ID, cantidad: 15 });
    expect(res.status).toBe(400);
  });

  test('N2-08 · Salida que deja el stock en el mínimo (7 de 10, mínimo 3) → alerta_stock = true (RF-14)', async () => {
    prepararInsumo();
    const res = await request(app).post('/api/v1/inventario/salida').set('Authorization', tokenPara('JEFE'))
      .send({ insumo_id: INSUMO_ID, cantidad: 7 });
    expect(res.body.alerta_stock).toBe(true);
  });

  test('N2-09 · POST /inventario/entrada con cantidad negativa → 400 (RNF-10)', async () => {
    prepararInsumo();
    const res = await request(app).post('/api/v1/inventario/entrada').set('Authorization', tokenPara('JEFE'))
      .send({ insumo_id: INSUMO_ID, cantidad: -5, costo_unitario: 30000 });
    expect(res.status).toBe(400);
  });

  test('N2-10 · PATCH /insumos/:id/stock-minimo con JEFE → 403 (solo ADMIN)', async () => {
    prepararInsumo();
    const res = await request(app).patch(`/api/v1/inventario/insumos/${INSUMO_ID}/stock-minimo`)
      .set('Authorization', tokenPara('JEFE')).send({ stock_minimo: 2 });
    expect(res.status).toBe(403);
  });
});
