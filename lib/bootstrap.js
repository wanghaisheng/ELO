//migrate redis User data to MongoDB
var UserDAO = require('./userDAO');
var User = require('./userCache');
var CommentDAO = require('./commentDAO');
var Comment = require('./commentCache');
var email   = require("emailjs/email");
var mailServer  = email.server.connect({
    user:    "teamofelc",
    password:"vfrtgb123",
    host:    "smtp.gmail.com",
    ssl:     true
});
var ObjectID = require('mongodb').ObjectID;
var port = Number(process.env.PORT || 5000);
var baseUrl = "http://localhost:"+port+'/';    //development environment
if (process.env.REDISTOGO_URL) {               //Heroku production enrironment
    baseUrl = "http://www.studycolony.com/";
}
exports.init = function(){
    User.list(function(err, user){
        if(! user) {
            console.log(err);
        }
        else {
            UserDAO.move(user, function(user){
                mailServer.send({
                    attachment: [{data:    "<html><h4>Hello " + user.nick + ", <br><br>Since Google will soon deprecate OpenID API, StudyColony will no longer use Google OpenID as authentication mehtod. Please click <a href=" + baseUrl+"reset/" + user.resetID+ ">this link</a> to set your password. Thanks!</h3> <br><hr> <i>Study Colony</i></html>", alternative:true}],
                    from:    "Study Colony<teamofelc@gmail.com>",
                    to:      user.email,
                    subject: "Set your StudyColony password"
                }, function(err, message) { console.log(message.header)});
            });
        }
    });
    Comment.list(function(err, comment){
        if(! comment) {
            console.log(err);
        }
        else {
            CommentDAO.move(comment);
        }
    });
}