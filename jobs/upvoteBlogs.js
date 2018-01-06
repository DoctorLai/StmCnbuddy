/**
 * The job to upvote blogs
 * @author:  MarcoXZh3
 * @version: 1.0.0
 */
var GetVotingWeight = require('../memberships').GetVotingWeight;
var MongoClient = require('mongodb').MongoClient;
var steem = require('steem');


var moduleName = 'upvoteBlogs';

/**
 * Upvote all posts
 * @param {json}        options     the options for the job
 * @param {function}    callback    the callback function
 *      @param {json}       result      the result json
 *          @param {date}       now         the current time
 *          @param {array}      blogs       the blogs to be voted at now
 */
module.exports = function(options, callback) {
    var funcName = 'upvoteBlogs';
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
        db.collection('blogs').find({ upvoted:{ $eq:false }, upvoteat:{$lte:now},
                                      scheduled:{ $eq:false } })
                              .toArray(function(err, res) {
            if (err) {
                options.loggers[1].log('error',
                                       '<' + moduleName + '.db.cners.find> ' +
                                       err.message);
                db.close();
                if (callback) {
                    callback(err);
                } // if (callback)
                return err;
            } // if (err)

            // Log the blogs to be upvoted and replied
            options.loggers[1].log('info',
                                    '<' + funcName + '> Blogs scheduled: '
                                        + res.length);

            if (res.length === 0) {
                now.setUTCSeconds(0, 0);
                if (callback) {
                    callback({ now:now, blogs:res });
                } // if (callback)
                return { now:now, blogs:res };
            } // if (res.length === 0)

            // Mark them as scheduled
            db.collection('blogs').updateMany({ upvoted:{ $eq:false }, upvoteat:{$lte:now} },
                                              { $set:{ scheduled:true} }, function(err, res) {
                if (err) {
                    options.loggers[1].log('error',
                                        '<' + funcName + '.db.blogs.updateMany> ' +
                                        err.message);
                } // if (err)
            }); // db.collection('blogs').updateMany( ... );

            // Upvote these blogs, one by one
            PrepareUpvoteBlog(options, db, res, 0, function() {
                now.setUTCSeconds(0, 0);
                if (callback) {
                    callback({ now:now, blogs:res });
                } // if (callback)
                return { now:now, blogs:res };
            }); // PrepareUpvoteBlog(options, db, res, 0, function() { ... });

        }); // db.collection('blogs').find( ... ).toArray( ... );
    }); // MongoClient.connect(options.database, function(err, db) { ... });
}; // module.exports = function(options, callback) { ... };

/**
 * Prepare for upvoting the blogs
 * @param {json}        options     the options for the job
 * @param {object}      db          the database handle
 * @param {array}       blogs       the list of blogs to be upvoted
 * @param {integer}     idx         the index of the current blog
 * @param {function}    callback    the callback function
 */
var PrepareUpvoteBlog = function(options, db, blogs, idx, callback) {
    var funcName = 'PrepareUpvoteBlog';
    var blog = blogs[idx];

    steem.api.getActiveVotes(blog.author, blog.permlink, function(err, results) {
        if (err) {
            options.loggers[1].log('error',
                                   '<' + funcName + '.steem.api.getActiveVotes> ' +
                                   err.message);
            if (idx === blogs.length - 1) {
                db.close();
                if (callback) {
                    callback(err);
                } // if (callback)
                return err;
            } else {
                PrepareUpvoteBlog(options, db, blogs, idx+1, callback);
            } // if (idx === blogs.length - 1)
        } // if (err)

        if (results.map( (b)=>b.voter ).includes(options.me)) {     // Blog already upvoted
            db.collection('blogs').update({ author:blog.author, permlink:blog.permlink },
                                          { $set:{ upvoted:true } },
                                          function(err, res) {
                if (err) {
                    options.loggers[1].log('error',
                                        '<' + funcName + '.db.blogs.update> ' +
                                        err.message);
                    if (idx === blogs.length - 1) {
                        db.close();
                        if (callback) {
                            callback(err);
                        } // if (callback)
                        return err;
                    } else {
                        PrepareUpvoteBlog(options, db, blogs, idx+1, callback);
                    } // if (idx === blogs.length - 1)
                } // if (err)
            }); // db.collection('blogs').update( ... );

            // Log the already-voted
            options.loggers[1].log('warn',
                                    '<' + funcName + '> Blog already voted: ' +
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
                PrepareUpvoteBlog(options, db, blogs, idx+1, callback);
            } // if (idx === blogs.length - 1)
        } else {                                                    // Not yet voted
            // Wait for the upvote procedure is idle
            (function(op, callback) {
                if (op.voting) {                            // Still voting:
                    var itvl = setInterval(function() {     // Wait every 1s
                        if (!op.voting) {                   // for voting done
                            clearInterval(itvl);
                            callback();
                        } // if (!op.voting)
                    }, 1000);
                } else {                                    // Not voting
                    callback();
                } // else - if (op.voting)
            })(options, function() {
                UpvoteBlog(options, db, blogs, idx, callback);
            }); // (function(op, callback) { ... })(options, function() { ... });
        } // else - if (results.map( (b)=>b.voter ).includes(options.me))
    }); // steem.api.getActiveVotes(blog.author, blog.permlink, ... );
}; // var PrepareUpvoteBlog = function(options, db, blogs, idx, callback) { ... };

/**
 * Upvote the blog
 * @param {json}        options     the options for the job
 * @param {object}      db          the database handle
 * @param {array}       blogs       the list of blogs to be upvoted
 * @param {integer}     idx         the index of the current blog
 * @param {function}    callback    the callback function
 */
var UpvoteBlog = function(options, db, blogs, idx, callback) {
    var funcName = 'UpvoteBlog';
    var blog = blogs[idx];

    // Voting weight setup
    var votingWeight = options.special_thanks &&
                       options.special_thanks.includes(blog.author)
                            ? 1.0 : GetVotingWeight({
                                        delegator:  blog.author,
                                        time:       blog.membertime,
                                        vests:      blog.vests
                                    },
                                    options.total_vesting_shares,
                                    options.total_vesting_fund_steem,
                                    options.cntVoted);
    if ('cntVoted' in options) {
        options.cntVoted ++;
    } // if ('cntVoted' in options)

    // Vote now
    options.voting = true;
    steem.broadcast.vote(options.posting_key, options.me, blog.author, blog.permlink,
                         Math.round(options.STEEMIT_100_PERCENT * votingWeight),
                         function(err, result) {
        if (err) {
            options.voting = false;
            if ('cntVoted' in options) {
                options.cntVoted --;
            } // if ('cntVoted' in options)
            options.loggers[1].log('error',
                                   '<' + funcName + '.steem.broadcast.vote> ' +
                                   err.message);
            if (idx === blogs.length - 1) {
                db.close();
                if (callback) {
                    callback(err);
                } // if (callback)
                return err;
            } else {
                PrepareUpvoteBlog(options, db, blogs, idx+1, callback);
            } // if (idx === blogs.length - 1)
        } // if (err)

        // Log the upvote event
        options.loggers[1].log('info',
                                '<' + funcName + '> Blog upvoted: ' + (idx+1) +
                                '/' + blogs.length + ' ' + blog.author +
                                ' - ' + blog.permlink);

        // Save the voting to the database
        db.collection('blogs').update({ author:blog.author, permlink:blog.permlink },
                                      { $set:{ upvoted:true } },
                                      function(err, res) {
            if (err) {
                options.loggers[1].log('error',
                                       '<' + funcName + '.db.blogs.update> ' +
                                       err.message);
            } // if (err)
        }); // db.collection('blogs').update( ... );

        // Now let's reply the blog
        PrepareReplyBlog(options, db, blogs, idx, callback);

        // Release the flag
        setTimeout(function() {
            options.voting = false;
        }, options.upvote_gap * 1000);

    }); // steem.broadcast.vote( ..?. );
}; // var UpvoteBlog = function(options, db, blogs, idx, callback) { ... };

/**
 * Prepare for replying the blog
 * @param {json}        options     the options for the job
 * @param {object}      db          the database handle
 * @param {array}       blogs       the list of blogs to be upvoted
 * @param {integer}     idx         the index of the current blog
 * @param {function}    callback    the callback function
 */
var PrepareReplyBlog = function(options, db, blogs, idx, callback) {
    var funcName = 'PrepareReplyBlog';
    var blog = blogs[idx];

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
                PrepareUpvoteBlog(options, db, blogs, idx+1, callback);
            } // if (idx === blogs.length - 1)
        } // if (err)

        // Do I reply or not
        if (res.map( (e)=>e.name ).includes(blog.author)) {     // Quiet
            if (idx === blogs.length - 1) {
                db.close();
                if (callback) {
                    callback();
                } // if (callback)
                return ;
            } else {
                PrepareUpvoteBlog(options, db, blogs, idx+1, callback);
            } // if (idx === blogs.length - 1)
        } else {                                                        // Reply
            // Wait for the reply procedure is idle
            (function(op, callback) {
                if (op.replying) {                          // Still replying:
                    var itvl = setInterval(function() {     // Wait every 1s
                        if (!op.replying) {                 // for replying done
                            clearInterval(itvl);
                            callback();
                        } // if (!op.replying)
                    }, 1000);
                } else {                                    // Not replying
                    callback();
                } // else - if (op.replying)
            })(options, function() {
                ReplyBlog(options, db, blogs, idx, callback);
            }); // (function(op, callback) { ... })(options, function() { ... });
        }// if (res.map( (e)=>e.name ).includes(blog.author))

    }); // db.collection('quiets').find({}).toArray(function(err, res) { ... });
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
                                   '<' + funcName + '.steem.broadcast.vote> ' +
                                   err.message);
            if (idx === blogs.length - 1) {
                db.close();
                if (callback) {
                    callback(err);
                } // if (callback)
                return err;
            } else {
                PrepareUpvoteBlog(options, db, blogs, idx+1, callback);
            } // if (idx === blogs.length - 1)
        } // if (err)

        // Log the reply event
        options.loggers[1].log('info',
                                '<' + funcName + '> Blog replied: ' + (idx+1) +
                                '/' + blogs.length + ' ' + blog.author +
                                ' - ' + blog.permlink);

        // Save the voting to the database
        db.collection('blogs').update({ author:blog.author, permlink:blog.permlink },
                                        { $set:{ replied:true } }, function(err, res) {
            if (err) {
                options.loggers[1].log('error',
                                        '<' + funcName + '.db.blogs.update> ' +
                                        err.message);
            } // if (err)
        }); // db.collection('blogs').update( ... );

        // Now it's time to go for the next blog, if available
        if (idx === blogs.length - 1) {
            db.close();
            if (callback) {
                callback();
            } // if (callback)
            return ;
        } else {
            PrepareUpvoteBlog(options, db, blogs, idx+1, callback);
        } // if (idx === blogs.length - 1)

        // Release the flag
        setTimeout(function() {
            options.replying = false;
        }, options.reply_gap * 1000);

    }); // steem.broadcast.comment( ... );
}; // var ReplyBlog = function(options, db, blogs, idx, callback) { ... };


/**
 * Wait for time
 * @param {*} flag 
 * @param {*} t 
 * @param {*} ms 
 * @param {*} callback 
 */
var waitUntil = function(flag, t, seconds, callback) {
    setTimeout(function() {
        if (flag === t) {
            callback();
        } else {
            waitUntil(flag, t, seconds, callback);
        } // if (flag === t)
    }, ms); // setTimeout(function() { ... }, ms);
}; // var waitUntil = function(flag, t, seconds, callback) { ... };
