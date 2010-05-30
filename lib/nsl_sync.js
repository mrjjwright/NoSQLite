(function(){
  var NSLCore, NSLSync, hex_sha1, sys;
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
    NSLCore = require("./nosqlite").NSLCore;
    hex_sha1 = require("../vendor/sha1").hex_sha1;
  } else {
    NSLCore = window.NSLCore;
    hex_sha1 = window.hex_sha1;
  }
  NSLSync = function() {
    return NSLCore.apply(this, arguments);
  };
  __extends(NSLSync, NSLCore);
  // Static variables
  // How many objs should be in nsl_unclustered before we create a cluster
  NSLSync.CLUSTER_THRESHOLD = 1;
  // Extends the core NoSQLite save_obj functions
  // Creates a nsl_obj entry for each user obj
  // Stores an attribue called oid in the user table
  // that references the nsl_obj
  // Also stores auxilary objs needed for syncing
  NSLSync.prototype.save_objs = function(the_obj_desc, callback) {
    var _a, _b, _c, _d, _e, _f, _g, nsl_obj, nsl_obj_desc, nsl_obj_descs, obj, obj_desc, obj_descs;
    // we accept an array or a single object
    obj_descs = _.isArray(the_obj_desc) ? the_obj_desc : [the_obj_desc];
    // store a nsl_obj for each user obj
    nsl_obj_descs = [];
    _b = obj_descs;
    for (_a = 0, _c = _b.length; _a < _c; _a++) {
      obj_desc = _b[_a];
      // set the foreign key on the oid
      obj_desc.fk = "oid";
      nsl_obj_desc = {
        table: "nsl_obj",
        objs: [],
        rowid_name: "oid",
        children: [
          obj_desc, {
            table: "nsl_unclustered",
            objs: [
              {
                oid: null
              }
            ],
            fk: "oid"
          }, {
            table: "nsl_unsent",
            objs: [
              {
                oid: null
              }
            ],
            fk: "oid"
          }
        ]
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
          date_created: new Date().toISOString()
        };
        nsl_obj_desc.objs.push(nsl_obj);
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
    return self.find(sql, function(err, res) {
      if ((typeof err !== "undefined" && err !== null)) {
        return callback(err);
      }
      return callback(null, res);
    });
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
    var uuids;
    if (req.gimme.length === 0) {
      return null;
    }
    //TODO: security, private, shunned checks on the uuids?
    uuids = req.gimme.join(",");
    return nosqlite.execute(("SELECT table, uuid, content FROM nsl_obj WHERE uuid in (" + (uuids) + ") "), function(err, objs) {
      if ((typeof err !== "undefined" && err !== null)) {
        return callback(err);
      }
      req.objs.push(objs);
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
      var cluster_desc;
      if ((typeof err !== "undefined" && err !== null)) {
        throw err;
      }
      if (unclustered.length >= NSLSync.CLUSTER_THRESHOLD) {
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
        return self.save_objs(cluster_desc, function() {
          // delete all records from unclustered
          // and insert the clustered
          return self.execute("delete from nsl_unclustered", function(err, res) {
            if ((typeof err !== "undefined" && err !== null)) {
              throw err;
            }
            return callback(null, res);
          });
        });
      }
    });
  };
  // Returns the obj object if it exists.
  //
  // If it doesn't exist, and phantomize is true,
  // then creates a blank entry in nsl_obj
  // and adds an entry to phantom
  NSLSync.prototype.uuid_to_obj = function(uuid, phantomize, callback) {
    return nosqlite.find("nsl_obj", {
      uuid: uuid
    }, function(err, obj_desc) {
      if ((typeof err !== "undefined" && err !== null)) {
        return callback(err);
      }
      if ((typeof obj_desc !== "undefined" && obj_desc !== null)) {
        return callback(null, obj_desc);
      } else if (phantomize) {
        create_phantom(uuid, callback);
      } else {
        callback();
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
      obj: {
        tbl_name: null,
        uuid: uuid,
        contents: null,
        date_created: new Date().toISOString()
      },
      children: [
        {
          table: "nsl_phantom",
          fk: "oid",
          obj: {
            oid: null
          }
        }
      ]
    };
    return nosqlite.save(obj_desc, callback);
  };
  // Stores any new objects received from another db
  //
  // If the obj uuid already exists in nsl_obj, ignore the obj.
  // Otherwise, store the obj in nsl_obj and in it's table.
  // If the never before seen object is a cluster, store each obj
  // in the cluster and store the cluster itself as an obj.
  NSLSync.prototype.store_objs = function(obj_descs, callback) {
    // if a lot of these already exist
    return this.save_objs(obj_descs, function(err, saved_objs) {
      if ((typeof err !== "undefined" && err !== null)) {
        return callback(err);
      }
      saved_objs.length === 0 ? callback(null, 0) : null;
      return flow.serialForEach(saved_objs, function() {
        if (obj_desc.table === "nsl_cluster") {
          return uuid_to_obj(uuid, true, this);
        } else {
          return this();
        }
      }, null, function() {
        return callback(null, saved_objs.length);
      });
    });
  };
  // Sends any phantoms over
  NSLSync.prototype.send_objs_in_bucket = function(req_or_res, bucket, exclude_bucket, callback) {
    return objs_in_bucket(bucket, function(err, objs) {
      phantoms.length > 0 ? req_or_res.objs.push(objs) : null;
      return callback(null, objs.length);
    });
  };
  // Pulls from a remote node
  NSLSync.prototype.pull = function(url, callback) {
    var first_cycle, pull_cycle, req;
    // construct a pull request
    req = {
      type: "pull",
      objs: [],
      gimme: []
    };
    // keep track of how many times we have cycled through this
    first_cycle = false;
    pull_cycle = function() {
      return flow.exec(function() {
        return send_objs_in_bucket(req, "nsl_phantom", this);
      }, function(err, req) {
        // exit the flow if no more objs needed
        if (!first_cycle && req.gimme.length === 0) {
          return callback(null);
        }
        first_cycle === true ? (first_cycle = false) : null;
        // send over the request
        return http_client.post(url, req, this);
      }, function(err, res) {
        // the response came back
        // store these objs if needed, this creates phantoms
        // for never before seen objs
        store_objs(res.objs, this);
        // start over
        return pull_cycle();
      });
    };
    return pull_cycle();
  };
  // Remote side implementation of the pull protocol
  //
  // callback will be called when this method is done writing
  NSLSync.prototype.pull_response = function(req, res, callback) {
    return flow.exec(function() {
      // Take this opportunity to make a cluster if we need to.
      // This choice of a place to make a cluster favors
      // master-slave like configurations, but works for any configurations
      return make_cluster(this);
    }, function(err) {
      // send all the objs requested
      return send_requested_objs(req, res, this);
    }, function(err) {
      // get all objs in unclustered not in phantom
      return send_objs_in_bucket(req, "unclustered", "phantom", false, this);
    }, function(err, unclustered) {
      // send these to the local db
      res.write(unclustered);
      return callback();
    });
  };
  // Push implmentation
  NSLSync.prototype.push_local = function(req, callback) {
    return flow.exec(function() {
      // get all obj that have never before been sent
      return send_objs_in_bucket(req, "unsent", this);
    }, function(err, unsent) {
      // send unsent items
      req.write(unsent);
      // get all objects in unclustered not in phantom
      return objs_in_bucket("unclustered", this);
    }, function(err, unclustered) {
      req.write(unclustered);
      return req.send(this);
    }, function(err, res) {    });
  };
  NSLSync.prototype.hash_obj = function(obj) {
    return hex_sha1(JSON.stringify(obj));
  };

  !(typeof window !== "undefined" && window !== null) ? (exports.NSLSync = NSLSync) : (window.NSLSync = NSLSync);
})();
