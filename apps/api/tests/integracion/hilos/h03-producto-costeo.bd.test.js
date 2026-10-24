/**
 * H03 · Crear producto con receta, costeo automático y desactivación (CU-P1, CU-P2, CU-P3)
 * Recorrido: P4 Menú → G1 API → T1 Auth → N3 Productos → N2 Inventario (costos) → D1/D2 → N1 Pedidos
 * Requiere apps/api/.env.test.
 */
const { db, crearLocalDePrueba, limpiarLocal } = require('../../helpers/fixturesBD');
const { api, crearInsumo, crearProducto, crearPedido } = require('../../helpers/hilos');

let ctx, res, papa, producto;

beforeAll(async () => {
  ctx = await crearLocalDePrueba();
  res = await crearInsumo(ctx.jefe.auth, { nombre: 'Res (H03)', tipo: 'carne', stock_actual: 20, costo_unitario_prom: 30000 });
  papa = await crearInsumo(ctx.jefe.auth, { nombre: 'Papa criolla (H03)', unidad_medida: 'unidad', stock_actual: 100, costo_unitario_prom: 1500 });
});

afterAll(async () => {
  await limpiarLocal(ctx.localId);
  await db.pool.end();
});

const verProducto = async () =>
  (await api().get(`/api/v1/productos/${producto.id}`).set('Authorization', ctx.jefe.auth));

describe('CI-H03-01 · Producto con receta y costo calculado', () => {
  test('Paso 1 · JEFE crea "Churrasco (H03)" a $45.000 con 0,4 kg de res y 2 papas → costo $15.000', async () => {
    producto = await crearProducto(ctx.jefe.auth, {
      nombre: 'Churrasco (H03)', precio_venta: 45000,
      insumos: [{ insumo_id: res.id, cantidad_requerida: 0.4 }, { insumo_id: papa.id, cantidad_requerida: 2 }],
    });
    expect(parseFloat(producto.costo_produccion)).toBe(15000);
  });

  test('Paso 2 · /productos/costos muestra margen $30.000 (RF-07)', async () => {
    const r = await api().get('/api/v1/productos/costos').set('Authorization', ctx.jefe.auth);
    const fila = r.body.find((p) => p.id === producto.id);
    expect(parseFloat(fila.margen)).toBe(30000);
  });

  test('Paso 3 · El detalle trae la receta con sus 2 insumos', async () => {
    const r = await verProducto();
    expect(r.body.insumos.map((i) => i.insumo_id).sort()).toEqual([res.id, papa.id].sort());
  });
});

describe('CI-H03-02 · Cambio de costo del insumo y recálculo', () => {
  test('Paso 1 · El costo promedio de la res sube a $32.000/kg', async () => {
    const r = await api().put(`/api/v1/inventario/insumos/${res.id}`).set('Authorization', ctx.jefe.auth)
      .send({ costo_unitario_prom: 32000 });
    expect(r.status).toBe(200);
  });

  test('Paso 2 · Recalcular costos → 200 con al menos 1 producto actualizado', async () => {
    const r = await api().post('/api/v1/productos/recalcular-costos').set('Authorization', ctx.jefe.auth);
    expect(r.status).toBe(200);
    expect(r.body.actualizados).toBeGreaterThanOrEqual(1);
  });

  test('Paso 3 · Nuevo costo = 0,4 × 32.000 + 2 × 1.500 = $15.800', async () => {
    expect(parseFloat((await verProducto()).body.costo_produccion)).toBe(15800);
  });
});

describe('CI-H03-03 · Desactivar producto sin perder el historial de pedidos (RF-08)', () => {
  let pedidoId;

  test('Paso 1 · Se vende el producto (pedido previo) → 201', async () => {
    const r = await crearPedido(ctx.empleado.auth, [{ producto_id: producto.id, cantidad: 1 }]);
    expect(r.status).toBe(201);
    pedidoId = r.body.id;
  });

  test('Paso 2 · JEFE desactiva el producto → 200', async () => {
    const r = await api().delete(`/api/v1/productos/${producto.id}`).set('Authorization', ctx.jefe.auth);
    expect(r.status).toBe(200);
  });

  test('Paso 3 · Ya no aparece en el catálogo ni se puede pedir (404)', async () => {
    const lista = await api().get('/api/v1/productos').set('Authorization', ctx.empleado.auth);
    expect(lista.body.some((p) => p.id === producto.id)).toBe(false);
    expect((await crearPedido(ctx.empleado.auth, [{ producto_id: producto.id, cantidad: 1 }])).status).toBe(404);
  });

  test('Paso 4 · El pedido anterior conserva el ítem con el nombre del producto', async () => {
    const r = await api().get(`/api/v1/pedidos/${pedidoId}`).set('Authorization', ctx.empleado.auth);
    expect(r.body.items[0].producto_nombre).toBe('Churrasco (H03)');
  });
});
