const express = require('express');
const router = new express.Router();

const index = require('../controllers/index');

// Endpoint de prueba
router.get('/', index.index);

// Endpoint para crear tablas (solo desarrollo)
router.get('/createTable', index.createTable);

// Endpoints de préstamos activados
router.post('/prestamo/activar', index.activarPrestamo);
router.get('/prestamos', index.obtenerPrestamos);
router.get('/prestamo/:id', index.obtenerPrestamo);

// Endpoints de pagos
router.post('/pago', index.registrarPago);
router.get('/prestamo/:prestamo_id/cuotas', index.obtenerCuotas);

// Endpoints de validaciones
router.post('/validacion', index.crearValidacion);
router.get('/solicitud/:solicitud_id/validaciones', index.obtenerValidaciones);

module.exports = router;
