/**
 * The job to find blogs
 * @author:  MarcoXZh3
 * @version: 1.0.0
 */
var MongoClient = require('mongodb').MongoClient;
var steem = require('steem');


var moduleName = 'findBlogs';

/**
 * find and save new blogs, to both database and memory ("blogs")
 * @param {json}        options     the options for the job
 * @param {function}    callback    the callback function
 *      @param {array}      newBlogs       the new blogs
 */
module.exports = function(options, callback) {
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

            var cners = res;
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

                // Find blogs for each of the cners
                FindAuthorBlogs(options, db, cners, 0, res, [], function(newBlogs) {
                    if (callback) {
                        callback(newBlogs);
                    } // if (callback)
                    return newBlogs;
                });// FindAuthorBlogs(options, db, cners, 0, res, [], function(newBlogs) { ... });

            }); // db.collection('blogs').find({ created:{ $gte:today } }).toArray();
        }); // db.collection('cners').find({}).toArray( ... );
    }); // MongoClient.connect(options.database, function(err, db) { ... });
}; // module.exports = function(options, callback)

/**
 * Find blogs for each of the cners as authors
 * @param {json}        options     the options for the job
 * @param {object}      db          the database handle
 * @param {array}       cners       the list of all cners
 * @param {integer}     idx         the index of the current cner
 * @param {array}       todayBlogs  the list of today's blogs (to be upvoted only)
 * @param {array}       newBlogs    the list of newly detected blogs
 * @param {function}    callback    the callback function
 *      @param {array}      newBlogs       the new blogs, same as above
 */
var FindAuthorBlogs = function(options, db, cners, idx, todayBlogs, newBlogs, callback) {
    var author = cners[idx].name;
    steem.api.getBlog(author, options.huge_number, 500, function(err, res) {
        if (err) {
            options.loggers[1].log('error',
                                   '<' + moduleName + '.steem.api.getBlog> ' +
                                   err.message);
            if (idx === cners.length - 1) {
                if (callback) {
                    callback(err);
                } // if (callback)
                return err;
            } else {
                FindAuthorBlogs(options, db, cners, idx+1, todayBlogs, newBlogs, callback);
            } // if (idx === cners.length - 1)
        } // if (err)

        var today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        var authorTodayBlogs = res.map(function(e) {
            var blog = e.comment;
            if (!blog.created.endsWith('Z')) {
                blog.created = new Date(blog.created + '.000Z');
            } // if (!blog.created.endsWith('Z'))
            if (blog.created.getTime() < today.getTime()) {
                return null;                    // do not consider previous posts
            } // if (blog.created < today)
            if (blog.author !== author) {       // do not consider reblogged posts
                return null;
            } // if (blog.author !== author)
            var rawTags = JSON.parse(blog.json_metadata).tags;
            if (rawTags.filter( (e)=>e.toLowerCase()==='cn' ).length === 0) {
                return null;                    // do not consider non-cn posts
            } // if ( ... )
            var upvoteat = new Date(blog.created.getTime() + 1000 * options.time_upvote);
            var now = new Date();
            if (upvoteat.getTime() < now.getTime() + options.delay) {
                upvoteat = new Date(now.getTime() + 2 * options.delay);
            } // if (upvoteat.getTime() < now.getTime() + options.delay)
            return {
                upvote:     'NOT',
                reply:      'NOT',
                created:    blog.created,
                upvoteat:   upvoteat,
                author:     blog.author,
                vests:      cners[idx].vests,
                membertime: cners[idx].membertime,
                permlink:   blog.permlink,
                title:      blog.title
            }; // return { ... };
        }).filter( (e)=>e )                                         // today's blogs
          .sort( (a,b)=>a.created.getTime()-b.created.getTime() )   // sort asendently
          .splice(0, options.blogs_per_day);                        // first several blogs

        // New blogs: today's blogs that are not NOT IN blogs (thus not voted)
        var newAuthorBlogs = authorTodayBlogs.filter(function(e) {
            return 0 > todayBlogs.findIndex( (b)=>b.author===e.author&&
                                                  b.permlink===e.permlink );
        }); // var newAuthorBlogs = authorTodayBlogs.filter(function(e) { ... });
        newBlogs = newBlogs.concat(newAuthorBlogs);

        // Log and save new blogs
        if (newAuthorBlogs.length === 0) {
            options.loggers[1].log('info',
                                   '<' + moduleName + '> No new blogs found (' +
                                   (idx+1) + '/' + cners.length + '): ' +
                                   cners[idx].name);
        } else {
            options.loggers[1].log('info',
                                   '<' + moduleName + '> New blogs found (' +
                                   (idx+1) + '/' + cners.length + '): ' +
                                   cners[idx].name + ' - ' + newAuthorBlogs.length);
            db.collection('blogs').insertMany(newAuthorBlogs, function(err, res) {
                if (err) {
                    options.loggers[1].log('error',
                                           '<' + moduleName + '.db.blogs.insertMany> ' +
                                           err.message);
                } // if (err)
            }); // db.collection('blogs').insertMany( ... );
        } // else - if (newAuthorBlogs.length === 0)

        // Old blogs: today's blogs that are IN blogs but not voted
        var oldAuthorBlogs = authorTodayBlogs.forEach(function(e) {
            var blog = todayBlogs.filter( (b)=>!b.upvoted&&b.author===e.author
                                                         &&b.permlink===e.permlink )[0];
            if (!blog) {
                return ;
            } // if (!blog)
            var now = new Date();
            if (blog.upvoteat.getTime() < now.getTime() + options.delay) {
                blog.upvoteat = new Date(now.getTime() + 2 * options.delay);
                db.collection('blogs').update({ author:blog.author, permlink:blog.permlink },
                                              { $set:{ upvoteat:blog.upvoteat } },
                                              function(err, res) {
                    if (err) {
                        options.loggers[1].log('error',
                                               '<' + moduleName + '.db.blogs.update> ' +
                                               err.message);
                    } // if (err)
                }); // db.collection('blogs').update( ... );
            } // if (blog.upvoteat.getTime() < now.getTime() + options.delay)
        }); // var oldAuthorBlogs = authorTodayBlogs.forEach(function(e) { ... });

        // next loop, if any
        if (idx === cners.length - 1) {
            if (callback) {
                callback(newBlogs);
            } // if (callback)
            return newBlogs;
        } else {
            FindAuthorBlogs(options, db, cners, idx+1, todayBlogs, newBlogs, callback);
        } // else - if (idx === cners.length - 1)

    }); // steem.api.getBlog(author, options.huge_number, 500, function(err, res) {
}; // var FindAuthorBlogs = function(options, db, cners, idx, todayBlogs, newBlogs, callback) { ... };
