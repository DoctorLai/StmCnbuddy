/**
 * The job to load option
 * @author:  MarcoXZh3
 * @version: 1.0.0
 */
var encryption = require('../libencryption');
var fs = require('fs');
var path = require('path');
var steem = require('steem');
var winston = require('winston');
require('winston-mongodb');


var moduleName = 'loadOptions';

/**
 * initialize/refresh and return the options
 * @param {string}      password    password for decryption
 * @param {json|string} param       root path for initialization; options for refresh
 * @param {function}    callback    the callback function
 *      @param {array}      options     the new options
 */
module.exports = function(password, param, callback) {

    // Save necessary old options
    var isJson = param.constructor === {}.constructor;
    var rootPath = isJson ? param.rootPath : param;
    var voting = isJson ? param.voting : false;
    var replying = isJson ? param.replying : false;
    var loggers = isJson ? param.loggers : [
        new (winston.Logger)({ transports: [        // logger without db
                new (winston.transports.Console)(),
                new (winston.transports.File)({ filename: 'cnbuddy.log' })
        ] }), // new (winston.Logger)({ transports: [ ... ] })
        new (winston.Logger)({ transports: [        // logger with db
                new (winston.transports.Console)(),
                new (winston.transports.File)({ filename: 'cnbuddy.log' })/*,
                new (winston.transports.MongoDB)({ ... })*/
        ] }) // new (winston.Logger)({ transports: [ ... ] })
    ]; // var loggers = isJson ? param.loggers : [ ... ];

    // Load options now
    fs.readFile(path.join(rootPath, 'options.json'), 'utf8', function(err, data) {
        if (err) {
            loggers[1].log('error', '<' + moduleName + '.fs.readFile> ' +
                                    err.message);
            if (callback) {
                callback(err.message);
            } // if (callback)
            return err.message;
        } // if (err)
        options = JSON.parse(data.toString());

        // Load keys
        var keys = JSON.parse(encryption.importFileSync(path.join(rootPath, 'keys'), password));
        options.posting_key = keys.posting;
        if (options.database) {
            options.database = 'mongodb://' + options.database.user + ':' + keys.dbkey
                                            + '@localhost:27017/' + options.database.name;
        } // if (options.database)

        // put back the old attributes;
        options.rootPath = rootPath;
        options.voting = voting;
        options.replying = replying;
        if (!isJson) {
            loggers[1].add(winston.transports.MongoDB, {
                db :        options.database,
                collection: 'winston_logs'
            }); // loggers[1].add(winston.transports.MongoDB, { ... });
        } // if (!isJson)
        options.loggers = loggers;

        // Load reply messages
        fs.readFile(path.join(rootPath, 'messages.json'), 'utf8', function(err, data) {
            if (err) {
                loggers[1].log('error', '<' + moduleName + '.fs.readFile> ' +
                                        err.message);
                if (callback) {
                    callback(err.message);
                } // if (callback)
                return err.message;
            } // if (err)
            options.messages = JSON.parse(data.toString());

            // Calculate my own vests
            options.vests = 0.0;
            steem.api.getAccounts([options.me], function(err, res) {
                if (err) {
                    loggers[1].log('error', '<' + moduleName + '.fs.readFile> ' +
                                            err.message);
                } // if (err)
                options.vests += parseFloat(res[0].vesting_shares.split(' ')[0]);
                options.vests += parseFloat(res[0].received_vesting_shares.split(' ')[0]);

                // Find total vests and steems for convertion between vest and sp
                steem.api.getDynamicGlobalProperties(function(err, re) {
                    options.total_vesting_shares = Number(re.total_vesting_shares.split(' ')[0]);
                    options.total_vesting_fund_steem = Number(re.total_vesting_fund_steem.split(' ')[0]);

                    // Loading is done, return
                    if (callback) {
                        callback(options);
                    } // if (callback)
                    return options;

                }); // steem.api.getDynamicGlobalProperties(function(err, re) { ... });
            }); // steem.api.getAccounts([options.me], function(err, res) { ... });

        }); // fs.readFile( ... );
    }); // fs.readFile( ... );
}; // module.exports = function(password, param, callback) { ... };
