require('dotenv').config(); 
const database = require('../db');
const { Resend } = require('resend');
require('dotenv').config();
// Modificar variable con la API Key obtenida en resend.com
const resend = new Resend("re_GSjpCWGu_Bm1XG6bkW4mo8QtSAfoQHgHr");

//Envía el email con el estado y la ruta de redirección
const enviarEmailSolicitud = async (toEmail, nombre, estado, solicitudId) => {

    const isSuccess = Math.random() < 0.7 ? 1 : 0;
    
    const rutaRedireccion = isSuccess 
        ? `http://localhost:8080/aprobacion_final.html?id=${solicitudId}`
        : `http://localhost:8080/rechazo_final.html?id=${solicitudId}`;
        
    const estadoTexto = isSuccess ? 'PENDIENTE (¡Va bien!)' : 'RECHAZADA';
    const colorBoton = isSuccess ? '#007bff' : '#dc3545';
    const asunto = `Estado de tu Solicitud #${solicitudId} - ${estadoTexto}`;

    const cuerpoHtml = `
        <p>Hola ${nombre},</p>
        <p>Te informamos el estado de tu solicitud de préstamo <strong>#${solicitudId}</strong>.</p>
        <p>En este momento, el estado es: 
            <span style="font-weight: bold; color: ${isSuccess ? '#28a745' : '#dc3545'};">${estadoTexto}</span>
        </p>
        
        <p>Puedes ver los detalles de tu solicitud y el estado final en el siguiente enlace:</p>
        
        <a href="${rutaRedireccion}" 
           style="display: inline-block; padding: 10px 20px; color: white; background-color: ${colorBoton}; text-decoration: none; border-radius: 5px;">
            Ver Detalles de la Solicitud
        </a>
        
        ${!isSuccess ? `<p>Si la solicitud fue rechazada, el enlace te llevará a las razones específicas.</p>` : ''}
        
        <p>Gracias por preferir nuestros servicios.</p>
        <p>Atentamente,<br>Acme</p>
    `;

    try {
        const { data, error } = await resend.emails.send({
            from: 'Acme <onboarding@resend.dev>', // Email de origen solicitado
            to: [toEmail],
            subject: asunto,
            html: cuerpoHtml,
        });

        if (error) {
            console.error('Error al enviar email con Resend:', error);
        } else {
            console.log('Email enviado correctamente:', data);
        }
    } catch (e) {
        console.error('Excepción al intentar enviar email:', e);
    }
};


// Función para calcular la simulación de préstamo
const calcularSimulacion = (monto, plazo) => {
    let tasaMensual;
    
    if (monto < 100000) {
        tasaMensual = 0.02; // 2% mensual
    } else if (monto < 500000) {
        tasaMensual = 0.015; // 1.5% mensual
    } else {
        tasaMensual = 0.01; // 1% mensual
    }

    if (plazo <= 0 || monto <= 0) {
        return {
            tasa_interes_anual: 0,
            valor_cuota: 0,
            detalle_cuotas: []
        };
    }

    let valorCuota;
    if (tasaMensual > 0) {
        valorCuota = monto * (tasaMensual / (1 - Math.pow(1 + tasaMensual, -plazo)));
        valorCuota = Math.round(valorCuota);
    } else {
        valorCuota = Math.round(monto / plazo);
    }

    const detalleCuotas = [];
    let saldo = monto;

    for (let i = 1; i <= plazo; i++) {
        const interes = saldo * tasaMensual;
        const abonoCapital = valorCuota - interes;
        saldo -= abonoCapital;

        detalleCuotas.push({
            numero_cuota: i,
            capital: Math.round(abonoCapital),
            interes: Math.round(interes),
            valor_cuota: Math.round(valorCuota),
            saldo_pendiente: Math.round(Math.max(saldo, 0))
        });
    }

    // Ajuste final
    if (detalleCuotas.length > 0) {
        const ajusteFinal = detalleCuotas[detalleCuotas.length - 1].saldo_pendiente;
        if (ajusteFinal !== 0) {
            detalleCuotas[detalleCuotas.length - 1].capital += ajusteFinal;
            detalleCuotas[detalleCuotas.length - 1].valor_cuota += ajusteFinal;
            detalleCuotas[detalleCuotas.length - 1].saldo_pendiente = 0;
        }
    }

    return {
        tasa_interes_anual: Math.round(tasaMensual * 12 * 100 * 100) / 100,
        valor_cuota: Math.round(valorCuota),
        detalle_cuotas: detalleCuotas,
        tasa_mensual: tasaMensual
    };
};

// Crear simulación
const crearSimulacion = (req, res) => {
    const { monto, plazo } = req.body;

    // Validaciones
    if (!monto || !plazo) {
        return res.status(400).json({ error: 'Monto y plazo son obligatorios' });
    }

    const montoNum = parseFloat(monto);
    const plazoNum = parseInt(plazo);

    if (isNaN(montoNum) || isNaN(plazoNum) || montoNum <= 0 || plazoNum <= 0) {
        return res.status(400).json({ error: 'Monto y plazo deben ser números positivos' });
    }

    if (montoNum < 2000000 || montoNum > 80000000) {
        return res.status(400).json({ error: 'El monto debe estar entre $2.000.000 y $80.000.000' });
    }

    if (plazoNum < 6 || plazoNum > 60) {
        return res.status(400).json({ error: 'El plazo debe estar entre 6 y 60 meses' });
    }

    // Calcular simulación
    const resultados = calcularSimulacion(montoNum, plazoNum);
    const tasaInteresAplicada = resultados.tasa_interes_anual / 100;

    // Guardar en base de datos
    const query = `INSERT INTO simulaciones (monto_solicitado, plazo_meses, tasa_interes_aplicada, valor_cuota, fecha_simulacion) 
                   VALUES (?, ?, ?, ?, NOW())`;
    const values = [montoNum, plazoNum, tasaInteresAplicada, resultados.valor_cuota];

    database.query(query, values, (err, result) => {
        if (err) {
            console.error('Error al crear simulación:', err);
            return res.status(500).json({ error: 'Error al crear simulación' });
        }

        res.status(201).json({
            id: result.insertId,
            monto: montoNum,
            plazo: plazoNum,
            tasa_interes_anual: resultados.tasa_interes_anual,
            valor_cuota: resultados.valor_cuota,
            detalle_cuotas: resultados.detalle_cuotas
        });
    });
};

// Obtener simulación por ID 
const obtenerSimulacion = (req, res) => {
    const { id } = req.params;

    const query = 'SELECT * FROM simulaciones WHERE id = ?';
    database.query(query, [id], (err, results) => {
        if (err) {
            console.error('Error al obtener simulación:', err);
            return res.status(500).json({ error: 'Error al obtener simulación' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Simulación no encontrada' });
        }

        const simulacion = results[0];
        const resultados = calcularSimulacion(
            parseFloat(simulacion.monto_solicitado),
            simulacion.plazo_meses
        );

        res.json({
            ...simulacion,
            tasa_interes_anual: resultados.tasa_interes_anual,
            detalle_cuotas: resultados.detalle_cuotas
        });
    });
};

// Crear solicitud de préstamo (Lógica de estado y envío de email modificada)
const crearSolicitud = (req, res) => {
    const {
        simulacion_id,
        nombre,
        rut,
        email,
        telefono,
        fecha_nacimiento,
        fecha_vencimiento_cedula,
        ingreso_mensual,
        pais,
        region,
        calle,
        numero_domicilio,
        detalle_domicilio
    } = req.body;

    // Validaciones básicas
    const errores = [];
    if (!simulacion_id) errores.push('ID de simulación es obligatorio');
    if (!nombre) errores.push('Nombre es obligatorio');
    if (!rut) errores.push('RUT es obligatorio');
    if (!email) errores.push('Email es obligatorio');
    if (!telefono) errores.push('Teléfono es obligatorio');
    if (!fecha_nacimiento) errores.push('Fecha de nacimiento es obligatoria');
    if (!fecha_vencimiento_cedula) errores.push('Fecha de vencimiento de cédula es obligatoria');
    if (!ingreso_mensual) errores.push('Ingreso mensual es obligatorio');
    if (!pais) errores.push('País es obligatorio');
    if (!region) errores.push('Región es obligatoria');
    if (!calle) errores.push('Calle es obligatoria');
    if (!numero_domicilio) errores.push('Número de domicilio es obligatorio');

    if (errores.length > 0) {
        return res.status(400).json({ errores });
    }

    // Verificar que la simulación existe
    const querySimulacion = 'SELECT * FROM simulaciones WHERE id = ?';
    database.query(querySimulacion, [simulacion_id], (err, results) => {
        if (err) {
            console.error('Error al verificar simulación:', err);
            return res.status(500).json({ error: 'Error al verificar simulación' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Simulación no encontrada' });
        }

        const simulacion = results[0];

        // Verificar si ya existe una solicitud con este RUT
        const queryRut = 'SELECT id FROM solicitudes_prestamo WHERE rut = ?';
        database.query(queryRut, [rut], (err, rutResults) => {
            if (err) {
                console.error('Error al verificar RUT:', err);
                return res.status(500).json({ error: 'Error al verificar RUT' });
            }

            if (rutResults.length > 0) {
                return res.status(400).json({ error: 'Ya existe una solicitud con este RUT' });
            }

            // Validar admisibilidad (Reglas estrictas)
            const razonesRechazo = validarAdmisibilidad(
                fecha_nacimiento,
                fecha_vencimiento_cedula,
                ingreso_mensual,
                simulacion.valor_cuota,
                pais
            );

            let estado;
            let mensaje;
            
            // 1. Verificación de Admisibilidad
            if (razonesRechazo.length > 0) {
                // Estado de rechazo definitivo por no cumplir requisitos mínimos
                estado = 'RECHAZADO_ADMISIBILIDAD';
                mensaje = 'Solicitud rechazada por admisibilidad';
            } else {
                // *** CAMBIO CLAVE: Se elimina la aleatoriedad y se asigna PENDIENTE ***
                estado = 'PENDIENTE'; 
                mensaje = 'Solicitud creada exitosamente (PENDIENTE)';
                // Se elimina el bloque if (!esAprobado) { ... }
            }


            // Crear solicitud
            const query = `INSERT INTO solicitudes_prestamo 
                (simulacion_id, nombre, rut, email, telefono, fecha_nacimiento, 
                 fecha_vencimiento_cedula, ingreso_mensual, pais, region, calle, 
                 numero_domicilio, detalle_domicilio, estado, fecha_solicitud) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;

            const values = [
                simulacion_id,
                nombre,
                rut,
                email,
                telefono,
                fecha_nacimiento,
                fecha_vencimiento_cedula,
                ingreso_mensual,
                pais,
                region,
                calle,
                numero_domicilio,
                detalle_domicilio || null,
                estado
            ];

            database.query(query, values, (err, result) => {
                if (err) {
                    console.error('Error al crear solicitud:', err);
                    return res.status(500).json({ error: 'Error al crear solicitud' });
                }
                
                // LLAMADA AGREGADA: Envío del correo electrónico
                enviarEmailSolicitud(email, nombre, estado, result.insertId);

                const respuesta = {
                    id: result.insertId,
                    estado,
                    mensaje
                };

                // Si se rechaza (por admisibilidad o aleatoriamente), se envían las razones al frontend
                if (razonesRechazo.length > 0) {
                    respuesta.razones_rechazo = razonesRechazo;
                }

                res.status(201).json(respuesta);
            });
        });
    });
};

// Validar admisibilidad
const validarAdmisibilidad = (fechaNacimiento, fechaVencimiento, ingresoMensual, valorCuota, pais) => {
    const razones = [];
    const today = new Date();
    const nacimiento = new Date(fechaNacimiento);
    const vencimiento = new Date(fechaVencimiento);

    // Mayoría de edad
    const edad = today.getFullYear() - nacimiento.getFullYear() - 
        (today.getMonth() < nacimiento.getMonth() || 
         (today.getMonth() === nacimiento.getMonth() && today.getDate() < nacimiento.getDate()));
    
    if (edad < 18) {
        razones.push(`Debe ser mayor de 18 años (Edad calculada: ${edad} años)`);
    }

    // Cédula vigente
    if (vencimiento < today) {
        razones.push(`La cédula de identidad está vencida (Venció el: ${vencimiento.toLocaleDateString('es-CL')})`);
    }

    // Domicilio en Chile
    if (pais.toLowerCase() !== 'chile') {
        razones.push(`El domicilio debe estar en Chile (País ingresado: ${pais})`);
    }

    // Regla de endeudamiento (40% del ingreso)
    const porcentajeIngreso = (parseFloat(valorCuota) / parseFloat(ingresoMensual)) * 100;
    if (porcentajeIngreso > 40) {
        razones.push(
            `La cuota ($${parseFloat(valorCuota).toLocaleString('es-CL')}) supera el 40% de su ingreso ` +
            `($${parseFloat(ingresoMensual).toLocaleString('es-CL')}). (Cubre: ${porcentajeIngreso.toFixed(1)}%)`
        );
    }

    return razones;
};

// Obtener todas las solicitudes
const obtenerSolicitudes = (req, res) => {
    const { estado } = req.query;
    let query = `SELECT s.*, sim.monto_solicitado, sim.plazo_meses, sim.valor_cuota 
                 FROM solicitudes_prestamo s 
                 INNER JOIN simulaciones sim ON s.simulacion_id = sim.id`;

    if (estado) {
        query += ' WHERE s.estado = ?';
        database.query(query, [estado], (err, results) => {
            if (err) {
                console.error('Error al obtener solicitudes:', err);
                return res.status(500).json({ error: 'Error al obtener solicitudes' });
            }
            res.json(results);
        });
    } else {
        database.query(query, (err, results) => {
            if (err) {
                console.error('Error al obtener solicitudes:', err);
                return res.status(500).json({ error: 'Error al obtener solicitudes' });
            }
            res.json(results);
        });
    }
};

// Obtener solicitud por ID
const obtenerSolicitud = (req, res) => {
    const { id } = req.params;

    const query = `SELECT s.*, sim.monto_solicitado, sim.plazo_meses, sim.valor_cuota, 
                          sim.tasa_interes_aplicada, sim.fecha_simulacion
                   FROM solicitudes_prestamo s 
                   INNER JOIN simulaciones sim ON s.simulacion_id = sim.id
                   WHERE s.id = ?`;

    database.query(query, [id], (err, results) => {
        if (err) {
            console.error('Error al obtener solicitud:', err);
            return res.status(500).json({ error: 'Error al obtener solicitud' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }

        res.json(results[0]);
    });
};

// Actualizar estado de solicitud
const actualizarEstadoSolicitud = (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;

    const estadosValidos = ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'RECHAZADO_ADMISIBILIDAD'];
    if (!estado || !estadosValidos.includes(estado)) {
        return res.status(400).json({ 
            error: 'Estado inválido. Debe ser: PENDIENTE, APROBADO, RECHAZADO o RECHAZADO_ADMISIBILIDAD' 
        });
    }

    const query = 'UPDATE solicitudes_prestamo SET estado = ? WHERE id = ?';
    database.query(query, [estado, id], (err, result) => {
        if (err) {
            console.error('Error al actualizar estado:', err);
            return res.status(500).json({ error: 'Error al actualizar estado' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }

        res.json({ 
            id: parseInt(id), 
            estado, 
            mensaje: 'Estado actualizado correctamente' 
        });
    });
};

// Endpoint de prueba
const index = (req, res) => {
    res.json({ message: 'Probando... La prueba de API_Tramitacion fue un éxito!' });
};

// Crear tablas (solo para desarrollo)
const createTable = (req, res) => {
    const queries = [
        `CREATE TABLE IF NOT EXISTS simulaciones (
            id INT AUTO_INCREMENT PRIMARY KEY,
            monto_solicitado DECIMAL(10,2) NOT NULL,
            plazo_meses INT NOT NULL,
            tasa_interes_aplicada DECIMAL(5,3) NOT NULL,
            valor_cuota DECIMAL(10,2) NOT NULL,
            fecha_simulacion DATETIME NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS solicitudes_prestamo (
            id INT AUTO_INCREMENT PRIMARY KEY,
            simulacion_id INT NOT NULL,
            nombre VARCHAR(100) NOT NULL,
            rut VARCHAR(12) NOT NULL UNIQUE,
            email VARCHAR(100) NOT NULL,
            telefono VARCHAR(15) NOT NULL,
            fecha_nacimiento DATE NOT NULL,
            fecha_vencimiento_cedula DATE NOT NULL,
            ingreso_mensual DECIMAL(10,2) NOT NULL,
            pais VARCHAR(50) NOT NULL DEFAULT 'Chile',
            region VARCHAR(100),
            calle VARCHAR(100),
            numero_domicilio VARCHAR(20),
            detalle_domicilio VARCHAR(100),
            estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
            fecha_solicitud DATETIME NOT NULL,
            FOREIGN KEY (simulacion_id) REFERENCES simulaciones(id) ON DELETE CASCADE,
            INDEX idx_estado (estado),
            INDEX idx_rut (rut)
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

module.exports = {
    index,
    createTable,
    crearSimulacion,
    obtenerSimulacion,
    crearSolicitud,
    obtenerSolicitudes,
    obtenerSolicitud,
    actualizarEstadoSolicitud
};