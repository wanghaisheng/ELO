
/**
 * @ngdoc overview
 * @name ngResource
 * @description
 */

angular.module('ngResource', ['ng']).
    factory('$resource', ['$http', '$parse', function($http, $parse) {
        var DEFAULT_ACTIONS = {
            'get':    {method:'GET'},
            'save':   {method:'POST'},
            'query':  {method:'GET', isArray:true},
            'remove': {method:'DELETE'},
            'delete': {method:'DELETE'}
        };
        var noop = angular.noop,
            forEach = angular.forEach,
            extend = angular.extend,
            copy = angular.copy,
            isFunction = angular.isFunction,
            getter = function(obj, path) {
                return $parse(path)(obj);
            };

        /**
         * We need our custom method because encodeURIComponent is too aggressive and doesn't follow
         * http://www.ietf.org/rfc/rfc3986.txt with regards to the character set (pchar) allowed in path
         * segments:
         *    segment       = *pchar
         *    pchar         = unreserved / pct-encoded / sub-delims / ":" / "@"
         *    pct-encoded   = "%" HEXDIG HEXDIG
         *    unreserved    = ALPHA / DIGIT / "-" / "." / "_" / "~"
         *    sub-delims    = "!" / "$" / "&" / "'" / "(" / ")"
         *                     / "*" / "+" / "," / ";" / "="
         */
        function encodeUriSegment(val) {
            return encodeUriQuery(val, true).
                replace(/%26/gi, '&').
                replace(/%3D/gi, '=').
                replace(/%2B/gi, '+');
        }


        /**
         * This method is intended for encoding *key* or *value* parts of query component. We need a custom
         * method because encodeURIComponent is too aggressive and encodes stuff that doesn't have to be
         * encoded per http://tools.ietf.org/partial/rfc3986:
         *    query       = *( pchar / "/" / "?" )
         *    pchar         = unreserved / pct-encoded / sub-delims / ":" / "@"
         *    unreserved    = ALPHA / DIGIT / "-" / "." / "_" / "~"
         *    pct-encoded   = "%" HEXDIG HEXDIG
         *    sub-delims    = "!" / "$" / "&" / "'" / "(" / ")"
         *                     / "*" / "+" / "," / ";" / "="
         */
        function encodeUriQuery(val, pctEncodeSpaces) {
            return encodeURIComponent(val).
                replace(/%40/gi, '@').
                replace(/%3A/gi, ':').
                replace(/%24/g, '$').
                replace(/%2C/gi, ',').
                replace(/%20/g, (pctEncodeSpaces ? '%20' : '+'));
        }

        function Route(template, defaults) {
            this.template = template;
            this.defaults = defaults || {};
            this.urlParams = {};
        }

        Route.prototype = {
            setUrlParams: function(config, params, actionUrl) {
                var self = this,
                    url = actionUrl || self.template,
                    val,
                    encodedVal;

                var urlParams = self.urlParams = {};
                forEach(url.split(/\W/), function(param){
                    if (param && (new RegExp("(^|[^\\\\]):" + param + "(\\W|$)").test(url))) {
                        urlParams[param] = true;
                    }
                });
                url = url.replace(/\\:/g, ':');

                params = params || {};
                forEach(self.urlParams, function(_, urlParam){
                    val = params.hasOwnProperty(urlParam) ? params[urlParam] : self.defaults[urlParam];
                    if (angular.isDefined(val) && val !== null) {
                        encodedVal = encodeUriSegment(val);
                        url = url.replace(new RegExp(":" + urlParam + "(\\W|$)", "g"), encodedVal + "$1");
                    } else {
                        url = url.replace(new RegExp("(\/?):" + urlParam + "(\\W|$)", "g"), function(match,
                                                                                                     leadingSlashes, tail) {
                            if (tail.charAt(0) == '/') {
                                return tail;
                            } else {
                                return leadingSlashes + tail;
                            }
                        });
                    }
                });

                // strip trailing slashes and set the url
                url = url.replace(/\/+$/, '');
                // then replace collapse `/.` if found in the last URL path segment before the query
                // E.g. `http://url.com/id./format?q=x` becomes `http://url.com/id.format?q=x`
                url = url.replace(/\/\.(?=\w+($|\?))/, '.');
                // replace escaped `/\.` with `/.`
                config.url = url.replace(/\/\\\./, '/.');


                // set params - delegate param encoding to $http
                forEach(params, function(value, key){
                    if (!self.urlParams[key]) {
                        config.params = config.params || {};
                        config.params[key] = value;
                    }
                });
            }
        };


        function ResourceFactory(url, paramDefaults, actions) {
            var route = new Route(url);

            actions = extend({}, DEFAULT_ACTIONS, actions);

            function extractParams(data, actionParams){
                var ids = {};
                actionParams = extend({}, paramDefaults, actionParams);
                forEach(actionParams, function(value, key){
                    if (isFunction(value)) { value = value(); }
                    ids[key] = value && value.charAt && value.charAt(0) == '@' ? getter(data, value.substr(1)) : value;
                });
                return ids;
            }

            function Resource(value){
                copy(value || {}, this);
            }

            forEach(actions, function(action, name) {
                action.method = angular.uppercase(action.method);
                var hasBody = action.method == 'POST' || action.method == 'PUT' || action.method == 'PATCH';
                Resource[name] = function(a1, a2, a3, a4) {
                    var params = {};
                    var data;
                    var success = noop;
                    var error = null;
                    var promise;

                    switch(arguments.length) {
                        case 4:
                            error = a4;
                            success = a3;
                        //fallthrough
                        case 3:
                        case 2:
                            if (isFunction(a2)) {
                                if (isFunction(a1)) {
                                    success = a1;
                                    error = a2;
                                    break;
                                }

                                success = a2;
                                error = a3;
                                //fallthrough
                            } else {
                                params = a1;
                                data = a2;
                                success = a3;
                                break;
                            }
                        case 1:
                            if (isFunction(a1)) success = a1;
                            else if (hasBody) data = a1;
                            else params = a1;
                            break;
                        case 0: break;
                        default:
                            throw "Expected between 0-4 arguments [params, data, success, error], got " +
                                arguments.length + " arguments.";
                    }

                    var value = this instanceof Resource ? this : (action.isArray ? [] : new Resource(data));
                    var httpConfig = {},
                        promise;

                    forEach(action, function(value, key) {
                        if (key != 'params' && key != 'isArray' ) {
                            httpConfig[key] = copy(value);
                        }
                    });
                    httpConfig.data = data;
                    route.setUrlParams(httpConfig, extend({}, extractParams(data, action.params || {}), params), action.url);

                    function markResolved() { value.$resolved = true; }

                    promise = $http(httpConfig);
                    value.$resolved = false;

                    promise.then(markResolved, markResolved);
                    value.$then = promise.then(function(response) {
                        var data = response.data;
                        var then = value.$then, resolved = value.$resolved;

                        if (data) {
                            if (action.isArray) {
                                value.length = 0;
                                forEach(data, function(item) {
                                    value.push(new Resource(item));
                                });
                            } else {
                                copy(data, value);
                                value.$then = then;
                                value.$resolved = resolved;
                            }
                        }

                        (success||noop)(value, response.headers);

                        response.resource = value;
                        return response;
                    }, error).then;

                    return value;
                };


                Resource.prototype['$' + name] = function(a1, a2, a3) {
                    var params = extractParams(this),
                        success = noop,
                        error;

                    switch(arguments.length) {
                        case 3: params = a1; success = a2; error = a3; break;
                        case 2:
                        case 1:
                            if (isFunction(a1)) {
                                success = a1;
                                error = a2;
                            } else {
                                params = a1;
                                success = a2 || noop;
                            }
                        case 0: break;
                        default:
                            throw "Expected between 1-3 arguments [params, success, error], got " +
                                arguments.length + " arguments.";
                    }
                    var data = hasBody ? this : undefined;
                    Resource[name].call(this, params, data, success, error);
                };
            });

            Resource.bind = function(additionalParamDefaults){
                return ResourceFactory(url, extend({}, paramDefaults, additionalParamDefaults), actions);
            };

            return Resource;
        }

        return ResourceFactory;
    }]);

