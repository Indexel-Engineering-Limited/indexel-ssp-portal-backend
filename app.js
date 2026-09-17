const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const routes = require('./src/routes');
const errorHandler = require('./src/middlewares/errorHandler');
const userActivityLogger = require('./src/middlewares/userActivityLogger');

const app = express();

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://10.10.1.119:5173",
       "http://61.2.243.13:5173"
    ],
    credentials: true,
  })
);
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(userActivityLogger);
app.use(express.static("public"));
// Routes
app.use('/api', routes);

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'API is running' });
});

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;
