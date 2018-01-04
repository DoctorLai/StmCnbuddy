/**
 * The job to find cners
 * @author:  MarcoXZh3
 * @version: 1.0.0
 */
var GetMembership = require('../memberships').GetMembership;
var MongoClient = require('mongodb').MongoClient;
var request = require("request");


var moduleName = 'findCners';

/**
 * find and save new cners
 * @param {json}        options     the options for the job
 * @param {function}    callback    the callback function
 *      @param {array}      newCners    array of new cners
 */
module.exports = function(options, callback) {
    // Find new cners
    request( {url:options.cners_url, json:true }, function (err, res, body) {
        if (err) {
            options.loggers[1].log('error',
                                   '<' + moduleName + '.request> ' +
                                   err.message);
            if (callback) {
                callback(err);
            } // if (callback)
            return err;
        } // if (err)
        if (res.statusCode !== 200) {
            options.loggers[1].log('warn',
                                   '<' + moduleName + '.request> status code: ' +
                                   res.statusCode);
            return err;
        } // if (res.statusCode !== 200)

        return SaveCnersToDb(options, body, callback);
    }); // request( ... );
}; // module.exports = function(options, callback)

/**
 * Synchronize cners between web and loacal database
 * @param {json}        options     the options for the job
 * @param {array}       allCners    the list of all cners
 * @param {function}    callback    the callback function
 *      @param {array}      newCners    array of new cners
 */
var SaveCnersToDb = function(options, allCners, callback) {
    MongoClient.connect(options.database, function(err, db) {
        if (err) {
            options.loggers[0].log('error',
                                   '<' + moduleName + '.MongoClient.connect> ' +
                                   err.message);
            if (callback) {
                callback(err);
            } // if (callback)
            return err;
        } // if (err)
        db.collection('cners').find({}).toArray(function(err, res) {
            if (err) {
                options.loggers[1].log('error',
                                       '<' + moduleName + '.db.cners.find> ' +
                                       err.message);
                if (callback) {
                    callback(err);
                } // if (callback)
                return err;
            } // if (err)

            var dbCners = res.map( (e)=>e.name );
            var newCners = allCners.filter( (e)=>!dbCners.includes(e.name) );
            return SaveNewCners(options, db, newCners, callback);

        }); // db.collection('cners').find({}).toArray( ... );
    }); // MongoClient.connect(options.database, function(err, db) { ... });
}; // var SaveCnersToDb = function(options, allCners, callback) { ... };

/**
 * Save newly found cners
 * @param {json}        options     the options for the job
 * @param {object}      db          the database handle
 * @param {array}       newCners    the list of newly found cners
 * @param {function}    callback    the callback function
 *      @param {array}      newCners    array of new cners
 */
var SaveNewCners = function(options, db, newCners, callback) {
    var dbNewCners = newCners.map(function (e) {
        return {
            name:       e.name,
            membership: GetMembership({
                            delegator:  e.name,
                            time:       new Date(-1),
                            vests:      0
                        },
                        options.total_vesting_shares,
                        options.total_vesting_fund_steem),
            membertime: new Date(-1),
            vests:      0,
            follower:   false
        }; // return { ... };
    }); // var dbNewCners = allCners.filter( ... ).map( ... );

    if (dbNewCners.length === 0) {
        db.close();
        options.loggers[1].log('info',
                               '<' + moduleName + '> No new cners found');
        if (callback) {
            callback(dbNewCners);
        } // if (callback)
        return dbNewCners;
    } // if (dbNewCners.length === 0)

    db.collection('cners').insertMany(dbNewCners, null, function(err, r) {
        if (err) {
            options.loggers[1].log('error',
                                   '<' + moduleName + '.db.cners.insertMany> ' +
                                   err.message);
            return err;
        } // if (err)
        db.close();
        if (callback) {
            callback(dbNewCners);
        } // if (callback)
        return dbNewCners;
    }); // db.collection('cners').insertMany( ... );

    // Log - all the new cners
    dbNewCners.forEach(function(cner, idx, arr) {
        options.loggers[1].log('info',
                               '<' + moduleName + '> New cner found (' +
                               (idx+1) + '/' + arr.length + '): ' + cner.name);
    }); // dbNewCners.forEach(function(cner, idx, arr) { ... });

}; // var SaveNewCners = function(options, db, newCners, callback) { ... };
