-- Crear ambas bases de datos
CREATE DATABASE IF NOT EXISTS BD_TRAMITACION;
CREATE DATABASE IF NOT EXISTS BD_VALIDACIONES;

-- Configurar BD_TRAMITACION
USE BD_TRAMITACION;

CREATE TABLE IF NOT EXISTS simulaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    monto_solicitado DECIMAL(10,2) NOT NULL,
    plazo_meses INT NOT NULL,
    tasa_interes_aplicada DECIMAL(5,3) NOT NULL,
    valor_cuota DECIMAL(10,2) NOT NULL,
    fecha_simulacion DATETIME NOT NULL,
    INDEX idx_fecha (fecha_simulacion)
);

CREATE TABLE IF NOT EXISTS solicitudes_prestamo (
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
    INDEX idx_rut (rut),
    INDEX idx_fecha_solicitud (fecha_solicitud)
);

-- Configurar BD_VALIDACIONES
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

