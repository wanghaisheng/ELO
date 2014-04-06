
var redis = require('redis')
    , bcrypt = require('bcrypt')
    , db = redis.createClient(); // create long-running redis connection
module.exports = User; // export User function from the module

function User(obj) {
    for (var key in obj) { // iterate keys in the object passed
        this[key] = obj[key]; // merge values
    }
}

User.findByEmailOrSave = function(profile, fn){
    var ids = profile.id.split('/id?id=');
    if(ids.length > 1){
        var id = ids[1];
        var email = profile.emails[0].value;
        db.exists(email, function(err, exist){
            if(err || !exist) {
                db.hmset(email, 'id', id, 'dname', profile.displayName, 'fname', profile.name.familyName, 'gname', profile.name.givenName, function(err, ok){
                    db.hgetall(email, function(err, user){
                        fn(null, user);
                    })
                });
            }
            else{
                db.hgetall(email, function(err, user){
                    fn(null, user);
                })
            }
        });
    }

};