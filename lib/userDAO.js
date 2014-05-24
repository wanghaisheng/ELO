var uri;
if (process.env.MONGOLAB_URI) {
    uri = process.env.MONGOLAB_URI;
} else {           //development environment
    uri = 'mongodb://localhost:27017/studyColony';
}

var MongoClient = require('mongodb').MongoClient
    , ObjectID = require('mongodb').ObjectID
    , format = require('util').format;
var userCol;
MongoClient.connect(uri, function(err, db) {
    if(err) throw err;
    userCol = db.collection('user');
});

exports.move = function(user, fn){
    var resetID = new ObjectID();
    user.resetID = resetID;
    userCol.update({email: user.email}, user,{upsert: true}, function(err, result) {
        if (err) {
            console.log('---------------  error: failed to move user -----------------');
            console.log(user);
        }
        else {
            userCol.findOne({email: user.email}, function(err,existUser){
                fn(existUser);
            });
        }
    });
};