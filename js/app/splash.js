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
define(["lib/i18n.min!nls/resources.js", "diag"],
    function (i18n, diag) {
    "use strict";
    var splash = {
        //------------------------------------------------------------------------------------------------------------//

        init: function (prepareAppConfigInfo) {
            var splashInfoPanelReady = $.Deferred();

            // When the DOM is ready, we can start adjusting the UI
            $().ready(function () {
                // Instantiate the splash template
                $("body").loadTemplate("js/app/splash.html", {
                    splashInfoTitle: prepareAppConfigInfo.appParams.title,
                    splashInfoBody: prepareAppConfigInfo.appParams.splashText
                }, {
                    prepend: true,
                    complete: function () {
                        splashInfoPanelReady.resolve();
                        $("#splashPage").fadeIn();

                        // If we're not going to wait for the webmap's original image, just set the splash
                        if (prepareAppConfigInfo.appParams.useWebmapOrigImg) {
                            prepareAppConfigInfo.webmapOrigImageUrlReady.then(function (url) {
                                if (url) {
                                    prepareAppConfigInfo.appParams.splashBackgroundUrl = url;
                                }
                                splash.setBackground(prepareAppConfigInfo.appParams.splashBackgroundUrl);
                            });
                        } else {
                            splash.setBackground(prepareAppConfigInfo.appParams.splashBackgroundUrl);
                        }
                    }
                });
            });

            return splashInfoPanelReady;
        },

        show: function (makeVisible, thenDo, thenDoArg) {
            if (makeVisible) {
                $("#splashPage").fadeIn("fast", function () {
                    thenDo && thenDo(thenDoArg);
                });
            } else {
                $("#splashPage").fadeOut("fast", function () {
                    thenDo && thenDo(thenDoArg);
                });
            }
        },

        setBackground: function (url) {
            $("#splashPageBkgd").css("background-image", "url(" + url + ")").fadeIn(2000);
        },

        replaceTitle: function (text, thenDo, thenDoArg) {
            splash._replaceText($("#splashInfoTitle"), text, thenDo, thenDoArg);
        },

        replaceBody: function (text, thenDo, thenDoArg) {
            splash._replaceText($("#splashInfoBody"), text, thenDo, thenDoArg);
        },

        replacePrompt: function (text, thenDo, thenDoArg) {
            splash._replaceText($("#splashInfoPrompt"), text, thenDo, thenDoArg);
        },

        showActions: function () {
            $("#splashInfoActions").fadeIn();
        },

        getActionsContainer: function () {
            return $("#splashInfoActions")[0];
        },

        //------------------------------------------------------------------------------------------------------------//

        _replaceText: function (item, text, thenDo, thenDoArg) {
            item.fadeOut("fast", function () {
                if (text) {
                    item[0].innerHTML = text;
                    item.fadeIn(function () {
                        thenDo && thenDo(thenDoArg);
                    });
                } else {
                    thenDo && thenDo(thenDoArg);
                }
            });
        }

        //------------------------------------------------------------------------------------------------------------//
    };
    return splash;
});
