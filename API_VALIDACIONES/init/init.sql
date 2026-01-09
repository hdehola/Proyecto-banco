CREATE DATABASE IF NOT EXISTS BD_VALIDACIONES;

USE BD_VALIDACIONES;

CREATE TABLE IF NOT EXISTS prestamos_activados (
    id INT AUTO_INCREMENT PRIMARY KEY,
    solicitud_id INT NOT NULL,
    fecha_activacion DATETIME NOT NULL,
    monto_desembolsado DECIMAL(10,2) NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'ACTIVO',
    fecha_creacion DATETIME NOT NULL,
    INDEX idx_estado (estado),
    INDEX idx_solicitud (solicitud_id),
    INDEX idx_fecha_activacion (fecha_activacion)
);

CREATE TABLE IF NOT EXISTS pagos (
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
    INDEX idx_fecha_vencimiento (fecha_vencimiento),
    INDEX idx_prestamo_cuota (prestamo_id, numero_cuota)
);

CREATE TABLE IF NOT EXISTS validaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    solicitud_id INT NOT NULL,
    tipo_validacion VARCHAR(50) NOT NULL,
    resultado VARCHAR(30) NOT NULL,
    observaciones TEXT,
    fecha_validacion DATETIME NOT NULL,
    INDEX idx_solicitud (solicitud_id),
    INDEX idx_tipo (tipo_validacion),
    INDEX idx_fecha_validacion (fecha_validacion)
);

