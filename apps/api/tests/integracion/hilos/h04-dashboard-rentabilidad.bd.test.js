/**
 * H04 · Consultar el dashboard de rentabilidad por período (CU-D1, CU-D2)
 * Recorrido: P5 Dashboard → G1 API → T1 Auth → N4 Reportes → D1/D2 (pedidos, pedido_items, stock_movimientos)
 * Requiere apps/api/.env.test. Cada ejecución crea un local nuevo, así que el día empieza sin ventas.
 */
const { db, crearLocalDePrueba, limpiarLocal } = require('../../helpers/fixturesBD');
const { api, crearInsumo, crearProducto, crearPedido, cambiarEstado } = require('../../helpers/hilos');

let ctx, producto;

beforeAll(async () => {
  ctx = await crearLocalDePrueba();
  const res = await crearInsumo(ctx.jefe.auth, { nombre: 'Res (H04)', tipo: 'carne', stock_actual: 20, costo_unitario_prom: 30000 });
  producto = await crearProducto(ctx.jefe.auth, { nombre: 'Churrasco (H04)', precio_venta: 45000, insumos: [{ insumo_id: res.id, cantidad_requerida: 0.5 }] });
});

afterAll(async () => {
  await limpiarLocal(ctx.localId);
  await db.pool.end();
});

const resumen = (auth, periodo = 'diario') => api().get(`/api/v1/reportes/resumen?periodo=${periodo}`).set('Authorization', auth);

describe('CI-H04-01 · Día sin ventas', () => {
  test('Paso 1 · Resumen diario en cero, margen 0 y utilidad no positiva (valor límite)', async () => {
    const r = await resumen(ctx.jefe.auth);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ingresos: 0, costo_produccion: 0, margen: 0, cantidad_pedidos: 0, utilidad_positiva: false });
  });
});

describe('CI-H04-02 · Rentabilidad después de una venta', () => {
  test('Paso 1 · Se crea y completa un pedido de 2 churrascos ($90.000)', async () => {
    const pedido = (await crearPedido(ctx.empleado.auth, [{ producto_id: producto.id, cantidad: 2 }])).body;
    expect((await cambiarEstado(ctx.empleado.auth, pedido.id, 'completado', { metodo: 'efectivo' })).status).toBe(200);
  });

  test('Paso 2 · Ingresos 90.000; costo de producción 2 × 15.000; utilidad 60.000; margen 66,67 % (RF-20)', async () => {
    const r = await resumen(ctx.jefe.auth);
    expect(r.body).toMatchObject({ ingresos: 90000, costo_produccion: 30000, utilidad: 60000, margen: 66.67, cantidad_pedidos: 1, ticket_promedio: 90000 });
  });

  test('Paso 3 · Top de productos del día: Churrasco con 2 unidades y ganancia de $60.000', async () => {
    const r = await api().get('/api/v1/reportes/top-productos?periodo=diario').set('Authorization', ctx.jefe.auth);
    expect(r.body[0]).toMatchObject({ nombre: 'Churrasco (H04)', cantidad_vendida: 2, ganancia_generada: 60000 });
  });

  test('Paso 4 · Resumen de pagos: $90.000 en efectivo', async () => {
    const r = await api().get('/api/v1/reportes/pagos?periodo=diario').set('Authorization', ctx.jefe.auth);
    expect(r.body).toMatchObject({ total_general: 90000, total_efectivo: 90000, total_transferencia: 0 });
  });
});

describe('CI-H04-03 · Vista del EMPLEADO sin datos financieros (RF-21)', () => {
  test('Paso 1 · /reportes/resumen con token de EMPLEADO → 403', async () => {
    expect((await resumen(ctx.empleado.auth)).status).toBe(403);
  });

  test('Paso 2 · /reportes/turno → 200 con el conteo de sus pedidos y el top del día', async () => {
    const r = await api().get('/api/v1/reportes/turno').set('Authorization', ctx.empleado.auth);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ total_pedidos: 1, completados: 1 });
    expect(r.body.top_productos[0].nombre).toBe('Churrasco (H04)');
  });
});
