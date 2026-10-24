/**
 * N1 · Pedidos con el servicio REAL (pedidos.service) y la BD simulada (stub de D1)
 * - Hoja (CI-A02): el driver invoca los métodos del servicio.
 * - Integrado (CI-A06, CI-A10, CI-DP3, CI-DA4): petición HTTP → controller → service.
 */
jest.mock('../../../src/shared/database/db', () => require('../../helpers/fakeDb').crearFakeDb());

const request = require('supertest');
const app = require('../../../src/app');
const db = require('../../../src/shared/database/db');
const pedidosService = require('../../../src/features/pedidos/pedidos.service');
const { IDS, tokenPara } = require('../../helpers/auth');

const PEDIDO_ID = '99999999-9999-4999-8999-999999999999';
const CHURRASCO = '22222222-2222-4222-8222-222222222222';   // $45.000
const LIMONADA  = '33333333-3333-4333-8333-333333333333';   // $9.000
const INACTIVO  = '44444444-4444-4444-8444-444444444444';   // desactivado / de otro local

/** Catálogo y tabla de pedidos en memoria, con valores como los devuelve pg (texto). */
function prepararBd({ estado = 'pendiente' } = {}) {
  db.__reset();
  const precios = { [CHURRASCO]: '45000.00', [LIMONADA]: '9000.00' };
  let pedido = { id: PEDIDO_ID, estado, total: '0', empleado_id: IDS.EMPLEADO, local_id: IDS.LOCAL };
  db.__cuando(/SELECT precio_venta FROM productos/, ([id]) => ({ rows: precios[id] ? [{ precio_venta: precios[id] }] : [] }));
  db.__cuando(/INSERT INTO pedidos/, ([, , total]) => { pedido = { ...pedido, total: String(total) }; return { rows: [pedido] }; });
  db.__cuando(/FROM pedidos p LEFT JOIN usuarios/, () => ({ rows: [{ ...pedido, empleado_nombre: 'Empleado Test' }] }));
  db.__cuando(/FROM pedido_items pi JOIN productos/, () => ({ rows: [] }));
  db.__cuando(/UPDATE pedidos\s+SET estado = 'completado'/, (p) => (
    pedido.estado === 'completado' ? { rows: [] }
      : { rows: [(pedido = { ...pedido, estado: 'completado', metodo_pago: p[2], monto_efectivo: p[3], monto_transferencia: p[4] })] }
  ));
  db.__cuando(/UPDATE pedidos SET estado = \$1/, ([nuevo]) => ({ rows: [(pedido = { ...pedido, estado: nuevo })] }));
}

const insertsItems = () => db.__sentencias().filter(({ sql }) => /INSERT INTO pedido_items/.test(sql));

describe('N1 · hoja con driver (servicio + stub de BD)', () => {
  test('N1-09 · createPedido calcula el total con los precios de la BD (2 × 45.000 + 1 × 9.000)', async () => {
    prepararBd();
    const pedido = await pedidosService.createPedido(IDS.EMPLEADO, IDS.LOCAL,
      [{ producto_id: CHURRASCO, cantidad: 2 }, { producto_id: LIMONADA, cantidad: 1 }], IDS.EMPLEADO);
    expect(parseFloat(pedido.total)).toBe(99000);
    expect(insertsItems().map(({ params }) => params.slice(1))).toEqual([[CHURRASCO, 2, 45000], [LIMONADA, 1, 9000]]);
    expect(db.__client.query).toHaveBeenCalledWith('COMMIT');
  });

  test('N1-10 · Producto inactivo o de otro local → error "no encontrado" y ROLLBACK', async () => {
    prepararBd();
    await expect(pedidosService.createPedido(IDS.EMPLEADO, IDS.LOCAL, [{ producto_id: INACTIVO, cantidad: 1 }], IDS.EMPLEADO))
      .rejects.toThrow(/no encontrado/);
    expect(db.__client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  test('N1-11 · Completar un pedido ya completado → PEDIDO_YA_COMPLETADO y ROLLBACK', async () => {
    prepararBd({ estado: 'completado' });
    await expect(pedidosService.completarPedido(PEDIDO_ID, IDS.EMPLEADO, IDS.LOCAL, { metodo: 'efectivo' }))
      .rejects.toThrow('PEDIDO_YA_COMPLETADO');
    expect(db.__client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  test('N1-12 · Completar con pago "ambos" persiste método y montos', async () => {
    prepararBd();
    const r = await pedidosService.completarPedido(PEDIDO_ID, IDS.EMPLEADO, IDS.LOCAL, { metodo: 'ambos', efectivo: 50000, transferencia: 40000 });
    expect(r).toMatchObject({ estado: 'completado', metodo_pago: 'ambos', monto_efectivo: 50000, monto_transferencia: 40000 });
  });

  test('N1-13 · updatePedido (edición ADMIN) envía a la BD tantos parámetros como marcadores', async () => {
    prepararBd();
    await expect(pedidosService.updatePedido(PEDIDO_ID, IDS.LOCAL, [{ producto_id: CHURRASCO, cantidad: 3 }]))
      .resolves.toBeTruthy();
  });
});

describe('N1 · integrado (HTTP → controller → servicio real)', () => {
  test('N1-14 · POST /pedidos → 201, estado "pendiente" y total 99.000', async () => {
    prepararBd();
    const res = await request(app).post('/api/v1/pedidos').set('Authorization', tokenPara('EMPLEADO'))
      .send({ items: [{ producto_id: CHURRASCO, cantidad: 2 }, { producto_id: LIMONADA, cantidad: 1 }] });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ estado: 'pendiente', total: '99000' });
  });

  test('N1-15 · POST /pedidos con producto inactivo → 404', async () => {
    prepararBd();
    const res = await request(app).post('/api/v1/pedidos').set('Authorization', tokenPara('EMPLEADO'))
      .send({ items: [{ producto_id: INACTIVO, cantidad: 1 }] });
    expect(res.status).toBe(404);
  });

  test('N1-16 · PUT /pedidos/:id/estado → completado con pago en transferencia (200)', async () => {
    prepararBd();
    const res = await request(app).put(`/api/v1/pedidos/${PEDIDO_ID}/estado`).set('Authorization', tokenPara('EMPLEADO'))
      .send({ estado: 'completado', pago: { metodo: 'transferencia' } });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ estado: 'completado', metodo_pago: 'transferencia' });
  });

  test('N1-17 · PUT /pedidos/:id (ADMIN edita ítems) → 200 con el pedido actualizado (RF-19)', async () => {
    prepararBd();
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).put(`/api/v1/pedidos/${PEDIDO_ID}`).set('Authorization', tokenPara('ADMIN'))
      .send({ items: [{ producto_id: CHURRASCO, cantidad: 3 }] });
    errorLog.mockRestore();
    expect(res.status).toBe(200);
  });
});
