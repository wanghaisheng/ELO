var app = angular.module('app', ['ngResource', 'ui.bootstrap']);
app.config(['$routeProvider', '$locationProvider', '$httpProvider',
    function($routeProvider, $locationProvider, $httpProvider){
        $routeProvider
            .when('/',{
                templateUrl: '/partial/course.html',      //root path, show course list
                controller: 'courseListCtrl'
            })
            .when('/create',{
                templateUrl: '/partial/createCourse.html'      //root path, show course list
            })
            .when('/course/:id',{
                templateUrl: '/partial/viewCourse.html',      //view course content
                controller: 'courseShowCtrl'
            })
            .when('/viewUser/:id',{
                templateUrl: '/partial/viewUser.html',      //show user profile
                controller: 'userShowCtrl'
            })
            .when('/comment',{
                templateUrl: '/partial/comment.html',     //user comments
                controller: 'commentCtrl'
            })
            .when('/test',{
                templateUrl: '/partial/test.html',        //misc tests
                controller: 'testCtrl'
            })
            .when('/editUser',{                           //user profile
                templateUrl:'/partial/editUser.html'
            })
            .when('/p2p', {
                templateUrl: '/partial/peer.html',        //online video chat
                controller: 'peerCtrl'
            })
            .when('/login', {
                templateUrl: '/partial/login.html',       //sign in and sign up
                controller: 'loginCtrl'
            })
            .otherwise({
                templateUrl:'/partial/404.html'            //other path
            });
        $locationProvider.html5Mode(true);
        var interceptor = ['$location', '$rootScope', '$q', function($location, $rootScope, $q) {
            function success(response) {
                    return response;
            }

            function error(response) {
                var status = response.status;
                if (status === 401){
                    if($location.path()!='/login') {     //not logged in
                        $rootScope.savePath = $location.path();   //save current path for reloading after logged in
                    }
                    $location.path("/login");
//                    return response;
                }
                else if (status === 500) {
                    $rootScope.signOn = true;
                    $location.path("/");
                }
                else if (status === 404) {
                    $location.path("/404");
                }
                // otherwise

                return $q.reject(response);
            }

            return function (promise) {
                return promise.then(success, error);
            }
        }];
        $httpProvider.responseInterceptors.push(interceptor);
    }]
)
//
.run(['$rootScope', '$location', 'speech',  function ($rootScope, $location, speech) {
    if(! window.chrome){
        var warning = document.getElementById('isChrome');
        warning.innerHTML='<h4>Browser not supported</h4><h5>Please use <b>Chrome</b> to visit this site, because some of the features are only supported by Chrome at this moment. Sorry for any inconvenience. <br><br><a href="https://www.google.com/intl/zh-CN/chrome/browser/">Chrome Download link</a></h5>';
        warning.className = "alert alert-dismissable alert-danger";
    }
    $rootScope.$on("$routeChangeStart", function (event, next, current) {
//  TODO: prompt progress of long processes
        speech.cancel();        //stop speech synthesis when user navigates to another page
    });

}]);

app.factory('speech', ['$rootScope', function ($rootScope) {
    if(window.speechSynthesis && typeof SpeechSynthesisUtterance === 'function') {
        var msg = new SpeechSynthesisUtterance();
        //calling get voices method first scaffolds it for
        //use in say method
        window.speechSynthesis.getVoices();
    }

    function sayIt(text, config) {                  //only rate is configurable
        var voices = window.speechSynthesis.getVoices();
        //choose voice. Fallback to default
        if(msg && voices.length > 10) {
            msg.voice = voices[10];
            //config && config.voiceIndex ? voices[config.voiceIndex] : voices[10];
            msg.volume = 1;   //config && config.volume ? config.volume : 1;
            msg.rate = config && config.rate ? config.rate : 1;
            msg.pitch = 1;    //config && config.pitch ? config.pitch : 1;

            //message for speech
            msg.text = text;

            speechSynthesis.speak(msg);

            msg.onend = function(e){
                $rootScope.$broadcast('endOfSpeech');     //notify course controller the end of the reading
                e.preventDefault();
            }
        }
    }
    function pause(){
        if(speechSynthesis.speaking){
            speechSynthesis.pause();
        }
    }
    function resume(){
        if(speechSynthesis.paused){
            speechSynthesis.resume();
        }
    }
    function cancel(){
        if(speechSynthesis.speaking || speechSynthesis.paused){
            speechSynthesis.cancel();
        }
    }

    return {
        sayText: sayIt , pause:pause, resume:resume, cancel:cancel
    };
}]);

app.controller('courseShowCtrl', ['$scope', '$rootScope', '$resource', 'speech', '$routeParams', function ($scope, $rootScope, $resource, speech, $routeParams) {
    $scope.load = function(){
        $resource('/show/course/'+ $routeParams.id).get(function(course){
            $scope.course = course;
            $scope.showText = true;
            $scope.paragraphs = [];
            $scope.cmt = {};
            course.content.split('\n').forEach(function(para){
                $scope.paragraphs.push({text:para});
            });

            var courseText = document.getElementById('courseText');
            courseText.innerHTML = '';
            var output = document.getElementById('comment');
            $scope.comentText = '';
            output.style.display = 'none';
            var splitPosition = [];
            var len = [];
            if(course.comments){
                course.comments.sort(function(a,b){return a.position - b.position;}).forEach(function(comment, index){
                    splitPosition[index] = comment.position;        //record start position of each comment
                    len[index] = comment.text.length;
                });
            }
            var previousPosition = 0;
            $scope.overlapped = false;
            splitPosition.forEach(function(position, index){
                var span = document.createElement("span");
                var text = course.content.substring(previousPosition, position);
                span.innerHTML = text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');   //encode HTML
                courseText.insertBefore(span, null);
                span = document.createElement("span");
                span.style.backgroundColor = "yellow";
                span.addEventListener('mouseover', function(e){
                    $scope.textSelected = e.srcElement.innerText;
                    e.srcElement.style.backgroundColor = 'orange';
                    $scope.currentComments = course.comments[index];
                    $scope.currentComments.reply.sort(function(a,b){return new Date(b.date) - new Date(a.date);});
                    $scope.$apply();
                    var output = document.getElementById('comment');
                    output.style.display = "block";
                    output.style.left = '15px';
                    output.style.top = e.layerY+'px';
                    output.style.marginTop = '10px';
                    //when selected text contains part of the text which has already been commented, set this indicator to true.
                    //Then the mouseup event handler 'selectText()' will not mark the selected text as a new comment label.
                    $scope.overlapped = true;
                });
                span.addEventListener('mouseout', function(e){
                    e.srcElement.style.backgroundColor = 'yellow';
                    $scope.overlapped = false;       //reset overlap indicator to enable new text selection
                });
                span.innerHTML = course.content.substring(position, position+len[index]).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
                previousPosition = position + len[index];
                courseText.insertBefore(span, null);
            });
            var span = document.createElement("span");
            var text = course.content.substring(previousPosition).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
            span.innerHTML = text;
            courseText.insertBefore(span,null);
        });
    }
    $scope.load();
    $scope.rate = 1;
    $scope.started = false;
    $scope.playing = false;
    $scope.operation = 'fa fa-play';

    $scope.remove = function() {
        var confirmed = confirm("Are you sure you want to remove this course? \n\nWarning: Removed courses can not be recovered.");
        if (confirmed) {
            $scope.deleting = "fa fa-spinner fa-spin fa-3x";
            $resource('remove/course/'+$scope.course['_id']).delete(function(result){
                $scope.numberOfRemovedDocs = result.numberOfRemovedDocs;
                $scope.deleting = "";
            });
        }
    }
    $scope.selectText = function(e) {
        if(!$scope.overlapped){
            var output = document.getElementById('comment');
            output.style.left = '15px';
            output.style.top = e.layerY+'px';
            output.style.marginTop = '10px';
            $scope.x = e.x;
            $scope.y = e.y;
            $scope.textSelected = '';
            $scope.currentComments = [];
            if (window.getSelection && window.getSelection().toString().length>0) {
                var selected = window.getSelection();
                $scope.textSelected = selected.toString();

                var overlap = false;
                var startPosition = $scope.course.content.indexOf($scope.textSelected);
                var endPosition = startPosition + $scope.textSelected.length;
                if($scope.course.comments){
                    $scope.course.comments.forEach(function(comment){
                        if(startPosition <= comment.position && endPosition >= (comment.position+comment.text.length)){
                            overlap = true;
                        }
                    })
                }
                if(overlap){
                    $scope.textSelected = '';
                }
                else {
                    $scope.selection = selected.getRangeAt(0);
                    $scope.selectedDom = $scope.selection.extractContents();
                    var span = document.createElement("span");
                    span.style.backgroundColor = "yellow";
                    span.appendChild($scope.selectedDom);
                    $scope.position = $scope.course.content.indexOf($scope.textSelected);
                    $scope.selection.insertNode(span);
                }
            }
        }
    };

    $scope.submit = function(){                      //save a comment
        if($scope.comentText){
            $scope.saving = "fa fa-spinner fa-spin fa-3x";
            $scope.cmt.reply = {nick : $rootScope.user.nick, content: $scope.comentText};
            $scope.cmt.text = $scope.textSelected;
            $scope.cmt.position = $scope.course.content.indexOf($scope.textSelected);
            $resource('/exist/comment/' + $scope.course._id).save({text: $scope.textSelected}, function(result) {
                if(result.exist){
                    $scope.result = $resource('/insert/comment/' + $scope.course._id).save($scope.cmt, function(){
                        $scope.load();
                        $scope.saving = "";
                    });
                }
                else{
                    $scope.result = $resource('/save/comment/' + $scope.course._id).save($scope.cmt, function(){
                        $scope.load();
                        $scope.saving = "";
                    });
                }
            });
        }
        else{
            $scope.result = {status: 'Error: Incomplete Comment.'};
        }
    };
    $scope.close = function(){
        $scope.textSelected = '';
    }
    $scope.listen = function () {
        var config = {
                rate: $scope.rate
            };

        if(window.speechSynthesis) {               //read the text
            speech.sayText($scope.course.content, config);
            $scope.playing = true;
            $scope.started = true;
        }
    }
    $scope.pause = function () {
        if(window.speechSynthesis) {               //read the text
            speech.pause();
            $scope.playing = false;
        }
    }
    $scope.resume = function () {
        if(window.speechSynthesis) {               //read the text
            speech.resume();
            $scope.playing = true;
        }
    }
    $scope.cancel = function () {
        if(window.speechSynthesis) {               //read the text
            speech.cancel();
            $scope.started = false;
            $scope.playing = false;
            $scope.operation = 'fa fa-play';
        }
    }
    $scope.togglePlay = function(){
        if(!$scope.started) {
            $scope.listen();
            $scope.operation = 'fa fa-pause';
        }
        else if($scope.playing){
            $scope.pause();
            $scope.operation = 'fa fa-play';
        }
        else {
            $scope.resume();
            $scope.operation = 'fa fa-pause';
        }
    }
    $scope.$on('endOfSpeech', function(){     //accept broadcast notification from speech service
        $scope.started = false;
        $scope.playing = false;
        $scope.operation = 'fa fa-play';
        $scope.$apply();
    });

    $scope.toggleShow = function() {
        $scope.showText = !$scope.showText;
    }
}]);

app.controller('courseListCtrl',['$scope', '$rootScope', '$resource', 'speech', function ($scope, $rootScope, $resource, speech) {
    $scope.refresh = function(){
        $scope.loading = "fa fa-spinner fa-spin fa-3x";
        $resource('/list/course').query(function(courseList) {
            $scope.courses = courseList.sort(function(a,b){return new Date(b.date) - new Date(a.date);});
            $rootScope.greeting = '';
            $scope.loading = "";                                           //load all the courses
        });
        $resource('/topUsers').query(function(userList){
            $scope.topUsers = userList;
        })
    };
    if(! ($rootScope.user && $rootScope.user.email)) {
        $resource('/userInfo').get(function(user){          //load user profile when user refreshes the home page
            $rootScope.user = user;
        });
    }
    else{
        $scope.refresh();
    };
//    $scope.follow = function(id, nick){
//        $scope.result = $resource('/follow/'+id+'/'+nick).get();
//    }
}]);
app.controller('courseCreateCtrl',['$scope', '$rootScope', '$resource', '$location', 'imageResizeService', function ($scope, $rootScope, $resource, $location, imageResizeService) {
    $scope.course = {};
    $scope.selectFile = function(element) {    //select image files within the photos directory
        var file = element.files[0];
        imageResizeService.resize(file, function(canvas){
            $scope.course.img = canvas.toDataURL("image/jpeg");        //display user avatar stored in database
            $scope.$apply();
        });
    };
    $scope.submit = function(){                  //save a new course
        if($scope.course.name && $scope.course.content){
            $scope.loading = "fa fa-spinner fa-spin fa-3x";
            $scope.course.author = $rootScope.user.nick;
            $scope.result = $resource('/save/course').save($scope.course, function(){
                $location.path("/");             //redirect to course list after saving the course
            });
        }
        else{
            $scope.result = {status: 'Error: Incomplete Course.'};
        }
    };
}]);
//I wrote this manual control of collapse nav-bar in a kind of hack way, because I really don't want to import jQuery
app.controller('menuCtrl',function($scope) {
    $scope.in = ''                       //this is the class for the collapsed menu items
    $scope.toggleCollapsed = function(){
        if($scope.in == ''){
            $scope.in = 'in'             //switch open/close
        }
        else {
            $scope.in = ''
        }
    }
});
app.controller('userCtrl', function($scope, $resource, $location, imageResizeService, $rootScope){
    var userProfile = {};
    $rootScope.spin = "fa-spin";
    $scope.selectFile = function(element) {    //select image files within the photos directory
        var file = element.files[0];
        imageResizeService.resize(file, function(canvas){
            $scope.user.img = canvas.toDataURL("image/jpeg");        //display user avatar stored in database
            userProfile.img =  $scope.user.img;
            $scope.$apply();
        });
    };
    $scope.saveUserInfo = function(){                  //save user profile
        $scope.result = {};
        if($scope.user.nick){
            userProfile.nick = $scope.user.nick;
            userProfile.gender = $scope.user.gender;
            userProfile.intro = $scope.user.intro;
            $scope.result = $resource('/saveUser').save(userProfile, function(){
                $resource('/userInfo').get(function(user){           //reload user profile when it's updated
                    $rootScope.user = user;
                });
            });
            $rootScope.spin = "";
        }
        else{
            $scope.result = {status : 'no nick name'};
        }
    };
});

app.controller('userShowCtrl', function($scope, $resource, $routeParams, $rootScope){
    $scope.followed = false;
    $scope.loading = "fa fa-spinner fa-spin fa-3x";
    $resource('/show/user/'+ $routeParams.id).get(function(user){
        $scope.viewUser = user;
        $scope.followedUser = [];
        if(user.follow && user.follow.length>0){
            $resource('/getUserNicks/'+user.follow.join(',')).query(function(followUserList){
                if(followUserList){
                    $scope.followedUser = followUserList;
                }
            })
        }
    });
    $resource('/listByAuthor/' +$routeParams.id).query(function(courseList){
        $scope.courses = courseList.sort(function(a,b){return new Date(b.date) - new Date(a.date);});
        $rootScope.greeting = '';
        $scope.loading = "";
    });
    $scope.follow = function(){
        $resource('/follow/'+$scope.viewUser._id).get(function(result){
            $scope.result = result;
            if(! $rootScope.user.follow){
                $rootScope.user.follow = [];
            }
            $rootScope.user.follow.push($scope.viewUser._id);
        });
    }
    $scope.unfollow = function(){
        $scope.result = $resource('/unfollow/'+$scope.viewUser._id).get(function(result){
            $scope.result = result;
            var index = $rootScope.user.follow.indexOf($scope.viewUser._id);
            if(index >=0){
                $rootScope.user.follow.splice(index,1);
            }
        });
    }
});
app.controller('testCtrl', function($scope, $resource, $location, $rootScope){
    $scope.equal = "";
    if(document.getElementById("speak").webkitSpeech === undefined) {          //information about browser
        $scope.source = "ERROR: Speech input is not supported in your browser, please use Chrome.";
        $scope.messageType = "danger";                                         //speech recognition not supported
        $scope.webkitSpeech = false;
    }
    else {
        $scope.source ="be who you are and say what you feel";
        $scope.messageType = "success";                                        //speech recognition supported
        $scope.webkitSpeech = true;
    }

    $scope.$watch('speak', function () {           //catch any change to the speech recognition input
        if($scope.speak == $scope.source){
            $scope.equal =  'right!';              //matched
        }
        else {
            $scope.equal =  'try again!';
        }
    });
});
app.controller('commentCtrl', function($scope, $resource, $location, $rootScope){
    $scope.cmt = {};

    $scope.loading = "fa fa-spinner fa-spin fa-3x";
    $resource('/list/comment').query(function(commentList) {
        $scope.comments = commentList.sort(function(a,b){return new Date(b.date) - new Date(a.date);});
        $scope.loading = "";                                           //load all the comments
    });

    $scope.submit = function(){                      //save a comment
        if($scope.cmt.nick && $scope.cmt.content){
            $scope.loading = "fa fa-spinner fa-spin fa-3x";
            $scope.result = $resource('/save/comment').save($scope.cmt, function(){
                $resource('/list/comment').query(function(commentList) {
                    $scope.comments = commentList.sort(function(a,b){return new Date(b.date) - new Date(a.date);});
                    $scope.loading = "";                              //list all the comments after comment being saved
                });
            });
        }
        else{
            $scope.result = {status: 'Error: Incomplete Comment.'};
        }
    };
});
//use simpleWebRTC (https://github.com/henrikjoreteg/SimpleWebRTC ) to provide P2P video chat
app.controller('peerCtrl', function($scope, $location, $rootScope){
    $scope.mustLogin = false;
    $scope.join = function(){
        if($scope.topic && $rootScope.user){
            $scope.mustLogin = false;
            if(! $scope.webrtc) {
                $scope.webrtc = new SimpleWebRTC({
                    // the id/element dom element that will hold "our" video
                    localVideoEl: 'localVideo',
                    // the id/element dom element that will hold remote videos
                    remoteVideosEl: 'remoteVideos',
                    // immediately ask for camera access
                    autoRequestMedia: true
                });
            }
            $scope.webrtc.on('readyToCall', function () {
                // you can name it anything
                $scope.webrtc.joinRoom($scope.topic);
            });
        }
        else{
            $scope.mustLogin = true;
        }
    }

    $scope.quit = function(){
        $scope.webrtc.stopLocalVideo();
        $scope.webrtc.leaveRoom();
        $location.path("/");
    }
});

app.controller('loginCtrl',['$scope', '$rootScope', '$resource', '$location', 'IndexedDBService', 'speech', function ($scope, $rootScope, $resource, $location, IndexedDBService, speech) {
    $scope.user = {};
    $scope.info = {};
    $scope.userList = [];
    $scope.showLogin = true;
    IndexedDBService.open(function(){
        IndexedDBService.getAllItems('user', function(row){
                if(row){
                    $scope.userList.push(row);
                    $scope.$apply();
                }
            },
            function(){

            });
    });
    $scope.$watch('user.email', function () {           //catch any change to the speech recognition input
        if($scope.user.email){
            var user = $scope.userList.filter(function ( obj ) {
                return obj.email === $scope.user.email;
            })[0];
            if(user){
                $scope.user.password = user.password;
            }
        }
    });
    $scope.login = function(){
        $scope.info = {};
        if($scope.user.email && $scope.user.password){
            $scope.loading = "fa fa-spinner fa-spin fa-3x";
            $resource('/login').save($scope.user, function(result){
                if(result && result.success){
                    //load user profile and redirect to the original path before user authentication
                    $rootScope.user = result.user;
                    $rootScope.greeting = 'Hi new user, welcome to study colony. Please click the up right setup icon to update your profile.';
                    if($rootScope.user.nick){
                        $rootScope.greeting = 'Hi ' + $rootScope.user.nick + ', welcome to Study Colony!' ;
                    }
                    if ('speechSynthesis' in window) {      // Synthesis the greeting voice
                        speech.sayText($rootScope.greeting, null);
                    }
                    if($rootScope.savePath != '/login'){
                        var savePath = $rootScope.savePath;
                        $rootScope.savePath = '';
                        $location.path(savePath);
                    }
                    else{
                        $location.path('/');
                    }

                    //save user login information to local IndexedDB Store
                    var password = '';
                    if($scope.user.rememberPassword){
                        password = $scope.user.password;
                    }
                    var user = $scope.userList.filter(function ( obj ) {
                        return obj.email === $scope.user.email;
                    })[0];
                    if(!user || password){         //store information for new user or new password
                        var timeStamp = new Date().getTime();
                        IndexedDBService.addRecord('user', {'email': $scope.user.email, 'password': password, "timeStamp" : timeStamp}, function(){

                        });
                    }
                }
                else{
                    $scope.info = {status: 'Incorrect email or password.'};
                }
                $scope.loading = "";
            });
        }
        else{
            $scope.info = {status: 'Invalid email or password.'};
        }
    };
    $scope.reset = function(){             //send user a email for resetting password
        $scope.info = {};
        if($scope.user.email){
            $scope.loading = "fa fa-spinner fa-spin fa-3x";
            $resource('/forget/'+$scope.user.email).get(function(result){
                $scope.info = result;
                $scope.loading = "";
            });
        }
        else{
            $scope.info = {status: 'Email address can not be blank.'};
            $scope.loading = "";
        }
    };
    $scope.signOn = function(){             //register a new user
        $scope.info = {};
        if($scope.user.email){
            $scope.loading = "fa fa-spinner fa-spin fa-3x";
            $resource('/signOn').save($scope.user, function(result){
                if(result.status == 'exist'){
                    $scope.toggleLogin();
                    result.status = 'User ' + $scope.user.email + ' already exists.'
                }
                $scope.info = result;
                $scope.loading = "";
            });
        }
        else{
            $scope.info = {status: 'email address can not be blank.'};
        }
    };
    $scope.toggleLogin = function() {       //switch between sign on and sign up pages
        $scope.info = {};
        $scope.showLogin = !$scope.showLogin;
        $scope.effect = 'flipInY animated';
        if($scope.showLogin) {
            document.getElementById("userEmail").required = true;
            document.getElementById("userPassword").required = true;
            document.getElementById("newUserNick").required = false;
            document.getElementById("newUserEmail").required = false;
            document.getElementById("newUserPassword").required = false;
        }
        else{
            document.getElementById("userEmail").required = false;
            document.getElementById("userPassword").required = false;
            document.getElementById("newUserNick").required = true;
            document.getElementById("newUserEmail").required = true;
            document.getElementById("newUserPassword").required = true;
        }
    };
}]);
