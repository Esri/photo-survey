/*global define,$,Modernizr,FB,gapi,window */
/*jslint browser:true */
/*property
    Deferred, Event, ___gcfg, access_token, ajax, allowGuestSubmissions, api,
    appId, appParams, appendChild, appendTo, appendWithLF, async, auth,
    auth_type, availabilities, avatar, callback, canSubmit, client, clientid,
    complete, contentType, cookie, cookiepolicy, createElement, createIE8Test,
    currentProvider, data, dataType, default_profile_image, disconnectUser,
    displayName, documentElement, done, error, facebook, facebookAppId,
    fbAsyncInit, fields, getElementById, getElementsByTagName, getLoginStatus,
    getUser, googleplus, googleplusClientId, googleplusLogoutUrl, guest,
    guestLabel, hasOwnProperty, height, host, hostname, id, id_str, image,
    include_entities, init, initUI, innerHTML, insertBefore, isDefault, isIE,
    isSignedIn, is_silhouette, lastIndexOf, load, location, loggedIn, login,
    logout, name, notificationAvatarUpdate, notificationSignIn,
    notificationSignOut, oAuthCallback, on, open, parentNode, parsetags, path,
    pathname, profile_image_url_https, protocol, reject, removeChild, request,
    resolve, result, showFacebook, showGooglePlus, showGooglePlusLogoutWin,
    showGuest, showTwitter, showTwitterLoginWin, signIn, signOut, signedIn,
    signed_in, signin, skip_status, src, status, statusCallback, subscribe,
    substring, success, then, timeout, twitter, twitterCallbackUrl,
    twitterSigninUrl, twitterUserUrl, type, updateFacebookUser,
    updateGooglePlusUser, updateTwitterUser, url, user, version, when, width,
    xfbml
*/
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
define(['lib/i18n.min!nls/resources.js', 'diag'], function (i18n, diag) {
    'use strict';
    var handleUserSignin = {

        // Constants for callback to app
        notificationSignIn: 0,
        notificationSignOut: 1,
        notificationAvatarUpdate: 2,

        //--------------------------------------------------------------------------------------------------------------------//

        loggedIn: null,
        user: null,
        statusCallback: null,
        currentProvider: null,
        availabilities: {
            guest: false,
            facebook: false,
            googleplus: false,
            twitter: false
        },

        //--------------------------------------------------------------------------------------------------------------------//

        /**
         * Initializes the module by initializing each of the supported and selected social medium providers.
         * @param {object} appParams Application parameters to control and facilitate social-media setup; module uses the
         * facebookAppId, googleplusClientId, googleplusLogoutUrl, showFacebook, showGooglePlus, showTwitter,
         * twitterCallbackUrl, twitterSigninUrl, and twitterUserUrl properties
         * @param {function} statusCallback Function to call with social-media status events; function receives one of the
         * constants notificationSignIn, notificationSignOut, notificationAvatarUpdate (above)
         */
        init: function (appParams, statusCallback) {
            var deferred, isIE8, facebookDeferred, googlePlusDeferred, twitterDeferred;

            deferred = $.Deferred();
            isIE8 = handleUserSignin.createIE8Test();
            handleUserSignin.statusCallback = statusCallback;
            handleUserSignin.appParams = appParams;

            //................................................................................................................//

            // Do we offer guest access?
            handleUserSignin.availabilities.guest = appParams.showGuest;
                //???|| (!appParams.showFacebook && !appParams.showGooglePlus && !appParams.showTwitter);

            //................................................................................................................//

            // Attempt to initialize Facebook if wanted
            facebookDeferred = $.Deferred();
            setTimeout(function () {
                if (!isIE8 && appParams.showFacebook) {
                    // Provide a startup function for when the SDK finishes loading
                    window.fbAsyncInit = function () {
                        FB.Event.subscribe("auth.login", handleUserSignin.updateFacebookUser);
                        FB.Event.subscribe("auth.statusChange", handleUserSignin.updateFacebookUser);
                        FB.Event.subscribe("auth.logout", handleUserSignin.updateFacebookUser);

                        FB.init({
                            appId: handleUserSignin.appParams.facebookAppId,
                            cookie: true,  // enable cookies to allow the server to access the session
                            xfbml: false,   // parse social plugins on this page such as Login
                            status: true,  // check login status on every page load
                            version: "v2.3"
                        });

                        // Update UI based on whether or not the user is currently logged in to FB
                        FB.getLoginStatus(handleUserSignin.updateFacebookUser);
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

                    handleUserSignin.availabilities.facebook = true;
                    facebookDeferred.resolve(true);
                } else {
                    facebookDeferred.resolve(false);
                }
            });

            //................................................................................................................//

            // Attempt to initialize Google+ if wanted
            googlePlusDeferred = $.Deferred();
            setTimeout(function () {
                if (!isIE8 && appParams.showGooglePlus) {
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
                                        handleUserSignin.availabilities.googleplus = true;
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
            twitterDeferred = $.Deferred();
            setTimeout(function () {
                if (!isIE8 && appParams.showTwitter) {
                    handleUserSignin.availabilities.twitter = true;
                    twitterDeferred.resolve(true);
                } else {
                    twitterDeferred.resolve(false);
                }
            });

            //................................................................................................................//

            // Test if we have any initialized providers
            $.when(facebookDeferred, googlePlusDeferred, twitterDeferred)
                .done(function (facebookAvail, googlePlusAvail, twitterAvail) {
                    if (handleUserSignin.availabilities.guest || facebookAvail || googlePlusAvail || twitterAvail) {
                        deferred.resolve();
                    } else {
                        deferred.reject();
                    }
                });

            return deferred;
        },

        initUI: function (buttonContainer) {

            if (handleUserSignin.availabilities.guest) {  //??? i18n
                $('<div id="guestSignin" class="socialMediaButton guestOfficialColor"><span class="socialMediaIcon sprites guest-user_29"></span>'
                        + i18n.signin.guestLabel + '</div>').appendTo(buttonContainer);
                $('#guestSignin').on('click', function () {
                    handleUserSignin.loggedIn = true;
                    handleUserSignin.currentProvider = "guest";
                    diag.appendWithLF("guest login");  //???

                    handleUserSignin.user = {
                        name: i18n.signin.guestLabel,
                        id: "",
                        canSubmit: handleUserSignin.appParams.allowGuestSubmissions
                    };

                    // Update the calling app
                    handleUserSignin.statusCallback(handleUserSignin.notificationSignIn);
                });
            }

            if (handleUserSignin.availabilities.facebook) {
                $('<div id="facebookSignin" class="socialMediaButton facebookOfficialColor"><span class="socialMediaIcon sprites FB-f-Logo__blue_29"></span>Facebook</div>').appendTo(buttonContainer);
                $('#facebookSignin').on('click', function () {
                    // Force reauthorization. FB says, "Apps should build their own mechanisms for allowing switching
                    // between different Facebook user accounts using log out functions and should not rely upon
                    // re-authentication for this."  (https://developers.facebook.com/docs/facebook-login/reauthentication),
                    // but doesn't seem to provide a working logout function that clears its cookies if third-party
                    // cookies are blocked.
                    FB.login(function () {
                        return null;
                    }, {
                        auth_type: 'reauthenticate'
                    });
                });
            }

            if (handleUserSignin.availabilities.googleplus) {
                $('<div id="googlePlusSignin" class="socialMediaButton googlePlusOfficialColor"><span class="socialMediaIcon sprites gp-29"></span>Google+</div>').appendTo(buttonContainer);
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
                        clientid: handleUserSignin.appParams.googleplusClientId,
                        cookiepolicy: "http://" + document.location.hostname,
                        callback: handleUserSignin.updateGooglePlusUser
                    });
                });
            }

            if (handleUserSignin.availabilities.twitter) {
                $('<div id="twitterSignin" class="socialMediaButton twitterOfficialColor"><span class="socialMediaIcon sprites Twitter_logo_blue_29"></span>Twitter</div>').appendTo(buttonContainer);
                $('#twitterSignin').on('click', function () {
                    handleUserSignin.showTwitterLoginWin(false);
                });
            }

        },

        /**
         * Returns the signed-in state.
         * @return {boolean} Logged in or not
         */
        isSignedIn: function () {
            return handleUserSignin.loggedIn;
        },

        /**
         * Returns the currently signed-in user name and service id.
         * @return {object} Structure containing "name" and "id" parameters if a user is
         * logged in, an empty structure if a user is not logged in, and null if the
         * service is not available due to browser incompatibility or startup failure
         */
        getUser: function () {
            return handleUserSignin.user;
        },

        /**
         * Signs the user out of the currently-active social medium provider.
         */
        signOut: function () {
            diag.appendWithLF("signOut; believed logged in: " + handleUserSignin.isSignedIn());  //???
            if (handleUserSignin.isSignedIn()) {
                switch (handleUserSignin.currentProvider) {

                case "guest":
                    diag.appendWithLF("guest logout");  //???
                    handleUserSignin.user = {};

                    // Update the calling app
                    handleUserSignin.statusCallback(handleUserSignin.notificationSignOut);
                    break;

                case "facebook":
                    diag.appendWithLF("FB logout");  //???
                    // Log the user out of the app; known FB issue is that cookies are not cleared as promised if
                    // browser set to block third-party cookies
                    FB.logout();
                    break;

                case "googlePlus":
                    diag.appendWithLF("G+ logout");  //???
                    // Log the user out of the app; known G+ issue that user is not really logged out
                    try {
                        handleUserSignin.disconnectUser(handleUserSignin.user.access_token);
                        gapi.auth.signOut();
                        handleUserSignin.showGooglePlusLogoutWin();
                    } catch (ignore) {
                    }
                    break;

                case "twitter":
                    diag.appendWithLF("Tw logout");  //???
                    // Update the calling app
                    handleUserSignin.statusCallback(handleUserSignin.notificationSignOut);

                    // Log the user out of the app
                    handleUserSignin.showTwitterLoginWin(true);
                    break;
                }
            }
            handleUserSignin.currentProvider = "none";
        },

        //--------------------------------------------------------------------------------------------------------------------//

        /**
         * Updates the information held about the signed-in Facebook user.
         * @param {object} [response] Service-specific response object
         * @private
         */
        updateFacebookUser: function (response) {
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

            // that response may not be true; we'll find out for sure when we call FB.api
            handleUserSignin.loggedIn = response && response.status === "connected";
            handleUserSignin.currentProvider = handleUserSignin.loggedIn
                ? "facebook"
                : "";

            // If logged in, update info from the account
            handleUserSignin.user = {};
            if (handleUserSignin.loggedIn) {
                FB.api("/me", {fields: "name,id"}, function (apiResponse) {
                    handleUserSignin.loggedIn = apiResponse.name !== undefined;
                    if (handleUserSignin.loggedIn) {
                        handleUserSignin.user = {
                            name: apiResponse.name,
                            id: apiResponse.id,
                            canSubmit: true
                        };
                        // Update the calling app
                        handleUserSignin.statusCallback(handleUserSignin.notificationSignIn);

                        // Update the avatar
                        FB.api("/" + handleUserSignin.user.id + "/picture", function (picResponse) {
                            if (picResponse && !picResponse.error && picResponse.data && !picResponse.data.is_silhouette && picResponse.data.url) {
                                handleUserSignin.user.avatar = picResponse.data.url;
                            }
                            // Update the calling app
                            handleUserSignin.statusCallback(handleUserSignin.notificationAvatarUpdate);
                        });
                    }
                    handleUserSignin.statusCallback(handleUserSignin.notificationAvatarUpdate);
                });

            } else {
                // Update the calling app
                handleUserSignin.statusCallback(handleUserSignin.notificationSignOut);
            }
        },

        //--------------------------------------------------------------------------------------------------------------------//

        /**
         * Updates the information held about the signed-in Google+ user.
         * @param {object} [response] Service-specific response object
         * @private
         */
        updateGooglePlusUser: function (response) {
            handleUserSignin.loggedIn = response && response.status && response.status.signed_in;
            handleUserSignin.currentProvider = handleUserSignin.loggedIn
                ? "googlePlus"
                : "";

            // If logged in, update info from the account
            handleUserSignin.user = {};
            if (handleUserSignin.loggedIn) {
                gapi.client.request({
                    path: "/plus/v1/people/me"
                }).then(function (apiResponse) {
                    handleUserSignin.user = {
                        name: apiResponse.result.displayName,
                        id: apiResponse.result.id,
                        access_token: response.access_token,
                        canSubmit: true
                    };

                    // Update the calling app
                    handleUserSignin.statusCallback(handleUserSignin.notificationSignIn);

                    // Update the avatar
                    if (apiResponse.result.image && !apiResponse.result.image.isDefault && apiResponse.result.image.url) {
                        handleUserSignin.user.avatar = apiResponse.result.image.url;
                        handleUserSignin.statusCallback(handleUserSignin.notificationAvatarUpdate);
                    }
                }, function () {
                    // Update the calling app
                    handleUserSignin.statusCallback(handleUserSignin.notificationSignOut);
                });

            // Report not-logged-in state
            } else {
                handleUserSignin.statusCallback(handleUserSignin.notificationSignOut);
            }
        },

        /**
         * Disconnects the signed-in Google+ user because the Google+ API doesn't actually sign the user out.
         * @param {string}access_token Token provided by the Google+ API when the user signs in
         * @private
         */
        disconnectUser: function (access_token) {
            // From https://developers.google.com/+/web/signin/disconnect
            var revokeUrl = 'https://accounts.google.com/o/oauth2/revoke?token=' + access_token;

            // Perform an asynchronous GET request.
            $.ajax({
                type: 'GET',
                url: revokeUrl,
                async: false,
                contentType: "application/json",
                dataType: 'jsonp',
                success: function () {
                    handleUserSignin.updateGooglePlusUser();
                },
                error: function () {
                    handleUserSignin.updateGooglePlusUser();
                }
            });
        },

        /**
         * Displays the Google+ logout window, which completes the logout of the current user.
         * @private
         */
        showGooglePlusLogoutWin: function () {
            var baseUrl, left, top, w, h;

            baseUrl = handleUserSignin.appParams.googleplusLogoutUrl;
            left = (screen.width / 2) - (w / 2);
            top = (screen.height / 2) - (h / 2);
            w = screen.width / 2;
            h = screen.height / 1.5;

            window.open(baseUrl, "GooglePlus", "scrollbars=yes, resizable=yes, left=" + left + ", top=" + top + ", width=" + w + ", height=" + h, true);
        },

        //--------------------------------------------------------------------------------------------------------------------//

        /**
         * Displays the Twitter login window.
         * @param {boolean} [forceLogin] If false or omitted, sets up for login; if true, sets up for logout
         * @private
         */
        showTwitterLoginWin: function (forceLogin) {
            var baseUrl, package_path, redirect_uri, left, top, w, h;

            baseUrl = handleUserSignin.appParams.twitterSigninUrl;
            package_path = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
            redirect_uri = encodeURIComponent(location.protocol + '//' + location.host + package_path + handleUserSignin.appParams.twitterCallbackUrl);
            left = (screen.width / 2) - (w / 2);
            top = (screen.height / 2) - (h / 2);
            w = screen.width / 2;
            h = screen.height / 1.5;

            baseUrl += '?';
            if (forceLogin) {
                baseUrl += 'force_login=true';
                if (redirect_uri) {
                    baseUrl += '&';
                }
            }
            if (redirect_uri) {
                baseUrl += 'redirect_uri=' + redirect_uri;
            }

            window.open(baseUrl, "twoAuth", "scrollbars=yes, resizable=yes, left=" + left + ", top=" + top + ", width=" + w + ", height=" + h, true);
            window.oAuthCallback = function () {
                handleUserSignin.updateTwitterUser();
            };
        },

        /**
         * Updates the information held about the signed-in Twitter user.
         * @param {object} [response] Service-specific response object
         * @private
         */
        updateTwitterUser: function () {
            var query = {
                include_entities: true,
                skip_status: true
            };
            $.ajax({
                url: handleUserSignin.appParams.twitterUserUrl,
                data: query,
                dataType: "jsonp",
                timeout: 10000,
                success: function (data) {

                    handleUserSignin.loggedIn = data && !data.hasOwnProperty("signedIn") && !data.signedIn;
                    handleUserSignin.currentProvider = handleUserSignin.loggedIn
                        ? "twitter"
                        : "";

                    if (handleUserSignin.loggedIn) {
                        handleUserSignin.user = {
                            name: data.name,
                            id: data.id_str,
                            canSubmit: true
                        };

                        // Update the calling app
                        handleUserSignin.statusCallback(handleUserSignin.notificationSignIn);

                        // Update the avatar
                        if (!data.default_profile_image && data.profile_image_url_https) {
                            handleUserSignin.user.avatar = data.profile_image_url_https;
                            handleUserSignin.statusCallback(handleUserSignin.notificationAvatarUpdate);
                        }
                    } else {
                        handleUserSignin.user = {};

                        // Update the calling app
                        handleUserSignin.statusCallback(handleUserSignin.notificationSignOut);
                    }
                },
                error: function () {
                    // handle an error condition
                    handleUserSignin.loggedIn = false;

                    // Update the calling app
                    handleUserSignin.statusCallback(handleUserSignin.notificationSignOut);
                }
            }, "json");
        },

        //--------------------------------------------------------------------------------------------------------------------//

        /**
         * Tests if the browser is IE 8 or lower.
         * @return {boolean} True if the browser is IE 8 or lower
         * @private
         */
        createIE8Test: function () {
            return handleUserSignin.isIE(8, "lte");
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
         * @see <a href="https://gist.github.com/scottjehl/357727">detect IE and version number through injected
         * conditional comments.js</a>.
         * @private
         */
        isIE: function (version, comparison) {
            var cc = 'IE',
                b = document.createElement('B'),
                docElem = document.documentElement,
                isIE;

            if (version) {
                cc += ' ' + version;
                if (comparison) {
                    cc = comparison + ' ' + cc;
                }
            }

            b.innerHTML = '<!--[if ' + cc + ']><b id="iecctest"></b><![endif]-->';
            docElem.appendChild(b);
            isIE = !!document.getElementById('iecctest');
            docElem.removeChild(b);
            return isIE;
        }

    };
    return handleUserSignin;
});
