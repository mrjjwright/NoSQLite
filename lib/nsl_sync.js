(function(){
  var execute_save_statements, hash_object, http, insert_nsl_obj, insert_plink, nsl_obj_statement, plink_statement, prepare_save_statements, sqlite, sys, unclustered_statement, unsent_statement;
  var __hasProp = Object.prototype.hasOwnProperty;
  // Syncing functions
  sys = require("sys");
  sqlite = require("sqlite");
  http = require("http");
  nsl_obj_statement = {};
  plink_statement = {};
  unclustered_statement = {};
  unsent_statement = {};
  // Hooks
  // Prepares all the statements
  // Creates a SHA-1 hash of the object's contents
  // in the piped export format of SQLite.
  hash_object = function(object) {
    var _a, i, key, keys_length, value, values;
    values = "";
    i = 0;
    keys_length = Object.keys(object).length - 1;
    _a = object;
    for (key in _a) { if (__hasProp.call(_a, key)) {
      value = _a[key];
      values += value;
      if (i++ < keys_length) {
        values += "|";
      }
    }}
    return hashlib.sha1(values);
  };
  // Called at the beginning of a save transaction
  prepare_save_statements = function(db, callback) {
    var self;
    self = this;
    self.db.prepare_statement("insert into nsl_obj(oid, uuid, table) values(:oid, :uuid, :table)", function(err, statement) {
      nsl_obj_statement = statement;
      return nsl_obj_statement;
    });
    return self.db.prepare_statement("insert into plink(pid, cid, is_primary) values(:pid, :cid, :is_primary)", function(err, statement) {
      plink_statement = statement;
      return self.db.prepare_statement("insert into unclustered(oid) values(:oid)", function(err, statement) {
        unclustered_statement = statement;
        return self.db.prepare_statement("insert into unsent(oid) values(:oid)", function(err, statement) {
          unsent_statement = statement;
          return callback();
        });
      });
    });
  };
  execute_save_statements = function(db, table, obj, callback) {
    return self.db.execute();
  };
  //pre_insert hooks
  exports.module_init = function() {
    self.add_presave_hook(prepare_save_statements);
    return self.add_post_insert_hook(execute_sync_statements);
  };
  // inserts an nsl_obj
  // the statement should of been prepared so that it can be re-used
  insert_nsl_obj = function(nsl_obj_statement, table, obj, callback) {
    var nsl_obj, uuid;
    // Todo check the uuid policy
    uuid = hash_obj(obj);
    nsl_obj = {
      oid: obj.rowid,
      table: table,
      uuid: uuid
    };
    return execute_statement(nsl_obj_statement, nsl_obj, callback);
  };
  insert_plink = function(plink_statement, obj, callback) {  };
  //
  // Updates the remote table with a new remote to connect to
  exports.add_remote = function(remote_name, port, host, callback) {
    var remote, self;
    self = this;
    remote = {
      name: remote_name,
      port: port,
      host: host
    };
    return self.insert_object("nsl_remote", remote, false, function(err, res) {
      if ((typeof err !== "undefined" && err !== null)) {
        return callback(err);
      }
      return callback(null, remote);
    });
  };
  // Connects to another NoSQLite instance identified by remote over HTTP
  // and fetches all commits from that DB since the last pull.
  // Follows the merge strategy setup in options.
  exports.pull = function(remote_name, callback) {
    var _a, _b, body, client, err, remote, request, res, response, self, url;
    self = this;
    // pull the remote
    _a = defer(self.find("nsl_remote", {
      name: remote_name
    }));
    err = _a[0];
    res = _a[1];
    if ((typeof res !== "undefined" && res !== null)) {
      remote = res[0];
    }
    url = "/?method=fetch";
    (typeof remote !== "undefined" && remote !== null) && (typeof (_b = remote.head) !== "undefined" && _b !== null) ? url += ("&remote_head=" + (remote.head)) : null;
    //create an http client to the url of the remote
    client = http.createClient(remote.port, remote.host);
    request = client.request('GET', url, {});
    body = "";
    request.end();
    response = defer(request.addListener('response'));
    response.setEncoding('utf8');
    response.addListener("data", function(data) {
      return body += data;
    });
    return response.addListener("end", function() {
      var commits, last_commit, process_commits, save_remote;
      try {
        commits = JSON.parse(body);
      } catch (err) {
        throw new Error("Unable to pull messages. Remote NoSQLite instance returned: " + body);
      }
      sys.puts(("Fetched " + (commits.length) + " commits from " + (remote.host) + ":" + (remote.port)));
      // TODO: verification step here
      last_commit = {};
      process_commits = function() {
        var _c, _d, commit;
        commit = commits.shift();
        if (!(typeof commit !== "undefined" && commit !== null)) {
          return save_remote();
        }
        last_commit = commit;
        // first save the objects that make up the commit
        _c = defer(self.save(commit.table_name, commit.objects, true));
        err = _c[0];
        res = _c[1];
        if ((typeof err !== "undefined" && err !== null)) {
          return callback(err);
        }
        delete commit.objects;
        _d = defer(self.insert_object("nsl_commit", commit));
        err = _d[0];
        res = _d[1];
        if ((typeof err !== "undefined" && err !== null)) {
          return callback(err);
        }
        return process_commits();
      };
      save_remote = function() {
        var _c;
        remote.head = last_commit.hash;
        _c = defer(self.insert_object("nsl_remote", remote, true));
        err = _c[0];
        res = _c[1];
        if ((typeof err !== "undefined" && err !== null)) {
          return callback(err);
        }
        return self.db.execute("commit", function() {
          sys.puts("Pull complete");
          return callback(null, "success");
        });
      };
      if (commits.length > 0) {
        defer(self.db.execute("begin exclusive transaction;"));
        return process_commits();
      } else {
        return sys.puts("Pull complete");
      }
    });
  };
})();
