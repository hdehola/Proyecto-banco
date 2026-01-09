const express = require('express');
const morgan = require('morgan');
const path = require('path');
const app = express();
require('dotenv').config();

const routes = require('./src/routes/index');

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api', routes);

// Ruta principal - servir home.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

app.listen(process.env.PORT_API, () => {
    console.log('Server running!');
});
