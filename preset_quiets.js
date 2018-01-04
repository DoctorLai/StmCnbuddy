var fs = require('fs');
var MongoClient = require('mongodb').MongoClient;

var password = fs.readFileSync('pw.log', 'utf8').toString().trim();
loadOptions(password, __dirname, function(options) {        // This takes >2s
    var x = [
        { 'name':'aafeng' },
        { 'name':'abit' },
        { 'name':'acactus1013' },
        { 'name':'argenisboom' },
        { 'name':'bobdos' },
        { 'name':'chinadaily' },
        { 'name':'cifer' },
        { 'name':'fr3eze' },
        { 'name':'harbour' },
        { 'name':'jessie901220' },
        { 'name':'liangfengyouren' },
        { 'name':'lovemyson' },
        { 'name':'monkeyplayfire' },
        { 'name':'oflyhigh' },
        { 'name':'rea' },
        { 'name':'rivalhw' },
        { 'name':'the01crow' },
        { 'name':'yuxi' },
    ]; // var x = [ ... ];
    MongoClient.connect(options.database, function(err, db) {
        db.collection('quiets').insertMany(x, function(err, res) {
            if (err) {
                console.error(err);
            } else {
                console.log('done');
            } // else - if (err)
        }); // db.collection('quiets').insertMany(x, function(err, res) { ... });
    }); // MongoClient.connect(options.database, function(err, db) { ... });
}); // loadOptions(password, __dirname, function(options) { ... });
