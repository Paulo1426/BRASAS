/**
 * H01 · Crear y completar pedido con descuento automático de inventario (CU-PE1, CU-PE2, CU-03)
 * Recorrido: P2 Pedidos → G1 API → T1 Auth → N1 Pedidos → D1/D2 (trigger fn_completar_pedido) → T2 Auditoría → N4 Reportes
 * Requiere apps/api/.env.test (BD de pruebas con los triggers).
 */
const { db, crearLocalDePrueba, limpiarLocal } = require('../../helpers/fixturesBD');
const { api, crearInsumo, crearProducto, crearPedido, cambiarEstado } = require('../../helpers/hilos');

let ctx, costilla, producto;

beforeAll(async () => {
  ctx = await crearLocalDePrueba();
  costilla = await crearInsumo(ctx.jefe.auth, { nombre: 'Costilla (H01)', tipo: 'carne', stock_actual: 10, stock_minimo: 2, costo_unitario_prom: 28000 });
  producto = await crearProducto(ctx.jefe.auth, { nombre: 'Costilla BBQ (H01)', precio_venta: 45000, insumos: [{ insumo_id: costilla.id, cantidad_requerida: 0.4 }] });
});

afterAll(async () => {
  await limpiarLocal(ctx.localId);
  await db.pool.end();
});

const stockCostilla = async () =>
  parseFloat((await api().get(`/api/v1/inventario/insumos/${costilla.id}`).set('Authorization', ctx.jefe.auth)).body.stock_actual);

describe('CI-H01-01 · Flujo completo: crear → preparar → completar con pago', () => {
  let pedidoId;

  test('Paso 1 · EMPLEADO crea el pedido (2 × $45.000) → 201, pendiente, total 90.000', async () => {
    const res = await crearPedido(ctx.empleado.auth, [{ producto_id: producto.id, cantidad: 2 }]);
    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('pendiente');
    expect(parseFloat(res.body.total)).toBe(90000);
    pedidoId = res.body.id;
  });

  test('Paso 2 · pendiente → preparando → 200', async () => {
    const res = await cambiarEstado(ctx.empleado.auth, pedidoId, 'preparando');
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('preparando');
  });

  test('Paso 3 · preparando → completado con pago en efectivo → 200', async () => {
    const res = await cambiarEstado(ctx.empleado.auth, pedidoId, 'completado', { metodo: 'efectivo' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ estado: 'completado', metodo_pago: 'efectivo' });
  });

  test('Paso 4 · El trigger descontó 2 × 0,4 kg: stock 10 → 9,2 kg (RF-13)', async () => {
    expect(await stockCostilla()).toBeCloseTo(9.2);
  });

  test('Paso 5 · El historial registra COMPLETAR para el pedido (RF-23)', async () => {
    const r = await db.query("SELECT accion FROM historial WHERE local_id = $1 AND entidad = 'pedidos' AND entidad_id = $2", [ctx.localId, pedidoId]);
    expect(r.rows.map((x) => x.accion)).toContain('COMPLETAR');
  });

  test('Paso 6 · El resumen diario del JEFE refleja el ingreso de $90.000 (RF-20, RNF-06)', async () => {
    const res = await api().get('/api/v1/reportes/resumen?periodo=diario').set('Authorization', ctx.jefe.auth);
    expect(res.body.ingresos).toBe(90000);
  });
});

describe('CI-H01-02 · Stock insuficiente al completar (atomicidad)', () => {
  let pedidoId; let stockAntes;

  test('Paso 1 · Crear pedido de 30 unidades (requiere 12 kg; hay 9,2) → 201', async () => {
    stockAntes = await stockCostilla();
    const res = await crearPedido(ctx.empleado.auth, [{ producto_id: producto.id, cantidad: 30 }]);
    expect(res.status).toBe(201);
    pedidoId = res.body.id;
  });

  test('Paso 2 · Completar → 409 con mensaje de stock insuficiente', async () => {
    const res = await cambiarEstado(ctx.empleado.auth, pedidoId, 'completado', { metodo: 'efectivo' });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/stock insuficiente/i);
  });

  test('Paso 3 · El pedido NO queda completado (sigue pendiente)', async () => {
    const res = await api().get(`/api/v1/pedidos/${pedidoId}`).set('Authorization', ctx.empleado.auth);
    expect(res.body.estado).toBe('pendiente');
  });

  test('Paso 4 · El stock no cambió', async () => {
    expect(await stockCostilla()).toBeCloseTo(stockAntes);
  });
});

describe('CI-H01-03 · Transiciones no permitidas', () => {
  let pedidoId;

  test('Paso 1 · Crear pedido y pasarlo a preparando', async () => {
    pedidoId = (await crearPedido(ctx.empleado.auth, [{ producto_id: producto.id, cantidad: 1 }])).body.id;
    expect((await cambiarEstado(ctx.empleado.auth, pedidoId, 'preparando')).status).toBe(200);
  });

  test('Paso 2 · Retroceder preparando → pendiente → 400', async () => {
    expect((await cambiarEstado(ctx.empleado.auth, pedidoId, 'pendiente')).status).toBe(400);
  });

  test('Paso 3 · Cancelar el pedido en preparación → 200', async () => {
    const res = await api().delete(`/api/v1/pedidos/${pedidoId}`).set('Authorization', ctx.empleado.auth);
    expect(res.status).toBe(200);
  });

  test('Paso 4 · Completar un pedido cancelado → 400', async () => {
    expect((await cambiarEstado(ctx.empleado.auth, pedidoId, 'completado', { metodo: 'efectivo' })).status).toBe(400);
  });
});
