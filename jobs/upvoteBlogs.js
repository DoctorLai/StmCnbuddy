/**
 * The job to upvote blogs
 * @author:  MarcoXZh3
 * @version: 1.1.0
 */
var GetVotingWeight = require('../memberships').GetVotingWeight;
var MongoClient = require('mongodb').MongoClient;
var steem = require('steem');
var wait = require('wait-for-stuff');


var moduleName = 'upvoteBlogs';

/**
 * Upvote all blogs
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
        db.collection('blogs').find({ upvote:{ $eq:'NOT' }, upvoteat:{ $lte:now } })
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

            // Log the blogs to be upvoted
            options.loggers[1].log('info',
                                    '<' + funcName + '> Blogs upvoting: '
                                        + res.length);

            if (res.length === 0) {
                now.setUTCSeconds(0, 0);
                if (callback) {
                    callback({ now:now, blogs:res });
                } // if (callback)
                return { now:now, blogs:res };
            } // if (res.length === 0)

            // Mark them as upvoting
            db.collection('blogs').updateMany({ upvote:{ $eq:'NOT' }, upvoteat:{ $lte:now } },
                                              { $set:{ upvote:'ING' } }, function(err, res) {
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
 * Prepare to upvote the blogs
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
            db.collection('blogs').updateOne({ author:blog.author, permlink:blog.permlink },
                                             { $set:{ upvote:'DONE' } },
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
            while(options.voting) {
                wait.for.time(1);
            } // while(options.voting)
            UpvoteBlog(options, db, blogs, idx, callback);
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
    votingWeight *= options.voting_power;           // apply cnbuddy's voting power
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
            } // if (idx === blogs.length - 1)
        } // if (err)

        // Release the flag at right time
        setTimeout(function() {
            options.voting = false;
        }, options.upvote_gap * 1000);

        // Log the upvote event
        options.loggers[1].log('info',
                                '<' + funcName + '> Blog upvoted: ' + (idx+1) +
                                '/' + blogs.length + ' ' + blog.author +
                                ' - ' + blog.permlink);

        // Save the voting to the database
        db.collection('blogs').updateOne({ author:blog.author, permlink:blog.permlink },
                                         { $set:{ upvote:'DONE' } },
                                         function(err, res) {
            if (err) {
                options.loggers[1].log('error',
                                       '<' + funcName + '.db.blogs.update> ' +
                                       err.message);
            } // if (err)
        }); // db.collection('blogs').update( ... );

        // Now let's go to the next  blog, if available
        if (idx === blogs.length - 1) {
            db.close();
            if (callback) {
                callback();
            } // if (callback)
        } else {
            PrepareUpvoteBlog(options, db, blogs, idx+1, callback);
        } // if (idx === blogs.length - 1)
    }); // steem.broadcast.vote( ..?. );
}; // var UpvoteBlog = function(options, db, blogs, idx, callback) { ... };
