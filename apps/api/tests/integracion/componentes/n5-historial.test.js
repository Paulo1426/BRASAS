/**
 * N5 · Historial de auditoría con servicio y repositorio REALES y la BD simulada (stub de D1)
 * - Hoja (CI-A02): el driver invoca historial.service (getHistorial / registrar).
 * - Integrado (CI-A06, CI-A10, CI-DP4, CI-DA4): petición HTTP → controller → service → repository.
 */
jest.mock('../../../src/shared/database/db', () => require('../../helpers/fakeDb').crearFakeDb());

const request = require('supertest');
const app = require('../../../src/app');
const db = require('../../../src/shared/database/db');
const historialService = require('../../../src/features/historial/historial.service');
const { IDS, tokenPara } = require('../../helpers/auth');

function prepararHistorial(total = '0') {
  db.__reset();
  db.__cuando(/SELECT COUNT\(\*\) AS total/, () => ({ rows: [{ total }] }));
}
const consultaConteo = () => db.__sentencias().find(({ sql }) => /COUNT\(\*\) AS total/.test(sql));
const consultaDatos  = () => db.__sentencias().find(({ sql }) => /ORDER BY h.created_at DESC/.test(sql));

describe('N5 · hoja con driver (servicio + repositorio + stub de BD)', () => {
  test('N5-01 · ADMIN: consulta global, sin filtro de local', async () => {
    prepararHistorial();
    await historialService.getHistorial('ADMIN', IDS.ADMIN, IDS.LOCAL, {});
    expect(consultaConteo().sql).not.toMatch(/h\.local_id/);
  });

  test('N5-02 · EMPLEADO: se fuerza el filtro por su propio usuario_id', async () => {
    prepararHistorial();
    await historialService.getHistorial('EMPLEADO', IDS.EMPLEADO, IDS.LOCAL, {});
    const { sql, params } = consultaConteo();
    expect(sql).toMatch(/h\.usuario_id = \$/);
    expect(params).toContain(IDS.EMPLEADO);
  });

  test('N5-03 · JEFE que pide entidad "usuarios" queda limitado a las 5 entidades de negocio', async () => {
    prepararHistorial();
    await historialService.getHistorial('JEFE', IDS.JEFE, IDS.LOCAL, { entidad: 'usuarios' });
    const { params } = consultaConteo();
    expect(params).not.toContain('usuarios');
    expect(params).toEqual(expect.arrayContaining(['pedidos', 'inventario', 'carnes', 'insumos', 'productos']));
  });

  test('N5-04 · Paginación: página 1 → OFFSET 0 y página 3 (límite 20) → OFFSET 40', async () => {
    prepararHistorial();
    await historialService.getHistorial('JEFE', IDS.JEFE, IDS.LOCAL, { page: 1, limit: 20 });
    expect(consultaDatos().params.slice(-2)).toEqual([20, 0]);
    prepararHistorial();
    await historialService.getHistorial('JEFE', IDS.JEFE, IDS.LOCAL, { page: 3, limit: 20 });
    expect(consultaDatos().params.slice(-2)).toEqual([20, 40]);
  });

  test('N5-05 · registrar guarda entidad_id solo si es UUID y la descripción como JSON', async () => {
    prepararHistorial();
    await historialService.registrar({ usuario_id: IDS.JEFE, local_id: IDS.LOCAL, tipo_accion: 'CREAR', entidad: 'inventario', entidad_id: 'entrada', descripcion: 'Entrada' });
    const insert = db.__sentencias().find(({ sql }) => /INSERT INTO historial/.test(sql));
    expect(insert.params).toEqual([IDS.JEFE, IDS.LOCAL, 'inventario', null, 'CREAR', JSON.stringify({ descripcion: 'Entrada' })]);
  });
});

describe('N5 · integrado (HTTP → controller → servicio → repositorio)', () => {
  test('N5-06 · tipo_accion inexistente → 400 con la lista de valores permitidos', async () => {
    prepararHistorial();
    const res = await request(app).get('/api/v1/historial?tipo_accion=BORRAR_TODO').set('Authorization', tokenPara('JEFE'));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/CREAR/);
  });

  test('N5-07 · Filtro tipo_accion=CREAR se aplica en la consulta (h.accion = CREAR) (RF-23)', async () => {
    prepararHistorial();
    await request(app).get('/api/v1/historial?tipo_accion=CREAR').set('Authorization', tokenPara('JEFE'));
    const { sql, params } = consultaConteo();
    expect(sql).toMatch(/h\.accion = \$/);
    expect(params).toContain('CREAR');
  });

  test('N5-08 · El parámetro que envía el frontend (accion=COMPLETAR) también filtra', async () => {
    prepararHistorial();
    await request(app).get('/api/v1/historial?accion=COMPLETAR').set('Authorization', tokenPara('JEFE'));
    expect(consultaConteo().params).toContain('COMPLETAR');
  });

  test('N5-09 · Respuesta paginada { data, total, page, limit } con total numérico', async () => {
    prepararHistorial('35');
    const res = await request(app).get('/api/v1/historial?page=2&limit=20').set('Authorization', tokenPara('JEFE'));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 35, page: 2, limit: 20 });
  });
});
