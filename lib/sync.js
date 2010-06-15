(function(){
  var NSLCore, NSLSync, flow, hex_sha1, http_client, sys;
  var __extends = function(child, parent) {
    var ctor = function(){ };
    ctor.prototype = parent.prototype;
    child.__superClass__ = parent.prototype;
    child.prototype = new ctor();
    child.prototype.constructor = child;
  };
  // Syncing module
  if (!(typeof window !== "undefined" && window !== null)) {
    sys = require("sys");
    NSLCore = require("./index").NSLCore;
    hex_sha1 = require("./sha1").hex_sha1;
    flow = require("flow");
    http_client = require("request");
  } else {
    NSLCore = window.NSLCore;
    hex_sha1 = window.hex_sha1;
  }
  NSLSync = function() {
    return NSLCore.apply(this, arguments);
  };
  __extends(NSLSync, NSLCore);
  NSLSync.schema = [
    {
      table: "nsl_phantom",
      rowid_name: "oid",
      objs: [
        {
          oid: 1
        }
      ]
    }, {
      table: "nsl_unsent",
      rowid_name: "oid",
      objs: [
        {
          oid: 1
        }
      ]
    }, {
      table: "nsl_unclustered",
      rowid_name: "oid",
      objs: [
        {
          oid: 1
        }
      ]
    }, {
      table: "nsl_obj",
      rowid_name: "oid",
      objs: [
        {
          oid: 1,
          uuid: "text",
          tbl_name: "text",
          content: "text",
          date_created: new Date().toISOString()
        }
      ]
    }, {
      table: "nsl_cluster",
      rowid_name: "cluster_id",
      objs: [
        {
          objs: [],
          date_created: new Date().toISOString()
        }
      ]
    }
  ];
  NSLSync.prototype.create_schema = function(obj_descs, callback) {
    if (_.isFunction(obj_descs)) {
      callback = obj_descs;
      obj_descs = NSLSync.schema;
    } else {
      obj_descs = [obj_descs, NSLSync.schema];
    }
    return NSLSync.__superClass__.create_schema.call(this, obj_descs, callback);
  };
  // Num of objs that should be in nsl_unclustered before we create a cluster
  NSLSync.CLUSTER_THRESHOLD = 10;
  // Creates a nsl_obj entry for each user obj.
  // Extends the core NoSQLite save_obj function.
  // Stores an attribute called oid in the user table
  // that references the nsl_obj
  // Also stores auxilary objs needed for syncing
  NSLSync.prototype.save_objs = function(the_obj_desc, callback) {
    var _a, _b, _c, _d, _e, _f, _g, new_obj_desc, nsl_obj, nsl_obj_desc, nsl_obj_descs, obj, obj_desc, obj_descs;
    // we accept an array or a single object
    obj_descs = _.isArray(the_obj_desc) ? the_obj_desc : [the_obj_desc];
    // store a nsl_obj for each user obj
    nsl_obj_descs = [];
    _b = obj_descs;
    for (_a = 0, _c = _b.length; _a < _c; _a++) {
      obj_desc = _b[_a];
      if (obj_desc.table === "nsl_obj") {
        // just ignore nsl objects and pass them  to super
        // to be saved
        nsl_obj_descs.push(obj_desc);
        continue;
      }
      nsl_obj_desc = {
        table: "nsl_obj",
        objs: [],
        rowid_name: "oid",
        unique: ["uuid"]
      };
      if (!(typeof (_d = obj_desc.objs) !== "undefined" && _d !== null) || !_.isArray(obj_desc.objs)) {
        throw Error("Each obj_desc should have an objs array on it");
      }
      _f = obj_desc.objs;
      for (_e = 0, _g = _f.length; _e < _g; _e++) {
        obj = _f[_e];
        nsl_obj = {
          uuid: this.hash_obj(obj),
          tbl_name: obj_desc.table,
          content: obj,
          date_created: new Date().toISOString(),
          nsl_children: []
        };
        nsl_obj_desc.objs.push(nsl_obj);
        // this is the original object which becomes a child
        // obj of nsl_obj
        new_obj_desc = {
          table: obj_desc.table,
          objs: [obj],
          fk: "oid"
        };
        nsl_obj.nsl_children.push(new_obj_desc);
        nsl_obj.nsl_children.push({
          table: "nsl_unclustered",
          objs: [
            {
              oid: null
            }
          ],
          fk: "oid"
        });
        nsl_obj.nsl_children.push({
          table: "nsl_unsent",
          objs: [
            {
              oid: null
            }
          ],
          fk: "oid"
        });
      }
      nsl_obj_descs.push(nsl_obj_desc);
    }
    return NSLSync.__superClass__.save_objs.call(this, nsl_obj_descs, callback);
  };
  // Returns nsl_objs in buckets not in another bucket.
  // where buckets are like phantom, unclustered and unsent
  NSLSync.prototype.objs_in_bucket = function(bucket, exclude_bucket, callback) {
    var self, sql;
    if (_.isFunction(exclude_bucket)) {
      callback = exclude_bucket;
      exclude_bucket = null;
    }
    self = this;
    sql = ("SELECT * FROM " + (bucket) + " JOIN nsl_obj USING(oid)");
    (typeof exclude_bucket !== "undefined" && exclude_bucket !== null) ? sql += ("WHERE NOT EXISTS (SELECT 1 FROM " + (exclude_bucket) + " WHERE oid=nsl_obj.oid)") : null;
    return self.find(sql, callback);
  };
  // Returns the complete obj from it's flattened table
  NSLSync.prototype.blowup_objs_in_bucket = function(bucket, exclude_bucket, callback) {
    var objs;
    // first we need a list of oids
    objs = [];
    return self.nsl_objs_in_bucket(bucket, exclude_bucket, function(err, nsl_objs) {
      var oids, tables;
      if ((typeof err !== "undefined" && err !== null)) {
        return callback(err);
      }
      tables = _.pluck(nsl_objs, "tbl_name");
      oids = _.pluck(nsl_objs, "oid").join(",");
      throw new Error("incomplete");
    });
  };
  // Sends all the objs requested in the gimme part
  NSLSync.prototype.send_requested_objs = function(req, res, callback) {
    var _a, _b, _c, _d, uuid, uuids;
    if (req.gimme.length === 0) {
      return callback();
    }
    //TODO: security, private, shunned checks on the uuids?
    uuids = (function() {
      _a = []; _c = req.gimme;
      for (_b = 0, _d = _c.length; _b < _d; _b++) {
        uuid = _c[_b];
        _a.push(JSON.stringify(uuid));
      }
      return _a;
    })();
    uuids = uuids.join(",");
    return this.find(("SELECT * FROM nsl_obj WHERE uuid in (" + (uuids) + ") "), function(err, objs) {
      sys.debug(sys.inspect(err));
      if ((typeof err !== "undefined" && err !== null)) {
        return callback(err);
      }
      res.objs.push(objs);
      res.objs = _.flatten(res.objs);
      return callback();
    });
  };
  // Makes a cluster from the objs in the unclustered table
  // if the number of objs in unclustered exceeds the cluster threshold.
  // A cluster is a regular obj in nsl_obj and stored in nsl_cluster.
  // They are used to represent one or more objects for more efficient syncing.
  // If another db has the cluster obj, it has all the objs in the cluster.
  // The objects that comprise a cluster are kept in nsl_cluster_link
  // which has this schema.
  // cluster_oid -> The oid of the cluster obj in nsl_obj
  // child_oid -> The oid of a child cluster obj in nsl_obj
  NSLSync.prototype.make_cluster = function(callback) {
    var self;
    self = this;
    return self.objs_in_bucket("nsl_unclustered", function(err, unclustered) {
      if ((typeof err !== "undefined" && err !== null)) {
        throw err;
      }
      if ((typeof unclustered === "undefined" || unclustered == undefined ? undefined : unclustered.length) >= NSLSync.CLUSTER_THRESHOLD) {
        // delete all records from unclustered
        // and insert the clustered
        return self.execute("delete from nsl_unclustered", function(err, res) {
          var cluster_desc;
          if ((typeof err !== "undefined" && err !== null)) {
            throw err;
          }
          // store the cluster in nsl_obj
          cluster_desc = {
            table: "nsl_cluster",
            rowid_name: "cluster_id",
            objs: [
              {
                objs: _.pluck(unclustered, "uuid"),
                date_created: new Date().toISOString()
              }
            ]
          };
          return self.save_objs(cluster_desc, function(err, res) {
            if ((typeof err !== "undefined" && err !== null)) {
              throw err;
            }
            if ((typeof callback !== "undefined" && callback !== null)) {
              return callback(null, res);
            }
          });
        });
      } else {
        return callback();
      }
    });
  };
  // Returns the nsl_obj if it exists.
  //
  // If it doesn't exist, and phantomize is true,
  // then creates a blank entry in nsl_obj
  // and adds an entry to phantom
  NSLSync.prototype.uuid_to_obj = function(uuid, phantomize, callback) {
    var self;
    self = this;
    return this.find("nsl_obj", {
      uuid: uuid
    }, function(err, obj) {
      if ((typeof err !== "undefined" && err !== null)) {
        return callback(err);
      }
      if ((typeof obj !== "undefined" && obj !== null)) {
        // delete obj from phantom
        return self.execute(("DELETE FROM nsl_phantom WHERE oid = " + (obj[0].oid)), function(err, results) {
          return callback(null, obj[0]);
        });
      } else if (phantomize) {
        return self.create_phantom(uuid, callback);
      } else {
        return callback();
      }
    });
  };
  // Creates a phantom
  //
  // create a blank entry nsl_obj
  // and then a phantom obj for the blank
  NSLSync.prototype.create_phantom = function(uuid, callback) {
    var obj_desc;
    obj_desc = {
      table: "nsl_obj",
      objs: [
        {
          tbl_name: null,
          uuid: uuid,
          content: null,
          date_created: new Date().toISOString(),
          nsl_children: [
            {
              table: "nsl_phantom",
              fk: "oid",
              objs: [
                {
                  oid: null
                }
              ]
            }
          ]
        }
      ]
    };
    return this.save_objs(obj_desc, callback);
  };
  // Stores any new objects received from another db
  //
  // If the obj uuid already exists in nsl_obj, ignore the constraint error.
  // Otherwise, store the obj in nsl_obj and in it's table.
  // If the never before seen object is a cluster, store each obj
  // in the cluster and store the cluster itself as an obj.
  NSLSync.prototype.store_objs = function(objs, callback) {
    var obj_desc, self;
    self = this;
    obj_desc = {
      table: "nsl_obj",
      rowid_name: "oid",
      objs: _.flatten(objs),
      ignore_constraint_errors: true
    };
    return this.save_objs(obj_desc, function(err, res) {
      if ((typeof err !== "undefined" && err !== null)) {
        return callback(err);
      }
      return flow.serialForEach(objs, function(obj) {
        var this_flow;
        this_flow = this;
        if (obj.tbl_name === "nsl_cluster") {
          return flow.serialForEach(obj.content.objs, function(uuid) {
            return self.uuid_to_obj(uuid, true, this);
          }, function(err, res) {
            if ((typeof err !== "undefined" && err !== null)) {
              throw err;
            }
          }, this_flow);
        } else {
          //TODO: test for parent id
          return this_flow();
        }
      }, null, function() {
        return callback(null, res.rowsAffected);
      });
    });
  };
  // Sends any objs over
  NSLSync.prototype.send_objs_in_bucket = function(arr, bucket, exclude_bucket, callback) {
    return this.objs_in_bucket(bucket, exclude_bucket, function(err, objs) {
      if ((typeof err !== "undefined" && err !== null)) {
        callback(err);
      }
      if ((typeof objs === "undefined" || objs == undefined ? undefined : objs.length) > 0) {
        arr.push(objs);
        arr = _.flatten(arr);
      }
      return callback(null, objs == undefined ? undefined : objs.length);
    });
  };
  // Pulls from a remote node
  NSLSync.prototype.pull = function(url, db, callback) {
    var first_cycle, pull_cycle, req, self;
    sys.puts(("Pulling from " + (url)));
    self = this;
    // construct a pull request
    req = {
      db: db,
      objs: [],
      gimme: []
    };
    // keep track of how many times we have cycled through this
    first_cycle = true;
    pull_cycle = function() {
      return flow.exec(function() {
        return self.objs_in_bucket("nsl_phantom", null, this);
      }, function(err, objs) {
        if ((typeof err !== "undefined" && err !== null)) {
          throw err;
        }
        if (!first_cycle && !(typeof objs !== "undefined" && objs !== null)) {
          sys.puts("Pull complete");
          return callback();
        } else if ((typeof objs === "undefined" || objs == undefined ? undefined : objs.length) > 0) {
          req.gimme.push(_.pluck(objs, "uuid"));
        }
        first_cycle = false;
        // send over the request
        req.objs = _.flatten(req.objs);
        req.gimme = _.flatten(req.gimme);
        return http_client({
          uri: url,
          method: "POST",
          body: JSON.stringify(req)
        }, this);
      }, function(err, http_res, body) {
        var res;
        if ((typeof err !== "undefined" && err !== null)) {
          throw err;
        }
        // the response came back
        // store these objs if needed, this creates phantoms
        // for never before seen objs
        res = JSON.parse(body);
        if ((res.objs == undefined ? undefined : res.objs.length) > 0) {
          sys.puts(("Received " + (res.objs.length) + " objs from remote"));
          return self.store_objs(res.objs, this);
        } else {
          return this();
        }
        // start over
      }, function(err, results) {
        if ((typeof err !== "undefined" && err !== null)) {
          throw err;
        }
        return pull_cycle();
      });
    };
    return pull_cycle();
  };
  // Remote side implementation of the pull protocol
  //
  // callback will be called when this method is done writing
  NSLSync.prototype.pull_response = function(req, res, callback) {
    var self;
    self = this;
    return flow.exec(function() {
      // Take this opportunity to make a cluster if we need to.
      // This choice of a place to make a cluster favors
      // master-slave like configurations, but works for any configurations
      return self.make_cluster(this);
    }, function(err) {
      // send all the objs requested
      return self.send_requested_objs(req, res, this);
    }, function(err) {
      // get all objs in unclustered not in phantom
      return self.send_objs_in_bucket(res.objs, "nsl_unclustered", "nsl_phantom", this);
    }, function(err, num_sent) {
      return callback();
    });
  };
  // Push implmentation
  NSLSync.prototype.push = function(req, callback) {
    return flow.exec(function() {
      // get all obj that have never before been sent
      return send_objs_in_bucket(req.objs, "nsl_unsent", null, this);
    }, function(err, unsent) {
      // send unsent items
      req.write(unsent);
      // get all objects in unclustered not in phantom
      return objs_in_bucket("nsl_unclustered", this);
    }, function(err, unclustered) {
      req.write(unclustered);
      return req.send(this);
    }, function(err, res) {
      return callback();
    });
  };
  NSLSync.prototype.push_response = function(req, res, callback) {
    var self;
    self = this;
    return flow.exec(function() {
      // Take this opportunity to make a cluster if we need to.
      // This choice of a place to make a cluster favors
      // master-slave like configurations, but works for any configurations
      return self.make_cluster(this);
    }, function(err) {
      // send all the objs requested
      return self.send_requested_objs(req, res, this);
    }, function(err) {
      // get all objs in unclustered not in phantom
      return self.send_objs_in_bucket(res.objs, "nsl_unclustered", "nsl_phantom", this);
    }, function(err, num_sent) {
      return callback();
    });
  };
  NSLSync.prototype.hash_obj = function(obj) {
    return hex_sha1(JSON.stringify(obj));
  };

  !(typeof window !== "undefined" && window !== null) ? (exports.NSLSync = NSLSync) : (window.NSLSync = NSLSync);
})();