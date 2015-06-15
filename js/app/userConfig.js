/*global define,$ */
/*jslint browser:true,sloppy:true,nomen:true,unparam:true,plusplus:true */
/** @license
 | Copyright 2015 Esri
 |
 | Licensed under the Apache License, Version 2.0 (the "License");
 | you may not use this file except in compliance with the License.
 | You may obtain a copy of the License at
 |
 |    http://www.apache.org/licenses/LICENSE-2.0
 |
 | Unless required by applicable law or agreed to in writing, software
 | distributed under the License is distributed on an "AS IS" BASIS,
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 | See the License for the specific language governing permissions and
 | limitations under the License.
 */
//============================================================================================================================//
define(function () {
    var self;
    return {

        // Constants for callback to app
        notificationSignIn: 0,
        notificationSignOut: 1,
        notificationAvatarUpdate: 2,

        //--------------------------------------------------------------------------------------------------------------------//

        _loggedIn: null,
        _user: null,
        _statusCallback: null,
        _currentProvider: null,

        //--------------------------------------------------------------------------------------------------------------------//

        init: function (appConfig, buttonContainer, statusCallback) {
            self = this;
            var deferred = $.Deferred();
            var isIE8 = self._createIE8Test();
            self._statusCallback = statusCallback;
            self.appConfig = appConfig;

            //................................................................................................................//

            // Attempt to initialize Facebook if wanted
            var facebookDeferred = $.Deferred();
            setTimeout(function () {
                if (!isIE8 && appConfig.appParams.showFacebook) {
                    // Provide a startup function for when the SDK finishes loading
                    window.fbAsyncInit = function () {
                        FB.Event.subscribe("auth.login", function () {console.warn("auth.login --> update");});//???
                        FB.Event.subscribe("auth.login", self._updateFacebookUser);
                        FB.Event.subscribe("auth.statusChange", function () {console.warn("auth.statusChange --> update");});//???
                        FB.Event.subscribe("auth.statusChange", self._updateFacebookUser);
                        FB.Event.subscribe("auth.logout", function () {console.warn("auth.logout --> update");});//???
                        FB.Event.subscribe("auth.logout", self._updateFacebookUser);

                        FB.init({
                            appId: self.appConfig.appParams.facebookAppId,
                            cookie: true,  // enable cookies to allow the server to access the session
                            xfbml: false,   // parse social plugins on this page such as Login
                            status: true,  // check login status on every page load
                            version: "v2.3"
                        });

                        // Update UI based on whether or not the user is currently logged in to FB
                        console.warn("fbAsyncInit --> update");//???
                        FB.getLoginStatus(self._updateFacebookUser);
                    };

                    // Load the SDK asynchronously; it calls window.fbAsyncInit when done
                    (function (d, s, id) {
                        var js, fjs = d.getElementsByTagName(s)[0];
                        if (d.getElementById(id)) {
                            return;
                        }
                        js = d.createElement(s);
                        js.id = id;
                        js.src = "//connect.facebook.net/en_US/sdk.js";
                        fjs.parentNode.insertBefore(js, fjs);
                    }(document, "script", "facebook-jssdk"));


                    $('<div id="facebookSignin" class="socialMediaButton facebookOfficialColor" style="background-image:url(\'images/FB-f-Logo__blue_29.png\')">Facebook</div>').appendTo(buttonContainer);
                    $('#facebookSignin').on('click', function () {
                        // Force reauthorization. FB says, "Apps should build their own mechanisms for allowing switching
                        // between different Facebook user accounts using log out functions and should not rely upon
                        // re-authentication for this."  (https://developers.facebook.com/docs/facebook-login/reauthentication),
                        // but doesn't seem to provide a working logout function that clears its cookies if third-party
                        // cookies are blocked.
                        FB.login(function (response) {
                            console.warn("login response: " + JSON.stringify(response));//???
                        }, {
                            auth_type: 'reauthenticate'
                        });
                    });
                    facebookDeferred.resolve(true);
                } else {
                    facebookDeferred.resolve(false);
                }
            });

            //................................................................................................................//

            // Attempt to initialize Google+ if wanted
            var googlePlusDeferred = $.Deferred();
            setTimeout(function () {
                if (!isIE8 && appConfig.appParams.showGooglePlus) {
                    // Load the SDK asynchronously; it calls window.ggAsyncInit when done
                    (function () {
                        // Don't have Google+ API scan page for button
                        window.___gcfg = {parsetags: "explicit"};

                        // Modernizr/yepnope for load to get onload event cross-browser
                        Modernizr.load([{
                            load: "https://apis.google.com/js/client:platform.js",
                            complete: function () {
                                gapi.load('auth2', function () {
                                    gapi.client.load('plus', 'v1').then(function () {
                                        $('<div id="googlePlusSignin" class="socialMediaButton googlePlusOfficialColor" style="background-image:url(\'images/gp-29.png\')">Google+</div>').appendTo(buttonContainer);
                                        $('#googlePlusSignin').on('click', function () {
                                            // Google caveat for setting cookiepolicy to "none":
                                            // The none value does not set cookies or session storage for the sign-in button
                                            // and uses a less efficient fallback mechanism for determining user and session
                                            // information. Setting this value to none also prevents gapi.auth.signout from
                                            // working for the user and requires you to implement signout appropriately. This
                                            // value also can prevent a user who is signed in to multiple Google accounts
                                            // (say, work and personal) from being able to select which account to use with
                                            // your website.
                                            // -- https://developers.google.com/+/web/signin/reference/#button_attr_clientid
                                            gapi.auth.signIn({
                                                "clientid": self.appConfig.appParams.googleplusClientId,
                                                "cookiepolicy": "http://" + document.location.hostname,
                                                "callback": self._updateGooglePlusUser
                                            });
                                        });
                                        googlePlusDeferred.resolve(true);
                                    });
                                });
                            }
                        }]);
                    }());
                } else {
                    googlePlusDeferred.resolve(false);
                }
            });

            //................................................................................................................//

            // Attempt to initialize Twitter if wanted
            var twitterDeferred = $.Deferred();
            setTimeout(function () {
                if (!isIE8 && appConfig.appParams.showTwitter) {



                    $('<div id="twitterSignin" class="socialMediaButton twitterOfficialColor" style="background-image:url(\'images/Twitter_logo_blue_29.png\')">Twitter</div>').appendTo(buttonContainer);
                    $('#twitterSignin').on('click', function () {
                        self._showTwitterLoginWin(false);
                    });
                    twitterDeferred.resolve(true);
                } else {
                    twitterDeferred.resolve(false);
                }
            }, 2000);

            //................................................................................................................//

            // Test if we have any initialized providers
            $.when(facebookDeferred, googlePlusDeferred, twitterDeferred)
                .done(function (facebookAvail, googlePlusAvail, twitterAvail) {
                if (facebookAvail || googlePlusAvail || twitterAvail) {
                    deferred.resolve();
                } else {
                    deferred.reject();
                }
            });

            return deferred;
        },

        /**
         * Returns the signed-in state.
         * @param {boolean} Logged in or not
         */
        isSignedIn: function () {
            return self._loggedIn;
        },

        /**
         * Returns the currently signed-in user name and service id.
         * @return {JSON} Structure containing "name" and "id" parameters if a user is
         * logged in, an empty structure if a user is not logged in, and null if the
         * service is not available due to browser incompatibility or startup failure
         * @memberOf social#
         */
        getUser: function () {
            return self._user;
        },

        signOut: function () {
            console.warn("signOut; believed logged in: " + self.isSignedIn());
            if (self.isSignedIn()) {
                switch (self._currentProvider) {

                    case "facebook":
                        // Log the user out of the app; known FB issue is that cookies are not cleared as promised if
                        // browser set to block third-party cookies
                        FB.logout();
                        break;

                    case "googlePlus":
                        // Log the user out of the app; known G+ issue that user is not really logged out
                        try {
                            self._disconnectUser(self._user.access_token);
                            gapi.auth.signOut();
                            self._showGooglePlusLogoutWin();
                        } catch (ignore) {
                        }
                        break;

                    case "twitter":
                        // Update the calling app
                        self._statusCallback(self.notificationSignOut);

                        // Log the user out of the app; known Twitter issue that it does not log the current user out
                        // unless he/she enters a password and then clicks "cancel", and then clicks to return to the
                        // app even though the Twitter display claims that the app continues to have access to the
                        // user's information.
                        self._showTwitterLoginWin(true);
                        break;
                }
            }
            self._currentProvider = "none";
        },

        //--------------------------------------------------------------------------------------------------------------------//

        /**
         * Updates the information held about the signed-in user.
         * @param {object} [response] Service-specific response object
         * @memberOf socialFB#
         * @abstract
         */
        _updateFacebookUser: function (response) {
            // Events & FB.getLoginStatus return an updated authResponse object
            // {
            //     status: 'connected',
            //     authResponse: {
            //         accessToken: '...',
            //         expiresIn:'...',
            //         signedRequest:'...',
            //         userID:'...'
            //     }
            // }

            // self response may not be true; we'll find out for sure when we call FB.api
            self._loggedIn = response && response.status === "connected";
            console.warn("_updateFacebookUser; believe logged in: " + self._loggedIn);//???
            self._currentProvider = self._loggedIn ? "facebook" : "";

            // If logged in, update info from the account
            self._user = {};
            if (self._loggedIn) {
                FB.api("/me", {fields: "name,id"}, function (apiResponse) {
                    self._loggedIn = apiResponse.name !== undefined;
                    if (self._loggedIn) {
                        self._user = {
                            "name": apiResponse.name,
                            "id": apiResponse.id
                        };
                        // Update the calling app
                        self._statusCallback(self.notificationSignIn);

                        // Get the profile picture
                        FB.api("/" + self._user.id + "/picture", function (picResponse) {
                            if (picResponse && !picResponse.error) {
                                self._user.avatar = picResponse.data.url;
                            }
                            // Update the calling app
                            self._statusCallback(self.notificationAvatarUpdate);
                        });
                    }
                    self._statusCallback(self.notificationAvatarUpdate);
                });

            } else {
                // Update the calling app
                self._statusCallback(self.notificationSignOut);
            }
        },

        //--------------------------------------------------------------------------------------------------------------------//

        /**
         * Updates the information held about the signed-in user.
         * @param {object} [response] Service-specific response object
         * @memberOf socialGP#
         * @abstract
         */
        _updateGooglePlusUser: function (response) {
            self._loggedIn = response && response.status && response.status.signed_in;
            self._currentProvider = self._loggedIn ? "googlePlus" : "";

            // If logged in, update info from the account
            self._user = {};
            if (self._loggedIn) {
                gapi.client.request({
                    "path": "/plus/v1/people/me"
                }).then(function (apiResponse) {
                    self._user = {
                        "name": apiResponse.result.displayName,
                        "id": apiResponse.result.id,
                        "access_token": response.access_token
                    };

                    // Update the calling app
                    self._statusCallback(self.notificationSignIn);

                    // Update the avatar
                    if (apiResponse.result.image) {
                        self._user.avatar = apiResponse.result.image.url;
                        self._statusCallback(self.notificationAvatarUpdate);
                    }
                }, function (reason) {
                    // Update the calling app
                    self._statusCallback(self.notificationSignOut);
                });

            // Report not-logged-in state
            } else {
                self._statusCallback(self.notificationSignOut);
            }
        },

        // From https://developers.google.com/+/web/signin/disconnect
        _disconnectUser: function(access_token) {
            var revokeUrl = 'https://accounts.google.com/o/oauth2/revoke?token=' +
                access_token;

            // Perform an asynchronous GET request.
            $.ajax( {
                type: 'GET',
                url: revokeUrl,
                async: false,
                contentType: "application/json",
                dataType: 'jsonp',
                success: function(nullResponse) {
                    console.warn("access token revoked")//???
                    self._updateGooglePlusUser();
                },
                error: function(e) {
                    console.warn("access token revoke failed")//???
                    self._updateGooglePlusUser();
                }
            });
        },

        _showGooglePlusLogoutWin: function (forceLogin) {
            var baseUrl, left, top, w, h;

            baseUrl = self.appConfig.appParams.googleplusLogoutUrl;
            left = (screen.width / 2) - (w / 2);
            top = (screen.height / 2) - (h / 2);
            w = screen.width / 2;
            h = screen.height / 1.5;

            window.open(baseUrl, "GooglePlus", "scrollbars=yes, resizable=yes, left=" + left + ", top=" + top + ", width=" + w + ", height=" + h, true);
        },

        //--------------------------------------------------------------------------------------------------------------------//

        /**
         * Displays the Twitter login window.
         * <br>N.B.: does not log the current user out unless he/she enters a password and then clicks "cancel",
         * and then clicks to return to the app even though the Twitter display claims that the app continues to have
         * access to the user's information.
         * @param {boolean} [forceLogin] If true, requires a re-login
         */
        _showTwitterLoginWin: function (forceLogin) {
            var baseUrl, package_path, redirect_uri, left, top, w, h;

            baseUrl = self.appConfig.appParams.twitterSigninUrl;
            package_path = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
            redirect_uri = encodeURIComponent(location.protocol + '//' + location.host + package_path + self.appConfig.appParams.twitterCallbackUrl);
            left = (screen.width / 2) - (w / 2);
            top = (screen.height / 2) - (h / 2);
            w = screen.width / 2;
            h = screen.height / 1.5;

            baseUrl += '?';
            if (forceLogin) {
                baseUrl += 'force_login=true';
            }
            if (forceLogin && redirect_uri) {
                baseUrl += '&';
            }
            if (redirect_uri) {
                baseUrl += 'redirect_uri=' + redirect_uri;
            }

            window.oAuthCallback = function () {
                self._updateTwitterUser();
            };
            window.open(baseUrl, "twoAuth", "scrollbars=yes, resizable=yes, left=" + left + ", top=" + top + ", width=" + w + ", height=" + h, true);
        },

        /**
         * Updates the information held about the signed-in user.
         * @param {object} [response] Service-specific response object
         * @memberOf socialTW#
         * @abstract
         */
        _updateTwitterUser: function () {
            var query = {
                include_entities: true,
                skip_status: true
            };
            $.ajax({
                url: self.appConfig.appParams.twitterUserUrl,
                data: query,
                dataType: "jsonp",
                timeout: 10000,
                success: function (data, textStatus, jqXHR) {
                    console.warn("twitter ajax success: " + textStatus);//???

                    self._loggedIn = data && !data.hasOwnProperty("signedIn") && !data.signedIn;
                    self._currentProvider = self._loggedIn ? "twitter" : "";

                    if (self._loggedIn) {
                        self._user = {
                            "name": data.name,
                            "id": data.id_str
                        };

                        // Update the calling app
                        self._statusCallback(self.notificationSignIn);

                        // Update the avatar
                        if (data.profile_image_url_https) {
                            self._user.avatar = data.profile_image_url_https;
                            self._statusCallback(self.notificationAvatarUpdate);
                        }
                    } else {
                        self._user = {};

                        // Update the calling app
                        self._statusCallback(self.notificationSignOut);
                    }
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    console.warn("twitter ajax fail: " + textStatus);//???  not called for cross-domain?

                    // handle an error condition
                    self._loggedIn = false;

                    // Update the calling app
                    self._statusCallback(self.notificationSignOut);
                }
            }, "json");
        },

        //--------------------------------------------------------------------------------------------------------------------//

        /**
         * Tests if the browser is IE 8 or lower.
         * @return {boolean} True if the browser is IE 8 or lower
         */
        _createIE8Test: function () {
            return self._isIE(8, "lte");
        },

        /**
         * Detects IE and version number through injected conditional comments (no UA detect, no need for conditional
         * compilation / jscript check).
         * @param {string} [version] IE version
         * @param {string} [comparison] Operator testing multiple versions based on "version"
         * parameter, e.g., 'lte', 'gte', etc.
         * @return {boolean} Result of conditional test; note that since IE stopped supporting conditional comments with
         * IE 10, this routine only works for IE 9 and below; for IE 10 and above, it always returns "false"
         * @author Scott Jehl
         * @see The <a href="https://gist.github.com/scottjehl/357727">detect IE and version number through injected
         * conditional comments.js</a>.
         */
        _isIE: function (version, comparison) {
            var cc      = 'IE',
                b       = document.createElement('B'),
                docElem = document.documentElement,
                isIE;

            if (version) {
                cc += ' ' + version;
                if (comparison) { cc = comparison + ' ' + cc; }
            }

            b.innerHTML = '<!--[if ' + cc + ']><b id="iecctest"></b><![endif]-->';
            docElem.appendChild(b);
            isIE = !!document.getElementById('iecctest');
            docElem.removeChild(b);
            return isIE;
        }

    };
});
