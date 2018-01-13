/**
 * The job to reply blogs
 * @author:  MarcoXZh3
 * @version: 1.1.0
 */
var MongoClient = require('mongodb').MongoClient;
var steem = require('steem');
var wait = require('wait-for-stuff');


var moduleName = 'replyBlogs';

/**
 * Reply all blogs
 * @param {json}        options     the options for the job
 * @param {function}    callback    the callback function
 *      @param {json}       result      the result json
 *          @param {date}       now         the current time
 *          @param {array}      blogs       the blogs to be replied at now
 */
module.exports = function(options, callback) {
    var funcName = 'replyBlogs';
    MongoClient.connect(options.database, function(err, db) {
        if (err) {
            options.loggers[0].log('error',
                                   '<' + moduleName + '.MongoClient.connect> ' +
                                   err.message);
            db.close();
            if (callback) {
                callback(err);
            } // if (callback)
            return err;
        } // if (err)

        var now = new Date();
        now.setUTCSeconds(59, 999);
        db.collection('blogs').find({ upvote:{ $eq:'DONE' }, reply:{ $eq:'NOT' } })
                              .toArray(function(err, res) {
            if (err) {
                options.loggers[1].log('error',
                                       '<' + moduleName + '.db.blogs.find> ' +
                                       err.message);
                db.close();
                if (callback) {
                    callback(err);
                } // if (callback)
                return err;
            } // if (err)

            // Log the blogs to be replied
            options.loggers[1].log('info',
                                    '<' + funcName + '> Blogs replying: '
                                        + res.length);

            if (res.length === 0) {
                now.setUTCSeconds(0, 0);
                if (callback) {
                    callback({ now:now, blogs:res });
                } // if (callback)
                return { now:now, blogs:res };
            } // if (res.length === 0)

            // Mark them as upvoting
            db.collection('blogs').updateMany({ upvote:{ $eq:'DONE' }, reply:{ $eq:'NOT' } },
                                              { $set:{ reply:'ING' } }, function(err, res) {
                if (err) {
                    options.loggers[1].log('error',
                                        '<' + funcName + '.db.blogs.updateMany> ' +
                                        err.message);
                } // if (err)
            }); // db.collection('blogs').updateMany( ... );

            // Reply these blogs, one by one
            PrepareReplyBlog(options, db, res, 0, function() {
                now.setUTCSeconds(0, 0);
                if (callback) {
                    callback({ now:now, blogs:res });
                } // if (callback)
                return { now:now, blogs:res };
            }); // PrepareReplyBlog(options, db, res, 0, function() { ... });

        }); // db.collection('blogs').find( ... ).toArray( ... );
    }); // MongoClient.connect(options.database, function(err, db) { ... });
}; // module.exports = function(options, callback) { ... };

/**
 * Prepare to reply the blogs
 * @param {json}        options     the options for the job
 * @param {object}      db          the database handle
 * @param {array}       blogs       the list of blogs to be replied
 * @param {integer}     idx         the index of the current blog
 * @param {function}    callback    the callback function
 */
var PrepareReplyBlog = function(options, db, blogs, idx, callback) {
    var funcName = 'PrepareReplyBlog';
    var blog = blogs[idx];

    // Check if it's already replied by me
    steem.api.getContentReplies(blog.author, blog.permlink, function (err, results) {
        if (err) {
            options.loggers[1].log('error',
                                   '<' + funcName + '.steem.api.getContentReplies> ' +
                                   err.message);
            if (idx === blogs.length - 1) {
                db.close();
                if (callback) {
                    callback(err);
                } // if (callback)
                return err;
            } else {
                PrepareReplyBlog(options, db, blogs, idx+1, callback);
            } // if (idx === blogs.length - 1)
        } // if (err)
        if (results.map( (b)=>b.author ).includes(options.me)) {     // Blog already replied
            db.collection('blogs').updateMany({ author:blog.author, permlink:blog.permlink },
                                             { $set:{ reply:'DONE' } },
                                             function(err, res) {
                if (err) {
                    options.loggers[1].log('error',
                                           '<' + funcName + '.db.blogs.updateMany> ' +
                                           err.message);
                    if (idx === blogs.length - 1) {
                        db.close();
                        if (callback) {
                            callback(err);
                        } // if (callback)
                        return err;
                    } else {
                        PrepareReplyBlog(options, db, blogs, idx+1, callback);
                    } // if (idx === blogs.length - 1)
                } // if (err)
            }); // db.collection('blogs').updateMany( ... );

            // Log the already-replied
            options.loggers[1].log('warn',
                                    '<' + funcName + '> Blog already replied: ' +
                                    (idx+1) + '/' + blogs.length + ' ' +
                                    blog.author + ' - ' + blog.permlink);

            // Upvote next blog
            if (idx === blogs.length - 1) {
                db.close();
                if (callback) {
                    callback();
                } // if (callback)
                return ;
            } else {
                PrepareReplyBlog(options, db, blogs, idx+1, callback);
            } // if (idx === blogs.length - 1)
        } else {                                                    // Not yet replied
            // Do I need to reply this blog? check quiets
            db.collection('quiets').find({}).toArray(function(err, res) {
                if (err) {
                    options.loggers[1].log('error',
                                            '<' + funcName + '.db.quiets.find> ' +
                                            err.message);
                    if (idx === blogs.length - 1) {
                        db.close();
                        if (callback) {
                            callback(err);
                        } // if (callback)
                        return err;
                    } else {
                        PrepareReplyBlog(options, db, blogs, idx+1, callback);
                    } // if (idx === blogs.length - 1)
                } // if (err)

                // Do I reply or not
                if (res.map( (e)=>e.name ).includes(blog.author)) {     // Quiet
                    // Save the voting to the database
                    db.collection('blogs').updateMany({ author:blog.author, permlink:blog.permlink },
                                                      { $set:{ reply:'QUIET' } }, function(err, res) {
                        if (err) {
                            options.loggers[1].log('error',
                                                    '<' + funcName + '.db.blogs.updateMany> ' +
                                                    err.message);
                        } // if (err)
                    }); // db.collection('blogs').updateMany( ... );

                    // Log the quiet
                    options.loggers[1].log('info',
                                            '<' + funcName + '> Blog quiet: ' +
                                            (idx+1) + '/' + blogs.length + ' ' +
                                            blog.author + ' - ' + blog.permlink);

                    if (idx === blogs.length - 1) {
                        db.close();
                        if (callback) {
                            callback();
                        } // if (callback)
                        return ;
                    } else {
                        PrepareReplyBlog(options, db, blogs, idx+1, callback);
                    } // if (idx === blogs.length - 1)
                } else {                                                // Reply
                    // Wait for the reply procedure is idle
                    while(options.replying) {
                        wait.for.time(1);
                    } // while(options.replying)
                    ReplyBlog(options, db, blogs, idx, callback);
                } // else - if (res.map( (e)=>e.name ).includes(blog.author))
            }); // db.collection('quiets').find({}).toArray(function(err, res) );
        } // else - if (results.map( (b)=>b.author ).includes(options.me))
    }); // steem.api.getContentReplies(blog.author, blog.permlink, ... );
}; // var PrepareReplyBlog = function(options, db, blogs, idx, callback) { ... };

/**
 * Reply the blog
 * @param {json}        options     the options for the job
 * @param {object}      db          the database handle
 * @param {array}       blogs       the list of blogs to be upvoted
 * @param {integer}     idx         the index of the current blog
 * @param {function}    callback    the callback function
 */
var ReplyBlog = function(options, db, blogs, idx, callback) {
    var funcName = 'ReplyBlog';
    var blog = blogs[idx];

    // Prepare message for the user, who wants to get reply
    var msg = '';
    options.messages[options.locale.code].forEach(function(e) {
        msg += e[Math.floor(Math.random() * e.length)];
    }); // options.messages[options.locale.code].forEach( ... );

    // Reply now
    options.replying = true;
    steem.broadcast.comment(options.posting_key, blog.author, blog.permlink,
                            options.me, null, '', msg, '', function(err, res) {
        if (err) {
            options.replying = false;
            options.loggers[1].log('error',
                                   '<' + funcName + '.steem.broadcast.comment> ' +
                                   err.message);
            if (idx === blogs.length - 1) {
                db.close();
                if (callback) {
                    callback(err);
                } // if (callback)
                return err;
            } else {
                PrepareReplyBlog(options, db, blogs, idx+1, callback);
            } // if (idx === blogs.length - 1)
        } // if (err)

        // Release the flag at right time
        setTimeout(function() {
            options.replying = false;
        }, options.reply_gap * 1000);

        // Log the reply event
        options.loggers[1].log('info',
                                '<' + funcName + '> Blog replied: ' + (idx+1) +
                                '/' + blogs.length + ' ' + blog.author +
                                ' - ' + blog.permlink);

        // Save the voting to the database
        db.collection('blogs').updateMany({ author:blog.author, permlink:blog.permlink },
                                         { $set:{ reply:'DONE' } }, function(err, res) {
            if (err) {
                options.loggers[1].log('error',
                                        '<' + funcName + '.db.blogs.updateMany> ' +
                                        err.message);
            } // if (err)
        }); // db.collection('blogs').updateMany( ... );

        // Now it's time to go to the next blog, if available
        if (idx === blogs.length - 1) {
            db.close();
            if (callback) {
                callback();
            } // if (callback)
            return ;
        } else {
            PrepareReplyBlog(options, db, blogs, idx+1, callback);
        } // if (idx === blogs.length - 1)
    }); // steem.broadcast.comment( ... );
}; // var ReplyBlog = function(options, db, blogs, idx, callback) { ... };
