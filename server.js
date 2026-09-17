const app = require('./app');
const { PORT } = require('./src/config/env');
const { connectDB } = require('./src/config/db');

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
