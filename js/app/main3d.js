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
define(["lib/i18n.min!nls/resources.js", "app/prepareAppConfigInfo", "app/splash", "app/message",
        "app/proxy", "app/user", "app/content3d", "app/diag"],
    function (i18n, prepareAppConfigInfo, splash, message, proxy, user, content, diag) {
    "use strict";
    var main = {
        //------------------------------------------------------------------------------------------------------------//

        init: function () {
            // Get app, webmap, feature service; when we have the app parameters, we can continue setting up the app
            prepareAppConfigInfo.init().parametersReady.then(function () {
                document.title = prepareAppConfigInfo.appParams.title;
                if (prepareAppConfigInfo.appParams.diag !== undefined) {
                    diag.init();
                }

                // Init our main components
                var splashInfoPanelReady = splash.init(prepareAppConfigInfo);
                var proxyReady = proxy.test(prepareAppConfigInfo);
                message.init();

                // Display the splash screen and check that we have a proxy ready if needed
                splashInfoPanelReady.then(function () {
                    proxyReady.then(main._launch, function (error) {
                        // If unsupported browser or proxy problem, tell the user and proceed no further
                        if (error === "Unsupported browser") {
                            splash.replacePrompt(i18n.signin.unsupported);
                        } else {
                            splash.replacePrompt(i18n.signin.needProxy);
                        }
                    });
                });
            });
        },

        //------------------------------------------------------------------------------------------------------------//

        _launch: function () {
            content.init(prepareAppConfigInfo, splash).then(function () {
                // Able to run app; continue content initialization
                content.launch().then(function () {
                    // Show sign-in
                    user.launch(prepareAppConfigInfo, splash, splash.getActionsContainer());
                });

                // Wire up app
                $.subscribe("signedIn:user", function (ignore, loginInfo) {
                    diag.appendWithLF("signed in user: " + JSON.stringify(loginInfo));  //???
                    console.log();
                    splash.show(false, content.show, true);
                });

                $.subscribe("request:signOut", function () {
                    user.signout();
                });

                $.subscribe("signedOut:user", function () {
                    diag.appendWithLF("signed out");  //???
                    content.show(false, splash.show, true);
                });

            });
        }

        //------------------------------------------------------------------------------------------------------------//
    };
    main.init();
});
