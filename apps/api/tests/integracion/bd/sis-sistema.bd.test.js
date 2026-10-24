/**
 * SIS · Capa de servicios (CS) unida a la capa de persistencia real (CD) — requiere .env.test
 * - (SIS-CS)(SIS-CD) en la integración ascendente (CI-A12) y último paso de la descendente (CI-DP7).
 * Primero el driver Jest invoca los servicios con la BD real; luego Supertest recorre la API completa.
 */
// fixturesBD primero: valida que .env.test esté cargado antes de que app.js abra conexiones
const { db, crearLocalDePrueba, limpiarLocal } = require('../../helpers/fixturesBD');
const request = require('supertest');
const app = require('../../../src/app');
const inventarioService = require('../../../src/features/inventario/inventario.service');
const productosService = require('../../../src/features/productos/productos.service');
const pedidosService = require('../../../src/features/pedidos/pedidos.service');

let ctx;          // { localId, jefe, empleado }
let carne, papa;  // insumos
let producto;

beforeAll(async () => {
  ctx = await crearLocalDePrueba();
  carne = await inventarioService.createInsumo({
    local_id: ctx.localId, nombre: 'Punta de anca (test)', tipo: 'carne',
    unidad_medida: 'kg', stock_actual: 10, stock_minimo: 2, costo_unitario_prom: 30000,
  });
  papa = await inventarioService.createInsumo({
    local_id: ctx.localId, nombre: 'Papa criolla (test)', tipo: 'insumo',
    unidad_medida: 'unidad', stock_actual: 50, stock_minimo: 10, costo_unitario_prom: 1500,
  });
});

afterAll(async () => {
  await limpiarLocal(ctx.localId);
  await db.pool.end();
});

describe('SIS · servicios con la BD real (driver Jest)', () => {
  test('SIS-01 · createMovimiento(salida) descuenta stock y registra usuario y fecha (RNF-11)', async () => {
    const r = await inventarioService.createMovimiento({
      insumo_id: carne.id, usuario_id: ctx.jefe.id, local_id: ctx.localId,
      tipo: 'salida', cantidad: 1.5, motivo: 'Descarte por corte',
    });
    expect(parseFloat(r.stock_actual)).toBeCloseTo(8.5);
    const mov = await db.query('SELECT usuario_id, created_at FROM stock_movimientos WHERE id = $1', [r.movimiento.id]);
    expect(mov.rows[0].usuario_id).toBe(ctx.jefe.id);
    expect(mov.rows[0].created_at).toBeInstanceOf(Date);
  });

  test('SIS-02 · productosService.create calcula el costo desde los insumos de la BD', async () => {
    producto = await productosService.create({
      local_id: ctx.localId, nombre: 'Churrasco 400 g (test)', precio_venta: 45000,
      insumos: [{ insumo_id: carne.id, cantidad_requerida: 0.4 }, { insumo_id: papa.id, cantidad_requerida: 2 }],
    });
    expect(parseFloat(producto.costo_produccion)).toBe(15000); // 0,4×30.000 + 2×1.500
    expect(producto.insumos).toHaveLength(2);
  });

  test('SIS-03 · updatePedido (edición ADMIN) recalcula total y reemplaza ítems', async () => {
    const pedido = await pedidosService.createPedido(ctx.empleado.id, ctx.localId,
      [{ producto_id: producto.id, cantidad: 1 }], ctx.empleado.id);
    const editado = await pedidosService.updatePedido(pedido.id, ctx.localId,
      [{ producto_id: producto.id, cantidad: 3 }]);
    expect(parseFloat(editado.total)).toBe(135000);
    expect(Number(editado.items[0].cantidad)).toBe(3);
  });
});

describe('SIS · API completa con la BD real (Supertest)', () => {
  test('SIS-04 · EMPLEADO consulta el menú SIN costo ni margen (RF-09)', async () => {
    const res = await request(app).get('/api/v1/productos').set('Authorization', ctx.empleado.auth);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    res.body.forEach((p) => {
      expect(p).not.toHaveProperty('costo_produccion');
      expect(p).not.toHaveProperty('margen');
    });
  });

  test('SIS-05 · Salida mayor al stock real se rechaza y el stock no cambia (RNF-10)', async () => {
    const antes = await inventarioService.getInsumoById(carne.id, ctx.localId);
    const res = await request(app).post('/api/v1/inventario/salida')
      .set('Authorization', ctx.jefe.auth)
      .send({ insumo_id: carne.id, cantidad: 999 });
    const despues = await inventarioService.getInsumoById(carne.id, ctx.localId);
    expect(res.status).toBe(400);
    expect(despues.stock_actual).toBe(antes.stock_actual);
  });

  test('SIS-06 · Historial con fecha_inicio = fecha_fin = hoy incluye las acciones de hoy (valor límite)', async () => {
    const hoy = new Date().toLocaleDateString('en-CA');          // AAAA-MM-DD, como lo envía <input type="date">
    const res = await request(app).get(`/api/v1/historial?fecha_inicio=${hoy}&fecha_fin=${hoy}`)
      .set('Authorization', ctx.jefe.auth);
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);                  // SIS-03 registró "Pedido creado" hoy
  });
});
