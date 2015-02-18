/**
 * Module Dependencies
 */
var Waterline = require('waterline');
var _ = require('lodash');
var async = require('async');
var Adapter = require('../../../');

var config = require('../../test-connection.json');
config.database = 'waterline-test-orientdb';
config.options = config.options || {};
config.options.storage = "memory";

var instancesMap = {};

/////////////////////////////////////////////////////
// TEST SETUP
////////////////////////////////////////////////////

global.CREATE_TEST_WATERLINE = function(context, dbName, fixtures, cb){
  cb = cb || _.noop;
  
  var waterline, ontology;
  
  var localConfig = _.cloneDeep(config);
  localConfig.database = dbName;
  
  // context variable
  context.collections = {};
  
  waterline = new Waterline();
  
  Object.keys(fixtures).forEach(function(key) {
    fixtures[key].connection = dbName;
    waterline.loadCollection(Waterline.Collection.extend(fixtures[key]));
  });
  
  var Connections = {
    'test': localConfig
  };
  Connections.test.adapter = 'wl_tests';
  
  var connections = {};
  connections[dbName] = _.clone(Connections.test);
  
  waterline.initialize({ adapters: { wl_tests: Adapter }, connections: connections }, function(err, _ontology) {
    if(err) return cb(err);
  
    ontology = _ontology;
  
    Object.keys(_ontology.collections).forEach(function(key) {
      var globalName = key.charAt(0).toUpperCase() + key.slice(1);
      context.collections[globalName] = _ontology.collections[key];
    });
    
    instancesMap[dbName] = {
      waterline: waterline,
      ontology: ontology,
      config: localConfig
    };
    
    cb();
  });
};


global.DELETE_TEST_WATERLINE = function(dbName, cb){
  cb = cb || _.noop;
  
  if(!instancesMap[dbName]) { return cb(new Error('Waterline instance not found for ' + dbName + '! Did you use the correct db name?')); };
  
  var ontology = instancesMap[dbName].ontology;
  var waterline = instancesMap[dbName].waterline;
  var localConfig = instancesMap[dbName].config;

  function dropCollection(item, next) {
    if(!Adapter.hasOwnProperty('drop')) return next();

    ontology.collections[item].drop(function(err) {
      if(err) return next(err);
      next();
    });
  }

  async.each(Object.keys(ontology.collections), dropCollection, function(err) {
    if(err) return cb(err);
    
    ontology.collections[Object.keys(ontology.collections)[0]].getServer(function(server){
      server.drop({
        name: localConfig.database,
        storage: localConfig.options.storage
      })
      .then(function(){
        waterline.teardown(cb);
      })
      .catch(cb);
    });
  });

};
