(function(){
  var listen, sql, sqlite, sys, write_res;
  // NoSQLite http server functions
  sys = require("sys");
  require("underscore");
  sqlite = require("sqlite");
  sql = require("./sql");
  // Web API
  // --------------------------------------
  // Starts a webserver on the supplied port to serve http requests
  // for the instance's associated database.
  // If NoSQLite has already started a webserver on that port
  // this method returns silently.
  listen = function(port, host) {
    var http, self, server;
    if (!(typeof port !== "undefined" && port !== null)) {
      port = 5000;
    }
    if (!(typeof http !== "undefined" && http !== null)) {
      http = require("http");
    }
    self = this;
    server = http.createServer(function(request, response) {
      var _a, _b, body, table, url;
      sys.debug("NoSQLite received request");
      body = "";
      url = require("url").parse(request.url, true);
      if (!(typeof (_a = url.query) !== "undefined" && _a !== null) || !(typeof (_b = url.query.method) !== "undefined" && _b !== null)) {
        response.writeHead(500, {
          "Content-Type": "text/plain"
        });
        response.write("Must supply method param");
        response.end();
        return null;
      }
      table = url.query.table;
      // Parse the url to see what the user wants to do
      request.setBodyEncoding('utf8');
      request.addListener("data", function(data) {
        return body += data;
      });
      return request.addListener("end", function() {
        var _c, _d, args, body_obj, parse_body, predicate, records_to_save, remote_head;
        body_obj = {};
        parse_body = function() {
          try {
            return JSON.parse(body);
          } catch (error) {
            self.write_res(response, new Error("Unable to parse HTTP body as JSON.  Make sure it is valid JSON.  Error: " + error.message));
          }
        };
        try {
          if ((_c = url.query.method) === "fetch") {
            remote_head = url.query.remote_head;
            sys.debug("remote_head: " + typeof remote_head);
            if (!(typeof table !== "undefined" && table !== null)) {
              return self.fetch_commits(remote_head, function(err, result) {
                return self.write_res(response, err, result);
              });
            }
          } else if (_c === "save") {
            body_obj = parse_body();
            return self.save(table, body_obj, false, function(err, result) {
              return self.write_res(response, err, result);
            });
          } else if (_c === "find") {
            predicate = JSON.parse(body);
            if ((typeof (_d = predicate.records) !== "undefined" && _d !== null)) {
              // The client is sending some records to save along with asking for new records
              // This is for convenience for clients that want to do a simple sync in one http call
              records_to_save = predicate.records;
              predicate = predicate.predicate;
              return self.save(table, records_to_save, function(err, result) {
                if ((typeof err !== "undefined" && err !== null)) {
                  return self.write_res(response, err);
                }
                return self.find(table, predicate, function(err, result) {
                  return self.write_res(response, err, result);
                });
              });
            } else {
              return self.find(table, predicate, function(err, result) {
                return self.write_res(response, err, result);
              });
            }
          } else if (_c === "find_or_save") {
            args = JSON.parse(body);
            return self.find_or_save(table, args[0], args[1], function(err, result) {
              return self.write_res(response, err, result);
            });
          } else {
            response.writeHead(500, {
              "Content-Type": "text/plain"
            });
            response.write(("Unrecognized method: " + (url.query.method)));
            return response.end();
          }
        } catch (err) {
          return self.write_res(response, err, null);
        }
      });
    });
    server.listen(port, host);
    return server;
  };
  write_res = function(response, err, result) {
    if ((typeof err !== "undefined" && err !== null)) {
      response.writeHead(500, {
        "Content-Type": "text/plain"
      });
      response.write(err.message);
    } else {
      response.writeHead(200, {
        "Content-Type": "text/plain"
      });
      response.write(JSON.stringify(result));
    }
    return response.end();
  };
  exports.listen = listen;
})();
