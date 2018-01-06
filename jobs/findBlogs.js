/**
 * The job to find blogs
 * @author:  MarcoXZh3
 * @version: 1.1.0
 */
var MongoClient = require('mongodb').MongoClient;
var sql = require("mssql");


var moduleName = 'findBlogs';

/**
 * find and save new blogs, to both database and memory ("blogs")
 * @param {json}        options     the options for the job
 * @param {function}    callback    the callback function
 *      @param {array}      newBlogs       the new blogs
 */
module.exports = function(options, callback) {
    var today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    var query = (`SELECT * FROM Comments ` +                // the target table
                 `WHERE depth = 0 ` +                       // only blogs
                 `AND json_metadata LIKE '%"cn"%' ` +       // with "CN" tag
                 `AND created >= 'TODAY'`)                  // posted today
                .replace('TODAY', today.toISOString());

    sql.connect(options.sqlserver, function(err) {
        if (err) {
            options.loggers[1].log('error',
                                   '<' + moduleName + '.sql.connect> ' +
                                   err.message);
            if (callback) {
                callback(err);
            } // if (callback)
            return err;
        } // if (err)
        new sql.Request().query(query, function(err, res) {
            if (err) {
                options.loggers[1].log('error',
                                       '<' + moduleName + '.sql.Request.query> ' +
                                       err.message);
                if (callback) {
                    callback(err);
                } // if (callback)
                return err;
            } // if (err)

            // Deal with these blog records
            sql.close();
            return FilterCnerBlogs(options, res.recordset, callback);
        }); // new sql.Request().query(sql1, function(err, res) { ... });
    }); // sql.connect(options.sqlserver, function(err) { ... });
}; // module.exports = function(options, callback)


/**
 * Filter blogs only from the cners, taking blogs_per_day into consideration
 * @param {json}        options     the options for the job
 * @param {array}       allBlogs    the list of all today's blogs
 * @param {function}    callback    the callback function
 *      @param {array}      newBlogs       the new blogs, same as above
 */
var FilterCnerBlogs = function(options, allBlogs, callback) {
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

            // Filter out the blogs
            var blogMap = {};
            allBlogs.forEach(function(b) {
                var idx = res.findIndex( (e)=>e.name===b.author );
                if (idx < 0) {
                    return ;
                } // if (idx < 0)
                var upvoteat = new Date(b.created.getTime() + 1000 * options.time_upvote);
                var now = new Date();
                if (upvoteat.getTime() < now.getTime() + options.delay) {
                    upvoteat = new Date(now.getTime() + 2 * options.delay);
                } // if (upvoteat.getTime() < now.getTime() + options.delay)
                var blog = {
                    scheduled:  false,
                    upvoted:    false,
                    replied:    false,
                    created:    b.created,
                    upvoteat:   upvoteat,
                    author:     b.author,
                    vests:      res[idx].vests,
                    membertime: res[idx].membertime,
                    permlink:   b.permlink,
                    title:      b.title
                }; // var blog = { ... };
                if (b.author in blogMap) {
                    if (blogMap[b.author].length < options.blogs_per_day) {
                        blogMap[b.author].push(blog);
                    } // if (blogMap[b.author].length < options.blogs_per_day)
                } else {
                    blogMap[b.author] = [blog];
                } // else - if (b.author in blogMap)
            }); // allBlogs.forEach(function(b) {});
            var targetBlogs = [];
            Object.keys(blogMap).forEach(function(k) {
                targetBlogs = targetBlogs.concat(blogMap[k]);
            }); // Object.keys(blogMap).forEach(function(k) { ... });

            // Go next
            return GoupBlogs(options, db, targetBlogs, callback);
        }); // db.collection('cners').find({}).toArray( ... );
    }); // MongoClient.connect(options.database, function(err, db) { ... });
}; // var FilterCnerBlogs = function(options, allBlogs, callback) { ... };


/**
 * Group blogs into new and old
 * @param {json}        options     the options for the job
 * @param {object}      db          the database handle
 * @param {array}       targetBlogs the list of all target blogs
 * @param {function}    callback    the callback function
 *      @param {array}      newBlogs       the new blogs, same as above
 */
var GoupBlogs = function(options, db, targetBlogs, callback) {
    var today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    db.collection('blogs').find({ created:{ $gte:today } }).toArray(function(err, res) {
        if (err) {
            options.loggers[1].log('error',
                                   '<' + moduleName + '.db.blogs.find> ' +
                                   err.message);
            if (callback) {
                callback(err);
            } // if (callback)
            return err;
        } // if (err)

        // Group here
        var newBlogs = [];
        var oldBlogs = [];
        targetBlogs.sort( (a,b)=>a.created.getTime()-b.created.getTime())
                   .forEach(function(b) {
            var idx = res.findIndex( (e)=>e.author===b.author&&
                                          e.permlink===b.permlink );
            if (idx < 0) {      // New blogs are not in records
                newBlogs.push(b);
            } else {            // Old blogs are in, but not voted
                if (!res[idx].upvoted) {
                    oldBlogs.push(b);
                } // if (!res[idx].upvoted)
            } // if (idx < 0)
        }); // targetBlogs.sort( ... ).forEach( ... );

        // Go next
        return saveBlogsTodb(options, db, newBlogs, oldBlogs, callback);
    }); // db.collection('blogs').find({ created:{ $gte:today } }).toArray();
}; // var GoupBlogs = function(options, db, targetBlogs, callback) { ... };


/**
 * Save the blog into database
 * @param {json}        options     the options for the job
 * @param {object}      db          the database handle
 * @param {array}       newBlogs    the list of new blogs
 * @param {array}       oldBlogs    the list of old blogs
 * @param {function}    callback    the callback function
 *      @param {array}      newBlogs       the new blogs, same as above
 */
var saveBlogsTodb = function(options, db, newBlogs, oldBlogs, callback) {
    // Nnew blogs -- insert
    if (newBlogs.length === 0) {
        options.loggers[1].log('info',
                                '<' + moduleName + '> No new blogs found');
    } else {
        options.loggers[1].log('info',
                                '<' + moduleName + '> New blogs found: '
                                    + newBlogs.length);
        db.collection('blogs').insertMany(newBlogs, function(err, res) {
            if (err) {
                options.loggers[1].log('error',
                                        '<' + moduleName + '.db.blogs.insertMany> ' +
                                        err.message);
            } // if (err)
        }); // db.collection('blogs').insertMany( ... );
    } // else - if (newBlogs.length === 0)

    // Old blogs -- update upvoteat if necessary
    oldBlogs.forEach(function(b) {
        var now = new Date();
        if (b.upvoteat.getTime() < now.getTime() + options.delay) {
            b.upvoteat = new Date(now.getTime() + 2 * options.delay);
            db.collection('blogs').update({ author:b.author, permlink:b.permlink },
                                          { $set:{ upvoteat:b.upvoteat } },
                                          function(err, res) {
                if (err) {
                    options.loggers[1].log('error',
                                           '<' + moduleName + '.db.blogs.update> ' +
                                           err.message);
                } // if (err)
            }); // db.collection('blogs').update( ... );
        } // if (b.upvoteat.getTime() < now.getTime() + options.delay)
    }); // oldBlogs.forEach(function(b) { ... });

    // All done
    if (callback) {
        callback(newBlogs);
    } // if (callback)
    return newBlogs;
}; // var saveBlogsTodb = function(options, db, newBlogs, oldBlogs, callback)
