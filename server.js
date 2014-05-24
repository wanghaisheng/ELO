var express = require('express')
    , http = require('http')
    , path = require('path')
    , bcrypt = require('bcrypt');
//auth middleware, will be put in the RESTful APIs which require authentication
function authenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.send(401);     //send 401 to trigger client side redirecting to login page
}

function hashPassword(password, fn){                 //encrypt password
    bcrypt.genSalt(12, function(err, salt){
        if (err) console.log(err);
        bcrypt.hash(password, salt, function(err, hash){
            if (err) console.log(err);
            fn(hash);
        })
    });
};
var UserDAO = require('./lib/userDAO');
var CommentDAO = require('./lib/commentDAO');
var User = require('./lib/userCache');
var Comment = require('./lib/commentCache');


var app = express();

var passport = require('passport')
    , LocalStrategy = require('passport-local').Strategy;

var port = Number(process.env.PORT || 5000);
var baseUrl = "http://localhost:"+port+'/';     //development environment
if (process.env.REDISTOGO_URL) {                //Heroku production enrironment
    baseUrl = "http://www.studycolony.com/";
}
app.configure(function(){
    app.set('port', process.env.PORT || 3000);
//    app.use(express.favicon());
    app.use(express.logger('dev'));
    app.use(express.json());
    app.use(express.urlencoded());
    app.use(express.methodOverride());
    app.use(express.cookieParser("LMN"));
    app.use(express.session({ secret: 'keyboard cat' }));
    // Initialize Passport!  Also use passport.session() middleware, to support
    // persistent login sessions (recommended).
    app.use(clientErrorHandler);
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(express.compress());     //transfer http packages in gzip compressed format
    app.use(app.router)
    app.use(express.static(path.join(__dirname, 'public')));

});

app.configure('development', function(){
    console.log('================ development environment ================');
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

function clientErrorHandler(err, req, res, next) {
    if (req.xhr) {
        res.send(500, { error: 'Something blew up!' });
    } else {
        next(err);
    }
};
//Reuse MongoDB connection pool
var uri;
if (process.env.MONGOLAB_URI) {
    uri = process.env.MONGOLAB_URI;
} else {           //development environment
    uri = 'mongodb://localhost:27017/studyColony';
}
// Initialize connection once
var MongoClient = require('mongodb').MongoClient
    , ObjectID = require('mongodb').ObjectID
    , format = require('util').format;
var db, server;
MongoClient.connect(uri,{server: {auto_reconnect: true}}, function(err, mongo) {
    if(err) console.log(err);
    db = mongo;
    server = app.listen(port, function() {        //start app server after mongodb is connected
        console.log('Listening on port %d', server.address().port);
//        require('./lib/bootstrap').init()       //for data migration uses only
    });
});
var email   = require("emailjs/email");
var mailServer  = email.server.connect({
    user:    "username",
    password:"password",
    host:    "smtp.gmail.com",
    ssl:     true
});
app.get('/show/:col/:id', authenticated, function(req, res) {
    var col = req.params.col;
    var id = req.params.id;
    res.setHeader('Content-Type', 'application/json; charset="utf-8"');
    db.collection(col).findOne({_id: new ObjectID(id)}, function(err, data) {
        res.end(JSON.stringify(data));
    });
});
app.get('/getUserNicks/:idList', authenticated, function(req, res) {
    var idList = [];
    req.params.idList.split(',').forEach(function(id){
        idList.push(new ObjectID(id));
    });
    res.setHeader('Content-Type', 'application/json; charset="utf-8"');
    db.collection('user').find({_id: {$in: idList}},{nick:1}).toArray(function(err, data) {
        res.end(JSON.stringify(data));
    });
});
app.delete('/remove/:col/:id', authenticated, function(req, res) {
    var col = req.params.col;
    var id = req.params.id;
    res.setHeader('Content-Type', 'application/json; charset="utf-8"');
    db.collection(col).remove({_id: new ObjectID(id), email: req.session.passport.user.email}, function(err, numberOfRemovedDocs) {
        res.end(JSON.stringify({'numberOfRemovedDocs':numberOfRemovedDocs}));
    });
});
app.get('/list/:col', authenticated, function(req, res) {
    var col = req.params.col;
    var id = req.session.passport.user._id;
    res.setHeader('Content-Type', 'application/json; charset="utf-8"');
    db.collection('user').findOne({_id: new ObjectID(id)}, {follow:1}, function(err, user){
        var followList = [];
        if(user.follow){
            followList = user.follow;
        }
        followList.push(id);
        console.log(followList);
        db.collection(col).find({authorId: {'$in': followList}}).toArray(function(err, dataList) {
            if(err) {
                res.end(JSON.stringify([]));
            }
            else {
                for(var i in dataList){
                    dataList[i].date = Date.parse(dataList[i].date);
                    if(dataList[i].content.length > 200){
                        dataList[i].content = dataList[i].content.substring(0,200) + '...';
                    }
                    if(dataList[i].comments){
                        dataList[i].commentCount = dataList[i].comments.length;
                        dataList[i].comments = [];
                    }
                }
                res.end(JSON.stringify(dataList));
            }
        });
    })
});
app.get('/listByAuthor/:id', authenticated, function(req, res) {
    var id = req.params.id;
//    var id = req.session.passport.user._id;
    res.setHeader('Content-Type', 'application/json; charset="utf-8"');
    if(id){
        db.collection("course").find({authorId: id}).toArray(function(err, dataList) {
            if(err) {
                res.end(JSON.stringify([]));
            }
            else {
                for(var i in dataList){
                    dataList[i].date = Date.parse(dataList[i].date);
                    if(dataList[i].content.length > 200){
                        dataList[i].content = dataList[i].content.substring(0,200) + '...';
                    }
                    if(dataList[i].comments){
                        dataList[i].commentCount = dataList[i].comments.length;
                        dataList[i].comments = [];
                    }
                }
                res.end(JSON.stringify(dataList));
            }
        });
    }
    else{
        res.end(JSON.stringify([]));
    }
});
app.get('/topUsers', authenticated, function(req, res) {
    res.setHeader('Content-Type', 'application/json; charset="utf-8"');
    db.collection('user').find({$query: {}, $orderby: {lastPublish : -1 }}).limit(6).toArray(function(err, userList){
        console.log(err);
//        console.log(userList);
        res.end(JSON.stringify(userList));
    })
});
app.get('/follow/:id', authenticated, function(req, res) {
    var id = req.params.id;
    var user = req.session.passport.user;
    res.setHeader('Content-Type', 'application/json; charset="utf-8"');
    db.collection('user').update({_id : new ObjectID(user._id)}, {$addToSet: {follow: id}},function(err, ok){
        res.end(JSON.stringify(ok));
    })
});
app.get('/unfollow/:id', authenticated, function(req, res) {
    var id = req.params.id;
    var user = req.session.passport.user;
    res.setHeader('Content-Type', 'application/json; charset="utf-8"');
    db.collection('user').update({_id : new ObjectID(user._id)}, {$pull: {"follow": id}},function(err, ok){
        res.end(JSON.stringify(ok));
    })
});
app.post('/save/:col', authenticated, function(req, res){
    var user = req.session.passport.user;
    var col = req.params.col;
    var record = req.body;
    record.email = user.email;
    record.authorId = user._id;
    record.date = new Date();
    record.content = record.content.substring(0,100000);
    res.setHeader('Content-Type', 'application/json; charset="utf-8"');
    db.collection(col).insert(record, function(err, result) {
        db.collection('user').update({_id : new ObjectID(user._id)}, {$set: {lastPublish: new Date()}}, function(err, result) {
            res.end(JSON.stringify({status : 'ok'}));
        });
    });
});
app.post('/exist/comment/:id', authenticated, function(req, res){
    var comment = req.body;
    var id = req.params.id;
    res.setHeader('Content-Type', 'application/json; charset="utf-8"');
    db.collection('course').find({'_id': new ObjectID(id), 'comments':{$elemMatch: {'text': comment.text}}}).toArray(function(err, result){
        if(result.length > 0){
            res.end(JSON.stringify({'exist': true}));
        }
        else{
            res.end(JSON.stringify({'exist': false}));
        }
    });
});
app.post('/save/comment/:id', authenticated, function(req, res){
    var user = req.session.passport.user;
    var id = req.params.id;
    var record = {};
    record.text = req.body.text;
    record.position = req.body.position;
    record.reply = [];
    record.reply.push({nick:user.nick, email: user.email, date: new Date(), content: req.body.reply.content.substring(0,4000)});
    res.setHeader('Content-Type', 'application/json; charset="utf-8"');
    db.collection('course').update({'_id': new ObjectID(id)}, {$push:{'comments': record}}, function(err, result) {
        res.end(JSON.stringify({status : 'ok'}));
    });
});
app.post('/insert/comment/:id', authenticated, function(req, res){
    var user = req.session.passport.user;
    var id = req.params.id;
    var record = req.body;
    record.reply.nick = user.nick;
    record.reply.email = user.email;
    record.reply.date =  new Date();
    record.reply.content = record.reply.content.substring(0,4000);
    res.setHeader('Content-Type', 'application/json; charset="utf-8"');
    db.collection('course').update({'_id': new ObjectID(id), 'comments': {$elemMatch:{'text':record.text}}}, {$push: {'comments.$.reply': record.reply}}, function(err, result) {
        res.end(JSON.stringify({status : 'ok'}));
    });
});
app.get('/list/comment/:id', authenticated, function(req, res){
    var id = req.params.id;
    res.setHeader('Content-Type', 'application/json; charset="utf-8"');
    db.collection('course').findOne({'_id': new ObjectID(id)}, {comments: 1}, function(err, result) {
        res.end(JSON.stringify(result.comments));
    });
});
app.post('/saveUser', authenticated, function(req, res){
    var email = req.session.passport.user.email;
    var userProfile = req.body;
    res.setHeader('Content-Type', 'application/json; charset="utf-8"');
    db.collection('user').update({email: email}, {$set: userProfile}, function(err, user) {
        if(err) console.log(err);
        res.end(JSON.stringify({status : 'user profile updated.'}));
    });
});
app.post('/signOn', function(req, res){
    var userProfile = req.body;
    res.setHeader('Content-Type', 'application/json; charset="utf-8"');
    db.collection('user').findOne({email: userProfile.email},function(err, user) {
        if(err) {
            console.log(err);
            res.end(JSON.stringify({status : 'failed'}));
        }
        else if(user){
            res.end(JSON.stringify({status : 'exist'}));
        }
        else{
            db.collection('user').insert(userProfile, function(err, user) {
                if(err) {
                    console.log(err);
                    res.end(JSON.stringify({status : 'failed'}));
                }
                else{
                    mailServer.send({
                        attachment: [ {data:    "<html><h4>Hello " + user[0].nick + ", <br><br>Welcome to our free e-learning community! <br>Please click <a href=" + baseUrl+"activate/" + user[0]._id+ ">this link</a> to activate your user account. </h4><i>best regards,</i><hr> <i>Study Colony</i></html>", alternative:true}],
                        from:    "Study Colony<teamofelc@gmail.com>",
                        to:      user[0].email,
                        subject: "Welcome to StudyColony"
                    }, function(err, message) {
                        if(err) {
                            console.log(err);
                            console.log(message);
                            res.end(JSON.stringify({status : 'failed to register, please try again later.'}));
                        }
                        else{
                            res.end(JSON.stringify({status : 'registered, please check your email.'}));
                        }
                    });
                }
            });
        }
    });
});
app.get('/userInfo', authenticated, function(req, res){
    var email = req.session.passport.user.email;
    res.setHeader('Content-Type', 'application/json; charset="utf-8"');
    db.collection('user').findOne({email: email}, function(err, user) {
        res.end(JSON.stringify(user));
    });
});

app.get('/forget/:email', function(req, res){
    var email = req.params.email;
    res.setHeader('Content-Type', 'application/json; charset="utf-8"');
    db.collection('user').findOne({email: email}, function(err, user) {
        if(user){
            var resetID = new ObjectID();
            db.collection('user').update({email: email}, {$set: {resetID: resetID}},function(err, result) {
                mailServer.send({
                    attachment: [ {data:    "<html><h4>Hello " + user.nick + ",<br>Please click <a href=" + baseUrl+"reset/" + resetID+ ">this link</a> to reset your password. <br></h4><hr> <i>Study Colony</i></html>", alternative:true}],
                    from:    "Study Colony<teamofelc@gmail.com>",
                    to:      user.email,
                    subject: "Reset your password"
                }, function(err, message) {
                    if(err) {
                        console.log(err);
                        res.end(JSON.stringify({status : 'Failed to send mail, please try again later.'}));
                    }
                    else{
                        res.end(JSON.stringify({status : 'Reset mail has been sent to: '+email+'.'}));
                    }
                });
            });
        }
        else{
            res.end(JSON.stringify({status : 'This user account does not exist.'}));
        }
    });

});

app.get('/reset/:id', function(req, res){
    var id = req.params.id;
    res.setHeader('Content-Type', 'text/html; charset="utf-8"');
    db.collection('user').findOne({resetID: new ObjectID(id)}, function(err, user) {
        if(user){
            res.send("<!DOCTYPE html><html><head><title>Reset Password</title></head><body><style type='text/css'>body{margin:10%; width:50%}form {display: inline-block;}button{background-color: #0078e7;color: #fff;font-size: 100%;text-decoration: none;border-radius: 2px;display: inline-block;line-height: normal;white-space: nowrap;vertical-align: baseline;text-align: center;cursor: pointer;padding: .5em 1em;border: 0 rgba(0,0,0,0);}input{padding: .5em .6em;display: inline-block;border: 1px solid #ccc;box-shadow: inset 0 1px 3px #ddd;border-radius: 4px;-webkit-box-sizing: border-box;-moz-box-sizing: border-box;box-sizing: border-box;}.pull-right{float: right}</style><h2>Reset Password<img class='pull-right' src='/img/logo.png'>  </h2><hr><form action='/resetPassword' method='post'><input type='hidden' name='id' value='"+id+"'><input type='password'  name='password' placeholder='New Password' maxlength='20' required><br><button type='submit'>Reset</button></form></body></html>");
        }
    });
});
app.get('/voice', authenticated, function(req,res){
//    res.sendfile('./public/html/voiceRecognition.html');              //This is the one will be implemented later
    res.send('<h2>This is a undeveloped feature. Please allow a few days to get it done.</h2>');        //temporary response
});
app.post('/resetPassword', function(req, res){
    var id = req.body.id;
    var password = req.body.password;
    hashPassword(password, function(hash){
        if(hash){
            db.collection('user').update({resetID: new ObjectID(id)}, {$set: {password: hash}, $unset:{resetID:''}}, function(err, user) {
                if(err) console.log(err);
                else
                res.send("<h2>Your password has been changed successfully.<br>Please click <a href=" + baseUrl+ "> the link </a> to login.</h2>");
             });
        }
        else{
            res.send('<h2>Your password is NOT changed, please try again later.</h2>');
        }
    });
});

app.get('/activate/:id', function(req, res){
    var id = req.params.id;
    res.setHeader('Content-Type', 'text/html; charset="utf-8"');
    db.collection('user').findOne({_id: new ObjectID(id)}, function(err, user) {
        if(err) console.log(err);
        hashPassword(user.password, function(hash){
            if(hash){
                db.collection('user').update({_id: new ObjectID(id)}, {$set: {password: hash}}, function(err, user) {
                    res.send("<h2>Your account is activated.<br>Please click <a href=" + baseUrl+ "> the link </a> to login.</h2>");
                });
            }
            else{
                res.send('<h2>Your account is NOT activated, please try again later.</h2>');
            }
        });
    });
});
app.get('/login', function(req, res){
    res.redirect('/');
});

app.post('/login',
    passport.authenticate('local', { failureRedirect: '/' }),
    function(req, res) {
        res.setHeader('Content-Type', 'application/json; charset="utf-8"');
        res.end(JSON.stringify({success: true, user:req.session.passport.user}));
    });

app.get('/logout', function(req, res){
    req.logout();
    res.redirect('/');
});

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(obj, done) {
    done(null, obj);
});

passport.use(new LocalStrategy({
        usernameField: 'email',
        passwordField: 'password'
    },
    function(username, password, done) {
        db.collection('user').findOne({ email: username }, function(err, user) {
            if (err) { return done(err); }
            if (!user) {
                return done(null, false, { message: 'Incorrect username.' });
            }
            bcrypt.compare(password, user.password, function(err, res) {
                if(! res) {
                    return done(null, false, { message: 'Incorrect password.' });
                }
                else{
                    return done(null, user);
                }
            });
        });
    }
));