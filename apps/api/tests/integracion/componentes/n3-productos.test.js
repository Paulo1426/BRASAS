/**
 * N3 · Menú y costeo con el servicio REAL (productos.service) y la BD simulada (stub de D1)
 * - Hoja (CI-A02): el driver invoca create / getAllWithCostos.
 * - Integrado (CI-A06, CI-A10, CI-DP4, CI-DA4): petición HTTP → controller → service.
 */
jest.mock('../../../src/shared/database/db', () => require('../../helpers/fakeDb').crearFakeDb());

const request = require('supertest');
const app = require('../../../src/app');
const db = require('../../../src/shared/database/db');
const productosService = require('../../../src/features/productos/productos.service');
const { IDS, tokenPara } = require('../../helpers/auth');

const CARNE = '44444444-4444-4444-8444-444444444444';   // costo promedio 30.000 / kg
const PAPA  = '55555555-5555-4555-8555-555555555555';   // costo promedio 1.500 / unidad

function prepararCatalogo() {
  db.__reset();
  db.__cuando(/SELECT costo_unitario_prom FROM insumos/, ([id]) => ({ rows: [{ costo_unitario_prom: id === CARNE ? '30000.00' : '1500.00' }] }));
  let producto = null;   // fila guardada; pg devuelve NUMERIC como texto
  db.__cuando(/INSERT INTO productos/, (p) => {
    producto = { id: 'prod-1', nombre: p[2], precio_venta: String(p[3]), costo_produccion: String(p[4]) };
    return { rows: [producto] };
  });
  db.__cuando(/FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id WHERE p.id = \$1/, () => ({ rows: producto ? [producto] : [] }));
}

const sentencias = (patron) => db.__sentencias().filter(({ sql }) => patron.test(sql));

describe('N3 · hoja con driver (servicio + stub de BD)', () => {
  test('N3-01 · create deduplica insumos y calcula costo = Σ(costo_unit × cantidad) = 18.000', async () => {
    prepararCatalogo();
    await productosService.create({
      local_id: IDS.LOCAL, nombre: 'Churrasco 400 g', precio_venta: 45000,
      insumos: [
        { insumo_id: CARNE, cantidad_requerida: 0.25 },
        { insumo_id: CARNE, cantidad_requerida: 0.25 },   // duplicado → se suma
        { insumo_id: PAPA,  cantidad_requerida: 2 },
      ],
    });
    const [insert] = sentencias(/INSERT INTO productos/);
    expect(insert.params[4]).toBe(18000);                          // 0,5 × 30.000 + 2 × 1.500
    expect(sentencias(/INSERT INTO producto_insumos/)).toHaveLength(2);
  });

  test('N3-02 · create sin receta → costo de producción 0', async () => {
    prepararCatalogo();
    await productosService.create({ local_id: IDS.LOCAL, nombre: 'Limonada', precio_venta: 9000, insumos: [] });
    const [insert] = sentencias(/INSERT INTO productos/);
    expect(insert.params[4]).toBe(0);
  });

  test('N3-03 · Si falla un INSERT de la receta → ROLLBACK (el producto no queda a medias)', async () => {
    prepararCatalogo();
    db.__cuando(/INSERT INTO producto_insumos/, () => { throw new Error('violates foreign key constraint'); });
    await expect(productosService.create({
      local_id: IDS.LOCAL, nombre: 'X', precio_venta: 1000, insumos: [{ insumo_id: CARNE, cantidad_requerida: 1 }],
    })).rejects.toThrow(/foreign key/);
    expect(db.__client.query).toHaveBeenCalledWith('ROLLBACK');
  });
});

describe('N3 · integrado (HTTP → controller → servicio real)', () => {
  test('N3-04 · POST /productos con costo = precio → 400 (RF-10, valor límite)', async () => {
    prepararCatalogo();
    const res = await request(app).post('/api/v1/productos').set('Authorization', tokenPara('JEFE'))
      .send({ nombre: 'Plato sin margen', precio_venta: 10000, costo_produccion: 10000 });
    expect(res.status).toBe(400);
  });

  test('N3-05 · POST /productos con receta → 201 y costo calculado por el servidor', async () => {
    prepararCatalogo();
    const res = await request(app).post('/api/v1/productos').set('Authorization', tokenPara('JEFE'))
      .send({ nombre: 'Churrasco 400 g', precio_venta: 45000, insumos: [{ insumo_id: CARNE, cantidad_requerida: 0.5 }, { insumo_id: PAPA, cantidad_requerida: 2 }] });
    expect(res.status).toBe(201);
    expect(res.body.costo_produccion).toBe('18000');
  });

  test('N3-06 · POST /productos con token de EMPLEADO → 403 (RF-06)', async () => {
    const res = await request(app).post('/api/v1/productos').set('Authorization', tokenPara('EMPLEADO'))
      .send({ nombre: 'X', precio_venta: 1000 });
    expect(res.status).toBe(403);
  });

  test('N3-07 · GET /productos con token de EMPLEADO no expone costo ni margen (RF-09)', async () => {
    db.__reset();
    db.__cuando(/FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id WHERE p.activo = true/, () => ({
      rows: [{ id: 'prod-1', nombre: 'Churrasco 400 g', precio_venta: '45000', costo_produccion: '18000', margen: '27000' }],
    }));
    const res = await request(app).get('/api/v1/productos').set('Authorization', tokenPara('EMPLEADO'));
    expect(res.status).toBe(200);
    expect(res.body[0]).not.toHaveProperty('costo_produccion');
    expect(res.body[0]).not.toHaveProperty('margen');
  });

  test('N3-08 · DELETE /productos/:id desactiva (UPDATE activo = false), no borra (RF-08)', async () => {
    db.__reset();
    db.__cuando(/UPDATE productos SET activo = false/, () => ({ rows: [{ id: 'prod-1' }] }));
    const res = await request(app).delete('/api/v1/productos/prod-1').set('Authorization', tokenPara('JEFE'));
    expect(res.status).toBe(200);
    expect(sentencias(/DELETE FROM productos/)).toHaveLength(0);
  });
});
