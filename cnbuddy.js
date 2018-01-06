/**
 * cnbuddy the utomatic upvote and reply autobot
 * @author  MarcoXZh3
 * @version 1.1.2
 */
var name = module.exports.name = 'cnbuddy';
module.exports.version = '1.1.2';

var CronJob = require('cron').CronJob;
var fs = require('fs');
var MongoClient = require('mongodb').MongoClient;

var findBlogs = require('./jobs/findBlogs');
var findCners = require('./jobs/findCners');
var findDelegations = require('./jobs/findDelegations');
var findCnFollowers = require('./jobs/findCnFollowers');
var findQuiets = require('./jobs/findQuiets');
var loadOptions = require('./jobs/loadOptions');
var upvoteBlogs = require('./jobs/upvoteBlogs');


// Start the cnbuddy
console.log(new Date().toISOString(), 'cnbuddy starting');
var password = fs.readFileSync('pw.log', 'utf8').toString().trim();
var tz = 'UTC';
loadOptions(password, __dirname, function(options) {        // This takes >2s
    options.loggers[1].log('info', 'cnbuddy started at ' + new Date().toISOString());
    var gaps = Math.round(options.job_interval / 60);
    var seconds = new Date().getUTCSeconds();

    // Prerequisites
    MongoClient.connect(options.database, function(err, db) {
        if (err) {
            options.loggers[0].log('error',
                                   '<' + name + '.MongoClient.connect> ' +
                                   err.message);
            return err;
        } // if (err)
        db.collection('blogs').updateMany({ upvoted:{ $eq:false }},
                                          { $set:{ scheduled:false }},
                                          function(err, res) {
            if (err) {
                options.loggers[1].log('error',
                                       '<' + name + '.db.cners.find> ' +
                                       err.message);
            } // if (err)
        }); // db.collection('blogs').updateMany( ... });
    }); // MongoClient.connect(options.database, function(err, db) { ... });

    // find cners
    var cntFindCners = gaps - 1;
    new CronJob(((seconds+2)%60) + ' * * * * *', function() {
        cntFindCners ++;
        if (cntFindCners !== gaps) {
            return ;
        } // if (cntFindCners !== gaps)
        cntFindCners = 0;

        // Run the job
        options.loggers[1].log('info', '<cnbuddy.findCners> starting at ' +
                                       new Date().toISOString());
        findCners(options, function(newCners) {
            options.loggers[1].log('info', '<cnbuddy.findCners> executed at ' +
                                           new Date().toISOString() +
                                           ' found=' + newCners.length);
        }); // findCners(options, function(newCners) { ... });
    }, null, true, tz); // new CronJob( ... );

    // find delegations
    var cntFindDelegations = gaps - 1;
    new CronJob(((seconds+7)%60) + ' * * * * *', function() {
        cntFindDelegations ++;
        if (cntFindDelegations !== gaps) {
            return ;
        } // if (cntFindDelegations !== gaps)
        cntFindDelegations = 0;

        // Run the job
        options.loggers[1].log('info', '<cnbuddy.findDelegations> starting at ' +
                                       new Date().toISOString());
        findDelegations(options, function(newDeles) {
            options.loggers[1].log('info', '<cnbuddy.findDelegations> executed at ' +
                                           new Date().toISOString() +
                                           ' found=' + newDeles.length);
        }); // findDelegations(options, function(newDeles) { ... });
    }, null, true, tz); // new CronJob( ... );

    // find cner followers
    var cntFindCnFollowers = gaps - 1;
    new CronJob(((seconds+11)%60) + ' * * * * *', function() {
        cntFindCnFollowers ++;
        if (cntFindCnFollowers !== gaps) {
            return ;
        } // if (cntFindCnFollowers !== gaps)
        cntFindCnFollowers = 0;

        // Run the job
        options.loggers[1].log('info', '<cnbuddy.findCnFollowers> starting at ' +
                                       new Date().toISOString());
        findCnFollowers(options, function(newNames) {
            options.loggers[1].log('info', '<cnbuddy.findCnFollowers> executed at ' +
                                           new Date().toISOString() +
                                           ' found=' + newNames.length);
        }); // findCnFollowers(options, function(newNames) { ... });
    }, null, true, tz); // new CronJob( ... );

    // find quiets
    var cntFindQuiets = gaps - 1;
    new CronJob(((seconds+17)%60) + ' * * * * *', function() {
        cntFindQuiets ++;
        if (cntFindQuiets !== gaps) {
            return ;
        } // if (cntFindQuiets !== gaps)
        cntFindQuiets = 0;

        // Run the job
        options.loggers[1].log('info', '<cnbuddy.findQuiets> starting at ' +
                                       new Date().toISOString());
        findQuiets(options, function(newQuiets) {
            options.loggers[1].log('info', '<cnbuddy.findQuiets> executed at ' +
                                           new Date().toISOString() +
                                           ' found=' + newQuiets.length);
        }); // findQuiets(options, function(newQuiets) { ... });
    }, null, true, tz); // new CronJob( ... );

    // find blogs
    var cntFindBlogs = gaps - 1;
    new CronJob(((seconds+29)%60) + ' * * * * *', function() {
        cntFindBlogs ++;
        if (cntFindBlogs !== gaps) {
            return ;
        } // if (cntFindBlogs !== gaps)
        cntFindBlogs = 0;

        // Run the job
        options.loggers[1].log('info', '<cnbuddy.findBlogs> starting at ' +
                                       new Date().toISOString());
        findBlogs(options, function(newBlogs) {
            options.loggers[1].log('info', '<cnbuddy.findBlogs> executed at ' +
                                           new Date().toISOString() +
                                           ' found=' + newBlogs.length);
        }); // findBlogs(options, function(newQuiets) { ... });
    }, null, true, tz); // new CronJob( ... );

    // upvote blogs - loop every minute
    new CronJob(((seconds+53)%60) + ' * * * * *', function() {
        options.loggers[1].log('info', '<cnbuddy.upvoteBlogs> starting at ' +
                                        new Date().toISOString());
        upvoteBlogs(options, function(result) {
            if (result.blogs.length === 0) {
                return ;
            } // if (result.blogs.length === 0)
            options.loggers[1].log('info', '<cnbuddy.upvoteBlogs> executed at ' +
                                           new Date().toISOString() +
                                           ' found=' + result.blogs.length);
        }); // upvoteBlogs(options, function(result) { ... });
    }, null, true, tz); // new CronJob( ... );

    // reload options
    var next = new Date();
    next.setUTCHours(0, 0, 0, 0);
    if (next.getTime() < new Date().getTime()) {
        next = new Date(next.getTime() + 86400000);
    } // if (next.getTime() < new Date().getTime())
    options.loggers[1].log('info', '<cnbuddy.loadOptions> schedule at ' +
                                   next.toISOString());
    new CronJob('0 0 0 * * *', function() {
        options.loggers[1].log('info', '<cnbuddy.loadOptions> starting at ' +
                                       new Date().toISOString());
        loadOptions(password, options, function(op) {
            if (op.constructor === {}.constructor) {
                options = op;
            } // if (op.constructor === {}.constructor)
            options.loggers[1].log('info', '<cnbuddy.loadOptions> executed at ' +
                                           new Date().toISOString());
        }); // loadOptions( ... );
    }, null, true, tz); // new CronJob( ... );

}); // loadOptions(password, __dirname, function(options) { ... });
