/**
 * H05 · Consultar el historial de auditoría con alcance por rol y filtros (RF-23)
 * Recorrido: acciones en P3/P4/P2 → T2 Auditoría + N1/N3 → D1/D2 → P6 Historial → G1 → T1 → N5 Historial
 * Requiere apps/api/.env.test.
 */
const { db, crearLocalDePrueba, limpiarLocal } = require('../../helpers/fixturesBD');
const { api, hoy, crearInsumo, crearProducto, crearPedido, cambiarEstado } = require('../../helpers/hilos');

const ENTIDADES_NEGOCIO = ['pedidos', 'inventario', 'carnes', 'insumos', 'productos'];
let ctx, insumo, pedidoId;

beforeAll(async () => {
  ctx = await crearLocalDePrueba();
  insumo = await crearInsumo(ctx.jefe.auth, { nombre: 'Carbón (H05)', stock_actual: 50, costo_unitario_prom: 4000 });
  await api().post('/api/v1/inventario/entrada').set('Authorization', ctx.jefe.auth).send({ insumo_id: insumo.id, cantidad: 10, costo_unitario: 4000 });
  const producto = await crearProducto(ctx.jefe.auth, { nombre: 'Picada (H05)', precio_venta: 30000, insumos: [{ insumo_id: insumo.id, cantidad_requerida: 1 }] });
  pedidoId = (await crearPedido(ctx.empleado.auth, [{ producto_id: producto.id, cantidad: 1 }])).body.id;
  await cambiarEstado(ctx.empleado.auth, pedidoId, 'completado', { metodo: 'efectivo' });
});

afterAll(async () => {
  await limpiarLocal(ctx.localId);
  await db.pool.end();
});

const historial = (auth, query = '') => api().get(`/api/v1/historial?limit=100${query}`).set('Authorization', auth);

describe('CI-H05-01 · Vista del JEFE: acciones de negocio de su local', () => {
  test('Paso 1 · GET /historial → 200 con registros', async () => {
    const r = await historial(ctx.jefe.auth);
    expect(r.status).toBe(200);
    expect(r.body.total).toBeGreaterThan(0);
  });

  test('Paso 2 · Solo entidades de negocio (sin auth ni usuarios)', async () => {
    const r = await historial(ctx.jefe.auth);
    expect(r.body.data.every((h) => ENTIDADES_NEGOCIO.includes(h.entidad))).toBe(true);
  });

  test('Paso 3 · Incluye la acción COMPLETAR del pedido del empleado', async () => {
    const r = await historial(ctx.jefe.auth);
    expect(r.body.data.some((h) => h.accion === 'COMPLETAR' && h.entidad_id === pedidoId)).toBe(true);
  });

  test('Paso 4 · Incluye la entrada de inventario registrada por el JEFE (entidad inventario)', async () => {
    const r = await historial(ctx.jefe.auth);
    expect(r.body.data.some((h) => h.entidad === 'inventario')).toBe(true);
  });
});

describe('CI-H05-02 · Vista del EMPLEADO: solo sus acciones', () => {
  test('Paso 1 · Todos los registros pertenecen al empleado', async () => {
    const r = await historial(ctx.empleado.auth);
    expect(r.status).toBe(200);
    expect(r.body.data.every((h) => h.usuario_id === ctx.empleado.id)).toBe(true);
  });

  test('Paso 2 · Aparece la creación de su pedido', async () => {
    const r = await historial(ctx.empleado.auth);
    expect(r.body.data.some((h) => h.accion === 'CREAR' && h.entidad === 'pedidos')).toBe(true);
  });
});

describe('CI-H05-03 · Filtros del historial', () => {
  test('Paso 1 · tipo_accion=COMPLETAR → todas las filas son COMPLETAR', async () => {
    const r = await historial(ctx.jefe.auth, '&tipo_accion=COMPLETAR');
    expect(r.body.data.length).toBeGreaterThan(0);
    expect(r.body.data.every((h) => h.accion === 'COMPLETAR')).toBe(true);
  });

  test('Paso 2 · fecha_inicio = fecha_fin = hoy → incluye las acciones de hoy (valor límite)', async () => {
    const r = await historial(ctx.jefe.auth, `&fecha_inicio=${hoy()}&fecha_fin=${hoy()}`);
    expect(r.body.total).toBeGreaterThan(0);
  });

  test('Paso 3 · tipo_accion inexistente → 400', async () => {
    expect((await historial(ctx.jefe.auth, '&tipo_accion=BORRAR')).status).toBe(400);
  });
});
