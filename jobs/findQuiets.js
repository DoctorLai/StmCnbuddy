/**
 * The job to find whether the cners want quiet
 * @author:  MarcoXZh3
 * @version: 1.0.0
 */
var MongoClient = require('mongodb').MongoClient;
var steem = require('steem');


// var x = [
//     { 'name':'aafeng' },
//     { 'name':'abit' },
//     { 'name':'acactus1013' },
//     { 'name':'argenisboom' },
//     { 'name':'bobdos' },
//     { 'name':'chinadaily' },
//     { 'name':'cifer' },
//     { 'name':'fr3eze' },
//     { 'name':'harbour' },
//     { 'name':'jessie901220' },
//     { 'name':'liangfengyouren' },
//     { 'name':'lovemyson' },
//     { 'name':'monkeyplayfire' },
//     { 'name':'oflyhigh' },
//     { 'name':'rea' },
//     { 'name':'rivalhw' },
//     { 'name':'the01crow' },
//     { 'name':'yuxi' },
// ];
// MongoClient.connect(options.database, function(err, db) {
//     db.collection('quiets').insertMany(x, function(err, res) {
//         if (err) {
//             console.error(err);
//         } else {
//             console.log('done');
//         }
//     });
// });

var moduleName = 'findQuiets';

/**
 * find and save new quiet requests
 * @param {json}        options     the options for the job
 * @param {function}    callback    the callback function
 *      @param {array}      newNames    array of names requested quiet
 */
module.exports = function(options, callback) {
    // Find new quiet requests, save { name:cnerNameToBeQuiet } to collection "quiets"
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
        db.collection('quiets').find({}).toArray(function(err, res) {
            if (err) {
                options.loggers[1].log('error',
                                       '<' + moduleName + '.db.cners.find> ' +
                                       err.message);
                if (callback) {
                    callback(err);
                } // if (callback)
                return err;
            } // if (err)
            return FindNewQuiets(options, db, res.map( (e)=>e.name ), callback);
        }); // db.collection('quiets').find({}).toArray(function(err, res) { ... });
    }); // MongoClient.connect(options.database, function(err, db) { .. });
}; // module.exports = function(options, callback)

/**
 * Find new quiet requests
 * @param {json}        options     the options for the job
 * @param {object}      db          the database handle
 * @param {array}       oldQuiets   the list of existing qiuet cners
 * @param {function}    callback    the callback function
 *      @param {array}      newNames    array of names requested quiet
 */
var FindNewQuiets = function(options, db, oldQuiets, callback) {
    var allQuiets = [];
    // TODO: detect all quiets









    var newQuiets = allQuiets.filter( (e)=>!oldQuiets.includes(e) );
    if (newQuiets.length === 0) {
        db.close();
        options.loggers[1].log('info',
                               '<' + moduleName + '> No new quiet requests found');
        if (callback) {
            callback(newQuiets);
        } // if (callback)
        return newQuiets;
    } // if (newQuiets.length === 0)

    SaveNewQuietsToDb(options, db, newQuiets);
}; // var FindNewQuiets = function(options, db, oldQuiets, callback) { ... };

/**
 * Save the new quiet requests to database
 * @param {json}        options     the options for the job
 * @param {object}      db          the database handle
 * @param {array}       newQuiets   the list of new qiuet cners
 * @param {function}    callback    the callback function
 *      @param {array}      newNames    array of names requested quiet
 */
var SaveNewQuietsToDb = function(options, db, newQuiets, callback) {
    db.collection('quiets').insertMany(newQuiets, null, function(err, r) {
        if (err) {
            options.loggers[1].log('error',
                                   '<' + moduleName +
                                   '.db.quiets.insertMany> No new quiet requests found');
            return err;
        } // if (err)
        db.close();
        if (callback) {
            callback();
        } // if (callback)
        return ;
    }); // db.collection('quiets').insertMany( ... );

    // Log - all the new quiet requests
    newQuiets.forEach(function(e, idx, arr) {
        options.loggers[1].log('info',
                               '<' + moduleName + '> New quiet requests found(' +
                               (idx+1) + '/' + arr.length + '): ' + e);
    }); // newQuiets.forEach(function(e, idx, arr) { ... });

}; // var SaveNewQuietsToDb = function(options, db, newQuiets, callback) { ... };
