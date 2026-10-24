const jwt = require('jsonwebtoken');

// IDs fijos (UUID) para que las comparaciones estrictas de los controladores funcionen
const IDS = {
  LOCAL:    '11111111-1111-4111-8111-111111111111',
  ADMIN:    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  JEFE:     'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  EMPLEADO: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  OTRO_EMP: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
};

/** Payload igual al que firma auth/service.js (id, rol, rol_id, local_id, email). */
function payloadPara(rol, extra = {}) {
  return {
    id: IDS[rol], rol, rol_id: { ADMIN: 1, JEFE: 2, EMPLEADO: 3 }[rol],
    local_id: IDS.LOCAL, email: `${rol.toLowerCase()}@brasas.test`, ...extra,
  };
}

/** Cabecera Authorization con un JWT válido por 10 minutos. */
function tokenPara(rol, extra = {}, opciones = { expiresIn: '10m' }) {
  return `Bearer ${jwt.sign(payloadPara(rol, extra), process.env.JWT_SECRET, opciones)}`;
}

/** Espera a que terminen las tareas asíncronas disparadas en res.on('finish'). */
const esperarAsync = (ms = 25) => new Promise((r) => setTimeout(r, ms));

module.exports = { IDS, payloadPara, tokenPara, esperarAsync };
