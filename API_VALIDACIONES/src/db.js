const mysql = require('mysql2');

require('dotenv').config();

// Conexión a BD01_VALIDACIONES
const database = mysql.createConnection({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    host: process.env.DB_HOST
});

// Conexión a BD01_TRAMITACION (solo lectura para obtener información de solicitudes)
// Nota: Ambas bases de datos están en el mismo servidor MySQL
const dbTramitacion = mysql.createConnection({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME_TRAMITACION || 'BD01_TRAMITACION',
    port: process.env.DB_PORT,
    host: process.env.DB_HOST
});

module.exports = { database, dbTramitacion };
