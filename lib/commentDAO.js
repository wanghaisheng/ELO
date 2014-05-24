var uri;
if (process.env.MONGOLAB_URI) {
    uri = process.env.MONGOLAB_URI;
} else {           //development environment
    uri = 'mongodb://127.0.0.1:27017/studyColony';
}

var MongoClient = require('mongodb').MongoClient
    , format = require('util').format;
var commentCol;
MongoClient.connect(uri, function(err, db) {
    if(err) throw err;
    commentCol = db.collection('comment');
});

exports.move = function(comment){
    commentCol.update({date: comment.date}, comment, {upsert: true}, function(err, result) {
        if (err) {
            console.log('---------------  error: failed to move comment -----------------');
            console.log(comment);
        }
    });
};
