var db;
if (process.env.REDISTOGO_URL) {
    db = require('redis-url').connect(process.env.REDISTOGO_URL);
} else {           //development environment
    db = require("redis").createClient();
}

exports.list = function(fn){
    db.keys("comment:*", function(err, commentList){       //redis: list all keys
        if(err) {
            fn(err, null);
        }
        else {
            for(var i in commentList){
                db.hgetall(commentList[i], function(err, comment){  //get a comment record
                    fn(null, comment);
                })
            }
        }
    })
};