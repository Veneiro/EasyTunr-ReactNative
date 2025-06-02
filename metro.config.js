const { getDefaultConfig } = require('expo/metro-config');

module.exports = (async () => {
  const config = await getDefaultConfig(__dirname);
  return {
    ...config,
    server: {
      ...config.server,
      enhanceMiddleware: (middleware) => {
        return (req, res, next) => {
          if (req.url.includes('index.bundle')) {
            res.setHeader('Content-Type', 'application/javascript');
          }
          return middleware(req, res, next);
        };
      },
    },
  };
})();