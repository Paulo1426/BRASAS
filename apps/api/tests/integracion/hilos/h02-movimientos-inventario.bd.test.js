/**
 * H02 · Registrar entradas y salidas de inventario con alerta de stock mínimo (CU-I1, CU-I2)
 * Recorrido: P3 Inventario → G1 API → T1 Auth → N2 Inventario → D1/D2 → T2 Auditoría → N4 Reportes / N5 Historial
 * Requiere apps/api/.env.test.
 */
const { db, crearLocalDePrueba, limpiarLocal } = require('../../helpers/fixturesBD');
const { api, crearInsumo } = require('../../helpers/hilos');

let ctx, punta;

beforeAll(async () => {
  ctx = await crearLocalDePrueba();
  punta = await crearInsumo(ctx.jefe.auth, { nombre: 'Punta de anca (H02)', tipo: 'carne', stock_actual: 2, stock_minimo: 3, costo_unitario_prom: 30000 });
});

afterAll(async () => {
  await limpiarLocal(ctx.localId);
  await db.pool.end();
});

const movimiento = (tipo, cuerpo) =>
  api().post(`/api/v1/inventario/${tipo}`).set('Authorization', ctx.jefe.auth).send({ insumo_id: punta.id, ...cuerpo });
const stock = async () =>
  parseFloat((await api().get(`/api/v1/inventario/insumos/${punta.id}`).set('Authorization', ctx.jefe.auth)).body.stock_actual);

describe('CI-H02-01 · Compra de carne (entrada) y su efecto en costos e historial', () => {
  test('Paso 1 · Entrada de 5 kg a $30.000/kg → 201, stock 2 → 7 y sin alerta', async () => {
    const res = await movimiento('entrada', { cantidad: 5, costo_unitario: 30000, motivo: 'Compra proveedor' });
    expect(res.status).toBe(201);
    expect(parseFloat(res.body.stock_actual)).toBe(7);
    expect(res.body.alerta_stock).toBe(false);
  });

  test('Paso 2 · El movimiento queda con usuario, cantidad, costo y fecha (RNF-11)', async () => {
    const res = await api().get(`/api/v1/inventario/movimientos?insumo_id=${punta.id}`).set('Authorization', ctx.jefe.auth);
    expect(res.body[0]).toMatchObject({ tipo: 'entrada', usuario_id: ctx.jefe.id });
    expect(parseFloat(res.body[0].cantidad)).toBe(5);
    expect(res.body[0].created_at).toBeTruthy();
  });

  test('Paso 3 · El resumen diario suma $150.000 de costo de inventario (5 × 30.000)', async () => {
    const res = await api().get('/api/v1/reportes/resumen?periodo=diario').set('Authorization', ctx.jefe.auth);
    expect(res.body.costo_inventario).toBe(150000);
  });

  test('Paso 4 · El JEFE ve la entrada en su historial (entidad inventario) (RF-23)', async () => {
    const res = await api().get('/api/v1/historial?limit=50').set('Authorization', ctx.jefe.auth);
    expect(res.body.data.some((h) => h.entidad === 'inventario')).toBe(true);
  });
});

describe('CI-H02-02 · Salida por descarte que activa la alerta de stock mínimo', () => {
  test('Paso 1 · Salida de 4,5 kg (7 → 2,5; mínimo 3) → 201 y alerta_stock = true (RF-14)', async () => {
    const res = await movimiento('salida', { cantidad: 4.5, motivo: 'Descarte' });
    expect(res.status).toBe(201);
    expect(res.body.alerta_stock).toBe(true);
  });

  test('Paso 2 · El listado de insumos muestra 2,5 kg', async () => {
    expect(await stock()).toBeCloseTo(2.5);
  });
});

describe('CI-H02-03 · Movimientos que no deben alterar el stock (RNF-10)', () => {
  test('Paso 1 · Salida de 10 kg con 2,5 disponibles → 400', async () => {
    expect((await movimiento('salida', { cantidad: 10 })).status).toBe(400);
  });

  test('Paso 2 · Entrada con cantidad negativa (−5) → 400', async () => {
    expect((await movimiento('entrada', { cantidad: -5, costo_unitario: 30000 })).status).toBe(400);
  });

  test('Paso 3 · El stock sigue en 2,5 kg y nunca queda negativo', async () => {
    const actual = await stock();
    expect(actual).toBeCloseTo(2.5);
    expect(actual).toBeGreaterThanOrEqual(0);
  });
});
