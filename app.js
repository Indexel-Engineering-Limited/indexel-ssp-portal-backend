const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const routes = require('./src/routes');
const errorHandler = require('./src/middlewares/errorHandler');
const userActivityLogger = require('./src/middlewares/userActivityLogger');

const app = express();

app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://10.10.1.119:5173',
      'https://ssp.indexel.co.in',
      'https://grey-kangaroo-394580.hostingersite.com'
    ],
    credentials: true
  })
);

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(userActivityLogger);

// IMPORTANT
const publicPath = path.join(__dirname, 'public');

app.use('/employees', express.static(path.join(publicPath, 'employees')));
app.use('/qr-codes', express.static(path.join(publicPath, 'qr-codes')));

// Other public files
app.use(express.static(publicPath));

app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({ status: 'API is running' });
});

app.use(errorHandler);

module.exports = app;