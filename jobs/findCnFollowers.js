/**
 * The job to find followers
 * @author:  MarcoXZh3
 * @version: 1.0.0
 */
var MongoClient = require('mongodb').MongoClient;
var steem = require('steem');


var moduleName = 'findCnFollowers';

/**
 * find and save new followers from all cners
 * @param {json}        options     the options for the job
 * @param {function}    callback    the callback function
 *      @param {array}      newNames    array of names of the new follower names
 */
module.exports = function(options, callback) {
    // Find new followers
    steem.api.getFollowers(options.me, null, null, 1000, function(err, res) {
        if (err) {
            options.loggers[1].log('error',
                                   '<' + moduleName + '.steem.api.getFollowers> ' +
                                   err.message);
            if (callback) {
                callback(err);
            } // if (callback)
            return err;
        } // if (err)

        return SaveToDb(options,  res.map( (e)=>e.follower ), callback);
    }); // steem.api.getFollowers( ... );
}; // module.exports = function(options, callback)

/**
 * Save the results
 * @param {json}        options     the options for the job
 * @param {array}       allNames    the list of all the follower names
 * @param {function}    callback    the callback function
 *      @param {array}      newNames    array of names of the new follower names
 */
var SaveToDb = function(options, allNames, callback) {
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
        db.collection('cners').find({ follower:false })
                              .toArray(function(err, res) {
            if (err) {
                options.loggers[1].log('error',
                                       '<' + moduleName + '.db.cners.find> ' +
                                       err.message);
                if (callback) {
                    callback(err);
                } // if (callback)
                return err;
            } // if (err)

            var nonNames = res.map( (e)=>e.name );
            return SaveFollowers(options, db,
                                 allNames.filter( (e)=>nonNames.includes(e) ),
                                 callback);
       }); // db.collection('cners').find({ follower:false }).toArray( ... );
    }); // MongoClient.connect(options.database, function(err, db) { ... });

}; // var SaveToDb = function(options, allNames, callback) { ... };

/**
 * Save Followers to database
 * @param {json}        options     the options for the job
 * @param {object}      db          the database handle
 * @param {array}       newNames    the list of new follower names
 * @param {function}    callback    the callback function
 *      @param {array}      newNames    array of names of the new follower names
 */
var SaveFollowers = function(options, db, newNames, callback) {
    if (newNames.length === 0) {
        db.close();
        options.loggers[1].log('info',
                               '<' + moduleName + '> No new followers found');
        if (callback) {
            callback(newNames);
        } // if (callback)
        return newNames;
    } // if (newNames.length === 0)

    // Update the followingships
    db.collection('cners').updateMany({ name:{ $in:newNames } },
                { $set:{ follower:true } }, function(err, res) {
        if (err) {
            options.loggers[1].log('error',
                                   '<' + moduleName + '.db.cners.update> ' +
                                   err.message);
            if (callback) {
                callback(err);
            } // if (callback)
            return err;
        } // if (err)
        db.close();
        if (callback) {
            callback(newNames);
        } // if (callback)
        return newNames;
    }); // db.collection('cners').updateMany( ... );

    // Log - all of the above followers
    newNames.forEach(function(e, idx, arr) {
        options.loggers[1].log('info',
                               '<' + moduleName + '> New follower found (' +
                               (idx+1) + '/' + arr.length + '): ' + e);
    }); // newNames.forEach(function(e, idx, arr) { ... });

}; // var SaveFollowers = function(options, db, newNames, callback) { ... };
