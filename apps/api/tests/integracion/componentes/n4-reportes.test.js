/**
 * N4 · Reportes financieros con el servicio REAL (reportes.service) y la BD simulada (stub de D1)
 * - Hoja (CI-A02): el driver invoca getResumen / getProyecciones.
 * - Integrado (CI-A06, CI-A10, CI-DP4, CI-DA4): petición HTTP → controller → service.
 */
jest.mock('../../../src/shared/database/db', () => require('../../helpers/fakeDb').crearFakeDb());

const request = require('supertest');
const app = require('../../../src/app');
const db = require('../../../src/shared/database/db');
const reportesService = require('../../../src/features/reportes/reportes.service');
const { IDS, tokenPara } = require('../../helpers/auth');

const inicioMesActual = () => { const h = new Date(); return new Date(h.getFullYear(), h.getMonth(), 1).getTime(); };

/** Métricas por período: { actual: {...}, anterior: {...} } con valores como texto (pg). */
function prepararMetricas({ actual, anterior = actual, pedidos = '4' }) {
  db.__reset();
  const periodo = (inicio) => (inicio.getTime() === inicioMesActual() ? actual : anterior);
  db.__cuando(/AS ingresos\s+FROM pedidos/, ([inicio]) => ({ rows: [{ ingresos: periodo(inicio).ingresos }] }));
  db.__cuando(/AS costo_produccion/, ([inicio]) => ({ rows: [{ costo_produccion: periodo(inicio).produccion }] }));
  db.__cuando(/AS costo_inventario/, ([inicio]) => ({ rows: [{ costo_inventario: periodo(inicio).inventario }] }));
  db.__cuando(/COUNT\(\*\) AS cantidad/, () => ({ rows: [{ cantidad: pedidos }] }));
}

/** Ventas por mes del año en curso para las proyecciones. */
function prepararVentas(meses) {
  db.__reset();
  db.__cuando(/AS ingresos\s+FROM pedidos\s+WHERE estado::text = 'completado'\s+AND local_id = \$1\s+AND EXTRACT/, () => ({
    rows: Object.entries(meses).map(([mes, ingresos]) => ({ mes: Number(mes), ingresos })),
  }));
  db.__cuando(/AS costos\s+FROM pedido_items/, () => ({ rows: Object.entries(meses).map(([mes, i]) => ({ mes: Number(mes), costos: i * 0.4 })) }));
}

describe('N4 · hoja con driver (servicio + stub de BD)', () => {
  test('N4-01 · Utilidad = Ingresos − (costo producción + costo inventario) y margen % (RF-20)', async () => {
    prepararMetricas({ actual: { ingresos: '100000', produccion: '40000', inventario: '10000' } });
    const r = await reportesService.getResumen('mensual', IDS.LOCAL);
    expect(r).toMatchObject({ ingresos: 100000, costo_total: 50000, utilidad: 50000, margen: 50, ticket_promedio: 25000, utilidad_positiva: true });
  });

  test('N4-02 · Período sin ventas → todo en 0, margen 0 y variación null (valor límite, sin división por cero)', async () => {
    prepararMetricas({ actual: { ingresos: '0', produccion: '0', inventario: '0' }, pedidos: '0' });
    const r = await reportesService.getResumen('mensual', IDS.LOCAL);
    expect(r).toMatchObject({ ingresos: 0, margen: 0, ticket_promedio: 0, utilidad_positiva: false });
    expect(r.periodo_anterior.variacion_utilidad).toBeNull();
  });

  test('N4-03 · Variación frente al período anterior: 50.000 vs 40.000 → +25 %', async () => {
    prepararMetricas({
      actual:   { ingresos: '100000', produccion: '40000', inventario: '10000' },
      anterior: { ingresos: '80000',  produccion: '30000', inventario: '10000' },
    });
    const r = await reportesService.getResumen('mensual', IDS.LOCAL);
    expect(r.periodo_anterior.variacion_utilidad).toBe(25);
  });

  test('N4-04 · Proyecciones: crecimiento del 100 % se acota al 30 % mensual (valor límite superior)', async () => {
    prepararVentas({ 9: 100000, 10: 200000 });
    const r = await reportesService.getProyecciones(IDS.LOCAL);
    expect(r.tasa_crecimiento_mensual).toBe(30);
    expect(r.meses.find((m) => m.mes === 11)).toMatchObject({ tipo: 'proyectado', ingresos: 260000 });
  });

  test('N4-05 · Proyecciones con menos de 2 meses de ventas → tasa por defecto 7 %', async () => {
    prepararVentas({ 10: 150000 });
    const r = await reportesService.getProyecciones(IDS.LOCAL);
    expect(r.tasa_crecimiento_mensual).toBe(7);
  });

  test('N4-06 · Los meses anteriores al primer mes con ventas no se proyectan (ingresos 0)', async () => {
    prepararVentas({ 9: 100000, 10: 121000 });
    const r = await reportesService.getProyecciones(IDS.LOCAL);
    const pasados = r.meses.filter((m) => m.mes < 9);
    expect(pasados.every((m) => m.ingresos === 0)).toBe(true);
  });
});

describe('N4 · integrado (HTTP → controller → servicio real)', () => {
  test('N4-07 · GET /reportes/resumen?periodo=semanal con JEFE → 200 y período semanal', async () => {
    prepararMetricas({ actual: { ingresos: '100000', produccion: '40000', inventario: '10000' } });
    const res = await request(app).get('/api/v1/reportes/resumen?periodo=semanal').set('Authorization', tokenPara('JEFE'));
    expect(res.status).toBe(200);
    expect(res.body.periodo).toBe('semanal');
  });

  test('N4-08 · Período no reconocido (anual) se normaliza a "mensual"', async () => {
    prepararMetricas({ actual: { ingresos: '0', produccion: '0', inventario: '0' } });
    const res = await request(app).get('/api/v1/reportes/resumen?periodo=anual').set('Authorization', tokenPara('JEFE'));
    expect(res.body.periodo).toBe('mensual');
  });

  test('N4-09 · EMPLEADO no accede a resumen ni proyecciones (RF-21) → 403', async () => {
    const auth = tokenPara('EMPLEADO');
    const [a, b] = await Promise.all([
      request(app).get('/api/v1/reportes/resumen').set('Authorization', auth),
      request(app).get('/api/v1/reportes/proyecciones').set('Authorization', auth),
    ]);
    expect([a.status, b.status]).toEqual([403, 403]);
  });

  test('N4-10 · GET /reportes/turno: el EMPLEADO siempre ve su propio turno aunque envíe otro empleado_id', async () => {
    db.__reset();
    db.__cuando(/AS total_pedidos/, () => ({ rows: [{ total_pedidos: '3', completados: '2', en_proceso: '0', pendientes: '1' }] }));
    const res = await request(app).get(`/api/v1/reportes/turno?empleado_id=${IDS.OTRO_EMP}`).set('Authorization', tokenPara('EMPLEADO'));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total_pedidos: 3, completados: 2, pendientes: 1 });
    const consulta = db.__sentencias().find(({ sql }) => /AS total_pedidos/.test(sql));
    expect(consulta.params[0]).toBe(IDS.EMPLEADO);
  });
});
