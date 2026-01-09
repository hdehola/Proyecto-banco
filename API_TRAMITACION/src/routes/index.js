const express = require('express');
const router = new express.Router();

const index = require('../controllers/index');

// Endpoint de prueba
router.get('/', index.index);

// Endpoint para crear tablas (solo desarrollo)
router.get('/createTable', index.createTable);

// Endpoints de simulación
router.post('/simulacion', index.crearSimulacion);
router.get('/simulacion/:id', index.obtenerSimulacion);

// Endpoints de solicitudes
router.post('/solicitud', index.crearSolicitud);
router.get('/solicitudes', index.obtenerSolicitudes);
router.get('/solicitud/:id', index.obtenerSolicitud);
router.put('/solicitud/:id/estado', index.actualizarEstadoSolicitud);

module.exports = router;
