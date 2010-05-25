(function(){
  var hash_object, http, nosqlite, pull, save_sync_hook, sys;
  var __hasProp = Object.prototype.hasOwnProperty;
  // Syncing functions
  if (!(typeof window !== "undefined" && window !== null)) {
    sys = require("sys");
    http = require("http");
    nosqlite = require("./nosqlite").nosqlite;
  }
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
  save_sync_hook = function(rowid, obj_desc) {
    var nsl_obj;
    nsl_obj = {
      oid: rowid,
      tbl_name: obj_desc.table
    };
    return [
      {
        table: "nsl_obj",
        obj: nsl_obj
      }, {
        table: "unclustered",
        obj: {
          oid: rowid
        }
      }, {
        table: "unsent",
        obj: {
          oid: rowid
        }
      }
    ];
  };
  // Connects to another NoSQLite instance identified by remote over HTTP
  // and fetches all commits from that DB since the last pull.
  // Follows the merge strategy setup in options.
  pull = function(remote_name, callback) {
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
  nosqlite.on_save(save_sync_hook);
})();
