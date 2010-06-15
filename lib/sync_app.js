(function(){
  var db, errorHandler, flow, nosqlite, nsl_req, nsl_res, sys;
  // This is the Connect app definition file for the sync module of NoSQLite
  // See: http://github.com/extjs/Connect
  // This should be plugged into the NoSQLite Connect app server configuration
  nosqlite = require("./index");
  sys = require("sys");
  flow = require("flow");
  require("underscore");
  errorHandler = function(err, req, res, next) {
    res.writeHead(200, {
      'Content-Type': 'text/plain'
    });
    return res.end(JSON.stringify(err));
  };
  nsl_req = {};
  nsl_res = {};
  db = {};
  module.exports = require('connect').createServer([
    {
      module: {
        handle: function(req, res, next) {
          req.body = '';
          req.setEncoding('utf8');
          req.addListener('data', function(chunk) {
            return req.body += chunk;
          });
          return req.addListener('end', function() {
            var _a, db_file;
            try {
              nsl_req = JSON.parse(req.body);
            } catch (err) {
              return next(new Error("Invalid JSON in body"));
            }
            if (!(typeof (_a = nsl_req.db) !== "undefined" && _a !== null)) {
              return next(new Error("Missing db name"));
            }
            db_file = ("./test/" + (nsl_req.db));
            nsl_res = {
              objs: [],
              gimme: []
            };
            db = nosqlite.open(db_file, {
              sync_mode: true
            }, function(err, db) {
              if ((typeof err !== "undefined" && err !== null)) {
                return next(err);
              }
              return next();
            });
            return db;
          });
        },
        handleError: errorHandler
      },
      route: '/nsl'
    }, {
      module: {
        handle: function(req, res, next) {
          return db.pull_response(nsl_req, nsl_res, function(err) {
            if ((typeof err !== "undefined" && err !== null)) {
              return next(err);
            }
            return next();
          });
        },
        handleError: errorHandler
      },
      route: '/nsl/pull'
    }, {
      module: {
        handle: function(req, res, next) {
          return db.push_response(nsl_req, nsl_res, function(err) {
            if ((typeof err !== "undefined" && err !== null)) {
              return next(err);
            }
            return next();
          });
        },
        handleError: errorHandler
      },
      route: "/nsl/push"
    }, {
      module: {
        handle: function(req, res, next) {
          nsl_res.objs = _.flatten(nsl_res.objs);
          nsl_res.gimme = _.flatten(nsl_res.gimme);
          res.writeHead(200, {
            'Content-Type': 'application/json'
          });
          return res.end(JSON.stringify(nsl_res));
        },
        handleError: errorHandler
      },
      route: "/nsl"
    }
  ]);
})();
