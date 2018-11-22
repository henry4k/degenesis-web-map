#!/usr/bin/env node
var cluster = require('cluster');
if(cluster.isMaster){
    return cluster.fork() && cluster.on('exit', function(){ cluster.fork() });
}

var fs = require('fs');
var http = require('http');
var Gun = require('gun');

var config = { port: 8080 };
var server = http.createServer(Gun.serve(__dirname));
var gun = Gun({web: server.listen(config.port) });
console.log('Relay peer started on port ' + config.port + ' with /gun');
