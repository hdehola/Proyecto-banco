const { database, dbTramitacion } = require('../db');

// Endpoint de prueba
const index = (req, res) => {
    res.json({ message: 'Probando... La prueba de API_Validaciones fue un éxito!' });
};

// Crear tablas (solo para desarrollo)
const createTable = (req, res) => {
    const queries = [
        `CREATE TABLE IF NOT EXISTS prestamos_activados (
            id INT AUTO_INCREMENT PRIMARY KEY,
            solicitud_id INT NOT NULL,
            fecha_activacion DATETIME NOT NULL,
            monto_desembolsado DECIMAL(10,2) NOT NULL,
            estado VARCHAR(30) NOT NULL DEFAULT 'ACTIVO',
            fecha_creacion DATETIME NOT NULL,
            INDEX idx_estado (estado),
            INDEX idx_solicitud (solicitud_id)
        )`,
        `CREATE TABLE IF NOT EXISTS pagos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            prestamo_id INT NOT NULL,
            numero_cuota INT NOT NULL,
            monto_cuota DECIMAL(10,2) NOT NULL,
            fecha_vencimiento DATE NOT NULL,
            fecha_pago DATE,
            estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
            monto_pagado DECIMAL(10,2) DEFAULT 0,
            fecha_creacion DATETIME NOT NULL,
            FOREIGN KEY (prestamo_id) REFERENCES prestamos_activados(id) ON DELETE CASCADE,
            INDEX idx_estado (estado),
            INDEX idx_fecha_vencimiento (fecha_vencimiento)
        )`,
        `CREATE TABLE IF NOT EXISTS validaciones (
            id INT AUTO_INCREMENT PRIMARY KEY,
            solicitud_id INT NOT NULL,
            tipo_validacion VARCHAR(50) NOT NULL,
            resultado VARCHAR(30) NOT NULL,
            observaciones TEXT,
            fecha_validacion DATETIME NOT NULL,
            INDEX idx_solicitud (solicitud_id),
            INDEX idx_tipo (tipo_validacion)
        )`
    ];

    let completed = 0;
    queries.forEach((query, index) => {
        database.query(query, (err) => {
            if (err) {
                console.error(`Error al crear tabla ${index + 1}:`, err);
                return res.status(500).json({ error: `Error al crear tabla ${index + 1}` });
            }
            completed++;
            if (completed === queries.length) {
                res.json({ message: 'Tablas creadas correctamente' });
            }
        });
    });
};

// Activar préstamo (después de aprobación)
const activarPrestamo = (req, res) => {
    const { solicitud_id } = req.body;

    if (!solicitud_id) {
        return res.status(400).json({ error: 'ID de solicitud es obligatorio' });
    }

    // Verificar que la solicitud existe y está aprobada (en BD_TRAMITACION)
    const querySolicitud = `SELECT s.*, sim.monto_solicitado, sim.valor_cuota, sim.plazo_meses
                           FROM solicitudes_prestamo s
                           INNER JOIN simulaciones sim ON s.simulacion_id = sim.id
                           WHERE s.id = ? AND s.estado = 'APROBADO'`;

    dbTramitacion.query(querySolicitud, [solicitud_id], (err, results) => {
        if (err) {
            console.error('Error al verificar solicitud:', err);
            return res.status(500).json({ error: 'Error al verificar solicitud' });
        }

        if (results.length === 0) {
            return res.status(404).json({ 
                error: 'Solicitud no encontrada o no está aprobada' 
            });
        }

        const solicitud = results[0];

        // Verificar si ya existe un préstamo activado para esta solicitud
        const queryExistente = 'SELECT id FROM prestamos_activados WHERE solicitud_id = ?';
        database.query(queryExistente, [solicitud_id], (err, existentes) => {
            if (err) {
                console.error('Error al verificar préstamo existente:', err);
                return res.status(500).json({ error: 'Error al verificar préstamo existente' });
            }

            if (existentes.length > 0) {
                return res.status(400).json({ 
                    error: 'Ya existe un préstamo activado para esta solicitud' 
                });
            }

            // Crear préstamo activado
            const query = `INSERT INTO prestamos_activados 
                          (solicitud_id, fecha_activacion, monto_desembolsado, estado, fecha_creacion)
                          VALUES (?, NOW(), ?, 'ACTIVO', NOW())`;

            database.query(query, [solicitud_id, solicitud.monto_solicitado], (err, result) => {
                if (err) {
                    console.error('Error al activar préstamo:', err);
                    return res.status(500).json({ error: 'Error al activar préstamo' });
                }

                const prestamoId = result.insertId;

                // Crear registros de cuotas
                crearCuotas(prestamoId, solicitud.valor_cuota, solicitud.plazo_meses, (err) => {
                    if (err) {
                        console.error('Error al crear cuotas:', err);
                        return res.status(500).json({ error: 'Error al crear cuotas' });
                    }

                    res.status(201).json({
                        id: prestamoId,
                        solicitud_id: solicitud_id,
                        monto_desembolsado: parseFloat(solicitud.monto_solicitado),
                        estado: 'ACTIVO',
                        mensaje: 'Préstamo activado correctamente'
                    });
                });
            });
        });
    });
};

// Crear cuotas para un préstamo
const crearCuotas = (prestamoId, valorCuota, plazoMeses, callback) => {
    const cuotas = [];
    const hoy = new Date();

    for (let i = 1; i <= plazoMeses; i++) {
        const fechaVencimiento = new Date(hoy);
        fechaVencimiento.setMonth(hoy.getMonth() + i);
        
        cuotas.push([
            prestamoId,
            i,
            valorCuota,
            fechaVencimiento.toISOString().split('T')[0],
            'PENDIENTE',
            0,
            new Date().toISOString().slice(0, 19).replace('T', ' ')
        ]);
    }

    const query = `INSERT INTO pagos 
                   (prestamo_id, numero_cuota, monto_cuota, fecha_vencimiento, estado, monto_pagado, fecha_creacion)
                   VALUES ?`;

    database.query(query, [cuotas], callback);
};

// Obtener préstamos activados
const obtenerPrestamos = (req, res) => {
    const { estado } = req.query;
    let query = `SELECT p.*, s.nombre, s.rut, s.email
                 FROM prestamos_activados p
                 INNER JOIN solicitudes_prestamo s ON p.solicitud_id = s.id`;

    if (estado) {
        query += ' WHERE p.estado = ?';
        database.query(query, [estado], (err, results) => {
            if (err) {
                console.error('Error al obtener préstamos:', err);
                return res.status(500).json({ error: 'Error al obtener préstamos' });
            }
            res.json(results);
        });
    } else {
        database.query(query, (err, results) => {
            if (err) {
                console.error('Error al obtener préstamos:', err);
                return res.status(500).json({ error: 'Error al obtener préstamos' });
            }
            res.json(results);
        });
    }
};

// Obtener préstamo por ID
const obtenerPrestamo = (req, res) => {
    const { id } = req.params;

    const query = `SELECT p.*, s.nombre, s.rut, s.email, s.telefono
                  FROM prestamos_activados p
                  INNER JOIN solicitudes_prestamo s ON p.solicitud_id = s.id
                  WHERE p.id = ?`;

    database.query(query, [id], (err, results) => {
        if (err) {
            console.error('Error al obtener préstamo:', err);
            return res.status(500).json({ error: 'Error al obtener préstamo' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Préstamo no encontrado' });
        }

        // Obtener cuotas
        const queryCuotas = 'SELECT * FROM pagos WHERE prestamo_id = ? ORDER BY numero_cuota';
        database.query(queryCuotas, [id], (err, cuotas) => {
            if (err) {
                console.error('Error al obtener cuotas:', err);
                return res.status(500).json({ error: 'Error al obtener cuotas' });
            }

            res.json({
                ...results[0],
                cuotas: cuotas
            });
        });
    });
};

// Registrar pago de cuota
const registrarPago = (req, res) => {
    const { prestamo_id, numero_cuota, monto_pagado } = req.body;

    if (!prestamo_id || !numero_cuota || !monto_pagado) {
        return res.status(400).json({ 
            error: 'prestamo_id, numero_cuota y monto_pagado son obligatorios' 
        });
    }

    // Verificar que la cuota existe
    const queryCuota = 'SELECT * FROM pagos WHERE prestamo_id = ? AND numero_cuota = ?';
    database.query(queryCuota, [prestamo_id, numero_cuota], (err, results) => {
        if (err) {
            console.error('Error al verificar cuota:', err);
            return res.status(500).json({ error: 'Error al verificar cuota' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Cuota no encontrada' });
        }

        const cuota = results[0];

        if (cuota.estado === 'PAGADO') {
            return res.status(400).json({ error: 'Esta cuota ya está pagada' });
        }

        const montoPagado = parseFloat(monto_pagado);
        const montoCuota = parseFloat(cuota.monto_cuota);

        if (montoPagado < montoCuota) {
            return res.status(400).json({ 
                error: `El monto pagado ($${montoPagado}) es menor al monto de la cuota ($${montoCuota})` 
            });
        }

        // Actualizar cuota
        const query = `UPDATE pagos 
                      SET estado = 'PAGADO', 
                          monto_pagado = ?, 
                          fecha_pago = CURDATE()
                      WHERE prestamo_id = ? AND numero_cuota = ?`;

        database.query(query, [montoPagado, prestamo_id, numero_cuota], (err, result) => {
            if (err) {
                console.error('Error al registrar pago:', err);
                return res.status(500).json({ error: 'Error al registrar pago' });
            }

            // Verificar si todas las cuotas están pagadas
            const queryTodas = 'SELECT COUNT(*) as total, SUM(CASE WHEN estado = "PAGADO" THEN 1 ELSE 0 END) as pagadas FROM pagos WHERE prestamo_id = ?';
            database.query(queryTodas, [prestamo_id], (err, stats) => {
                if (!err && stats[0].total === stats[0].pagadas) {
                    // Marcar préstamo como completado
                    database.query('UPDATE prestamos_activados SET estado = "COMPLETADO" WHERE id = ?', [prestamo_id]);
                }
            });

            res.json({
                mensaje: 'Pago registrado correctamente',
                cuota: {
                    prestamo_id,
                    numero_cuota,
                    monto_pagado: montoPagado,
                    estado: 'PAGADO'
                }
            });
        });
    });
};

// Obtener cuotas de un préstamo
const obtenerCuotas = (req, res) => {
    const { prestamo_id } = req.params;
    const { estado } = req.query;

    let query = 'SELECT * FROM pagos WHERE prestamo_id = ?';
    const params = [prestamo_id];

    if (estado) {
        query += ' AND estado = ?';
        params.push(estado);
    }

    query += ' ORDER BY numero_cuota';

    database.query(query, params, (err, results) => {
        if (err) {
            console.error('Error al obtener cuotas:', err);
            return res.status(500).json({ error: 'Error al obtener cuotas' });
        }

        res.json(results);
    });
};

// Crear validación
const crearValidacion = (req, res) => {
    const { solicitud_id, tipo_validacion, resultado, observaciones } = req.body;

    if (!solicitud_id || !tipo_validacion || !resultado) {
        return res.status(400).json({ 
            error: 'solicitud_id, tipo_validacion y resultado son obligatorios' 
        });
    }

    const resultadosValidos = ['APROBADO', 'RECHAZADO', 'PENDIENTE'];
    if (!resultadosValidos.includes(resultado)) {
        return res.status(400).json({ 
            error: 'resultado debe ser: APROBADO, RECHAZADO o PENDIENTE' 
        });
    }

    const query = `INSERT INTO validaciones 
                   (solicitud_id, tipo_validacion, resultado, observaciones, fecha_validacion)
                   VALUES (?, ?, ?, ?, NOW())`;

    database.query(query, [solicitud_id, tipo_validacion, resultado, observaciones || null], (err, result) => {
        if (err) {
            console.error('Error al crear validación:', err);
            return res.status(500).json({ error: 'Error al crear validación' });
        }

        res.status(201).json({
            id: result.insertId,
            solicitud_id,
            tipo_validacion,
            resultado,
            observaciones,
            mensaje: 'Validación creada correctamente'
        });
    });
};

// Obtener validaciones de una solicitud
const obtenerValidaciones = (req, res) => {
    const { solicitud_id } = req.params;

    const query = 'SELECT * FROM validaciones WHERE solicitud_id = ? ORDER BY fecha_validacion DESC';
    database.query(query, [solicitud_id], (err, results) => {
        if (err) {
            console.error('Error al obtener validaciones:', err);
            return res.status(500).json({ error: 'Error al obtener validaciones' });
        }

        res.json(results);
    });
};

module.exports = {
    index,
    createTable,
    activarPrestamo,
    obtenerPrestamos,
    obtenerPrestamo,
    registrarPago,
    obtenerCuotas,
    crearValidacion,
    obtenerValidaciones
};
