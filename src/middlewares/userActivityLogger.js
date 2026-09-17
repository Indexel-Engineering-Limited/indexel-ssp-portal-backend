const { recordUserLog } = require('../utils/userLogger');

const userActivityLogger = (req, res, next) => {
  res.on('finish', () => {
    const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    if (!isWrite || !req.user || res.statusCode >= 500) return;

    recordUserLog({
      user: req.user,
      action: `${req.method} ${req.baseUrl || ''}${req.path}`.trim(),
      method: req.method,
      endpoint: req.originalUrl,
      statusCode: res.statusCode,
    });
  });

  next();
};

module.exports = userActivityLogger;
