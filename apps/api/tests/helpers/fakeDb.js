/**
 * Stub de shared/database/db.js (capa de persistencia D1/D2).
 * - Responde según el texto SQL con reglas configurables por cada prueba.
 * - Imita a `pg`: los NUMERIC llegan como string y, si la cantidad de parámetros
 *   no coincide con los marcadores $n, rechaza la consulta con el mismo mensaje de PostgreSQL.
 * Uso: jest.mock('<ruta>/db', () => require('<ruta>/fakeDb').crearFakeDb());
 */
function validarParametros(sql, params) {
  const indices = [...String(sql).matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
  const requeridos = indices.length ? Math.max(...indices) : 0;
  if (requeridos !== params.length) {
    throw new Error(`bind message supplies ${params.length} parameters, but prepared statement "" requires ${requeridos}`);
  }
}

function crearFakeDb() {
  const reglas = []; // [{ patron: RegExp, responder: (params, sql) => resultado }]

  const ejecutar = async (sql, params = []) => {
    validarParametros(sql, params);
    const regla = reglas.find((r) => r.patron.test(sql));
    if (!regla) return { rows: [] };
    return regla.responder(params, sql);
  };

  const query = jest.fn(ejecutar);
  const client = { query: jest.fn(ejecutar), release: jest.fn() };

  return {
    query,
    connect: jest.fn(async () => client),
    pool: { connect: jest.fn(async () => client), end: jest.fn() },
    // API de configuración para las pruebas
    __client: client,
    __cuando(patron, responder) { reglas.unshift({ patron, responder }); },
    __reset() { reglas.length = 0; query.mockClear(); client.query.mockClear(); },
    /** Todas las sentencias ejecutadas (pool + cliente de transacción), en orden. */
    __sentencias() {
      return [...query.mock.calls, ...client.query.mock.calls].map(([sql, params]) => ({ sql, params: params || [] }));
    },
  };
}

module.exports = { crearFakeDb };
