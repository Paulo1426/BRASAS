/**
 * N1 · Pedidos con el servicio SIMULADO (stub)
 * Reales: app.js (G1) → pedidos.routes → auth.middleware (T1) → pedidos.controller
 * Stubs: pedidos.service (N1) y db (D1). Se usa en la integración descendente (CI-DP3, CI-DA3).
 */
jest.mock('../../../src/shared/database/db', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  connect: jest.fn(),
  pool: { connect: jest.fn() },
}));
jest.mock('../../../src/features/pedidos/pedidos.service', () => ({
  createPedido: jest.fn(),
  getPedidoById: jest.fn(),
  getPedidosByEmpleado: jest.fn(),
  getAllPedidos: jest.fn(),
  getAllWithFilters: jest.fn(),
  updateEstado: jest.fn(),
  completarPedido: jest.fn(),
  updatePedido: jest.fn(),
  cancelPedido: jest.fn(),
}));

const request = require('supertest');
const app = require('../../../src/app');
const pedidosService = require('../../../src/features/pedidos/pedidos.service');
const { IDS, tokenPara } = require('../../helpers/auth');

const URL = '/api/v1/pedidos';
const PEDIDO_ID = '99999999-9999-4999-8999-999999999999';
const PRODUCTO_ID = '22222222-2222-4222-8222-222222222222';

describe('N1 · Pedidos con servicio simulado', () => {
  test('N1-01 · POST /pedidos sin token responde 401 y no llega al service', async () => {
    const res = await request(app).post(URL).send({ items: [] });
    expect(res.status).toBe(401);
    expect(pedidosService.createPedido).not.toHaveBeenCalled();
  });

  test('N1-02 · POST /pedidos con items vacío responde 400', async () => {
    const res = await request(app).post(URL)
      .set('Authorization', tokenPara('EMPLEADO'))
      .send({ items: [] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/al menos un producto/i);
  });

  test('N1-03 · POST /pedidos con cantidad 0 responde 400', async () => {
    const res = await request(app).post(URL)
      .set('Authorization', tokenPara('EMPLEADO'))
      .send({ items: [{ producto_id: PRODUCTO_ID, cantidad: 0 }] });
    expect(res.status).toBe(400);
  });

  test('N1-04 · POST /pedidos válido delega al service con empleado y local del token', async () => {
    pedidosService.createPedido.mockResolvedValue({ id: PEDIDO_ID, estado: 'pendiente', total: '90000' });
    const items = [{ producto_id: PRODUCTO_ID, cantidad: 2 }];

    const res = await request(app).post(URL)
      .set('Authorization', tokenPara('EMPLEADO'))
      .send({ items });

    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('pendiente');
    expect(pedidosService.createPedido)
      .toHaveBeenCalledWith(IDS.EMPLEADO, IDS.LOCAL, items, IDS.EMPLEADO);
  });

  test('N1-05 · PUT /:id/estado no permite retroceder (preparando → pendiente) → 400', async () => {
    pedidosService.getPedidoById.mockResolvedValue({ id: PEDIDO_ID, estado: 'preparando', empleado_id: IDS.EMPLEADO });
    const res = await request(app).put(`${URL}/${PEDIDO_ID}/estado`)
      .set('Authorization', tokenPara('EMPLEADO'))
      .send({ estado: 'pendiente' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/retroceder/i);
    expect(pedidosService.updateEstado).not.toHaveBeenCalled();
  });

  test('N1-06 · EMPLEADO no puede completar el pedido de otro empleado → 403', async () => {
    pedidosService.getPedidoById.mockResolvedValue({ id: PEDIDO_ID, estado: 'pendiente', empleado_id: IDS.OTRO_EMP });
    const res = await request(app).put(`${URL}/${PEDIDO_ID}/estado`)
      .set('Authorization', tokenPara('EMPLEADO'))
      .send({ estado: 'completado', pago: { metodo: 'efectivo' } });
    expect(res.status).toBe(403);
    expect(pedidosService.completarPedido).not.toHaveBeenCalled();
  });

  test('N1-07 · Completar con stock insuficiente (error del trigger) → 409 y mensaje claro', async () => {
    pedidosService.getPedidoById.mockResolvedValue({ id: PEDIDO_ID, estado: 'pendiente', empleado_id: IDS.EMPLEADO });
    pedidosService.completarPedido.mockRejectedValue(
      new Error('Stock insuficiente para el insumo 33333333-3333-4333-8333-333333333333: disponible 0.5, solicitado 0.8'),
    );
    const res = await request(app).put(`${URL}/${PEDIDO_ID}/estado`)
      .set('Authorization', tokenPara('EMPLEADO'))
      .send({ estado: 'completado', pago: { metodo: 'efectivo' } });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/stock insuficiente/i);
  });

  test('N1-08 · PUT /pedidos/:id (edición completa) es exclusivo de ADMIN → 403 para JEFE', async () => {
    const res = await request(app).put(`${URL}/${PEDIDO_ID}`)
      .set('Authorization', tokenPara('JEFE'))
      .send({ items: [{ producto_id: PRODUCTO_ID, cantidad: 1 }] });
    expect(res.status).toBe(403);
    expect(pedidosService.updatePedido).not.toHaveBeenCalled();
  });
});
