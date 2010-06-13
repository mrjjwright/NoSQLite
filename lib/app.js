(function(){
  // This is the Connect app definition file for NoSQLite
  // See: http://github.com/extjs/Connect
  // This can be plugged into any Connect app server configuration
  module.exports = require('connect').createServer([
    {
      filter: 'log',
      format: ':remote-addr :method :url :status :res[Content-Length] :response-timems'
    }, {
      filter: 'response-time'
    }, {
      module: require('./nsl_sync_connect')
    }, {
      module: {
        handle: function(req, res, next) {
          res.writeHead(200, {
            'Content-Type': 'text/plain'
          });
          return res.end('GET /hello or /world');
        }
      }
    }
  ]);
})();
