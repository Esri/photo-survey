/*global define,$ */
/*jslint browser:true */
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
//====================================================================================================================//
define(['lib/i18n.min!nls/resources.js', 'splash', 'handleUserSignin', 'diag'],
    function (i18n, splash, handleUserSignin, diag) {
    'use strict';
    var user = {
        //------------------------------------------------------------------------------------------------------------//

        launch: function (prepareAppConfigInfo) {
            splash.replacePrompt(i18n.signin.signinFetching);

            // Start up the social media connections
            var userSigninReady = handleUserSignin.init(prepareAppConfigInfo.appParams, function (notificationType) {
                // Callback from current social medium
                switch (notificationType) {
                case handleUserSignin.notificationSignIn:
                    $.publish("signedIn:user", handleUserSignin.getUser());
                    break;
                case handleUserSignin.notificationSignOut:
                    $.publish("signedOut:user");
                    break;
                case handleUserSignin.notificationAvatarUpdate:
                    $.publish("avatar:update", handleUserSignin.getUser().avatar);
                    break;
                }
            });

            // When the social media connections are ready, we can enable the social-media sign-in buttons
            userSigninReady.then(function () {
                // Add the sign-in buttons
                handleUserSignin.initUI($("#splashInfoActions")[0]);

                // Switch to the sign-in prompt
                splash.replacePrompt(i18n.signin.signinLoginPrompt, splash.showActions);

            }, function () {
                // Switch to the no-logins message
                splash.replacePrompt(i18n.signin.noSigninsAvailable);
            });
        },

        signout: function () {
            handleUserSignin.signOut();
        },

        //------------------------------------------------------------------------------------------------------------//
    };
    return user;
});
