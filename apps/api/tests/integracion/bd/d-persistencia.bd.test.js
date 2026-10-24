/**
 * D1 · Acceso a datos (shared/database/db.js)  ·  D2 · PostgreSQL de pruebas (Supabase brasas-test)
 * Requiere apps/api/.env.test (DB_ENTORNO=pruebas).
 * - D2 hoja (CI-A04): el driver consulta el catálogo de PostgreSQL directamente con `pg`.
 * - (D1-D2) (CI-A08, CI-DP7, CI-DA3): el pool real de db.js contra la BD de pruebas.
 */
const { db } = require('../../helpers/fixturesBD');   // valida .env.test antes de abrir conexiones
const { Client } = require('pg');

const TABLAS = ['locales', 'roles', 'usuarios', 'categorias', 'productos', 'producto_insumos',
  'insumos', 'stock_movimientos', 'pedidos', 'pedido_items', 'historial'];

describe('D2 · hoja con driver (cliente pg independiente)', () => {
  let cliente;
  beforeAll(async () => {
    cliente = new Client({
      host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
      user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false },
    });
    await cliente.connect();
  });
  afterAll(() => cliente.end());

  test('D2-01 · Existen las 11 tablas del modelo', async () => {
    const r = await cliente.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name::text = ANY($1::text[])", [TABLAS]);
    expect(r.rows.map((x) => x.table_name).sort()).toEqual([...TABLAS].sort());
  });

  test('D2-02 · Existen las funciones de los triggers de inventario', async () => {
    const r = await cliente.query(
      "SELECT proname FROM pg_proc WHERE proname IN ('fn_completar_pedido', 'fn_aplicar_movimiento')");
    expect(r.rows.map((x) => x.proname)).toEqual(expect.arrayContaining(['fn_completar_pedido']));
  });

  test('D2-03 · La tabla pedidos tiene un trigger asociado (descuento automático, RF-13)', async () => {
    const r = await cliente.query(
      "SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.pedidos'::regclass AND NOT tgisinternal");
    expect(r.rows.length).toBeGreaterThan(0);
  });

  test('D2-04 · Los roles admin, jefe y empleado están cargados (los usa el registro)', async () => {
    const r = await cliente.query('SELECT LOWER(nombre) AS nombre FROM roles');
    expect(r.rows.map((x) => x.nombre)).toEqual(expect.arrayContaining(['admin', 'jefe', 'empleado']));
  });
});

describe('D1-D2 · pool de db.js contra la BD de pruebas', () => {
  afterAll(() => db.pool.end());

  test('D1-01 · db.query ejecuta una consulta parametrizada', async () => {
    const r = await db.query('SELECT $1::int + $2::int AS suma', [2, 3]);
    expect(r.rows[0].suma).toBe(5);
  });

  test('D1-02 · Transacción: lo insertado antes de ROLLBACK no persiste', async () => {
    const cliente = await db.pool.connect();
    const nombre = `Local rollback ${Date.now()}`;
    try {
      await cliente.query('BEGIN');
      await cliente.query('INSERT INTO locales (nombre, activo, created_at, updated_at) VALUES ($1, true, NOW(), NOW())', [nombre]);
      await cliente.query('ROLLBACK');
    } finally { cliente.release(); }
    const r = await db.query('SELECT id FROM locales WHERE nombre = $1', [nombre]);
    expect(r.rows).toHaveLength(0);
  });

  test('D1-03 · El pool nunca abre más de 3 conexiones (límite del plan gratuito)', async () => {
    const inicio = Date.now();
    await Promise.all(Array.from({ length: 6 }, () => db.query('SELECT pg_sleep(0.5)')));
    expect(db.pool.totalCount).toBeLessThanOrEqual(3);
    expect(Date.now() - inicio).toBeGreaterThanOrEqual(900);   // 6 consultas / 3 conexiones ≈ 2 tandas
  });

  test('D1-04 · Parámetros de más → PostgreSQL rechaza la consulta (base de DEF-08)', async () => {
    await expect(db.query('SELECT $1::int AS x', [1, 2])).rejects.toThrow(/bind message supplies 2 parameters/);
  });
});
