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
define(["lib/i18n.min!nls/resources.js", "app/dataAccess", "app/visualsController3d", "app/surveyController3d", "app/diag"],
    function (i18n, dataAccess, visualsController, surveyController, diag) {
    "use strict";
    var content = {
        _prepareAppConfigInfo: null,
        _splash: null,

        //------------------------------------------------------------------------------------------------------------//

        init: function (prepareAppConfigInfo, splash) {
            var contentPanelReady = $.Deferred();
            content._prepareAppConfigInfo = prepareAppConfigInfo;
            content._splash = splash;

            // Instantiate the content template
            $("body").loadTemplate("js/app/content.html", {
            }, {
                prepend: true,
                complete: function () {
                    // When the feature service and survey are ready, we can set up the module that reads from and writes to the service
                    content._prepareAppConfigInfo.surveyReady.then(function () {
                        dataAccess.init(content._prepareAppConfigInfo.featureSvcParams.url,
                            content._prepareAppConfigInfo.featureSvcParams.id,
                            content._prepareAppConfigInfo.featureSvcParams.objectIdField,
                            content._prepareAppConfigInfo.appParams.surveyorNameField + "+is+null+or+"
                            + content._prepareAppConfigInfo.appParams.surveyorNameField + "=''",
                            content._prepareAppConfigInfo.appParams.proxyProgram);

                        // Test if there are any surveys remaining to be done
                        splash.replacePrompt(i18n.signin.lookingForSurveys);
                        dataAccess.getObjectCount().then(function (countRemaining) {
                            if (countRemaining > 0) {
                                contentPanelReady.resolve();
                            } else {
                                splash.replacePrompt(i18n.signin.noMoreSurveys);
                                contentPanelReady.reject();
                            }
                        }, function (error) {
                            console.log(JSON.stringify(error));
                            splash.replacePrompt(i18n.signin.noMoreSurveys);
                            contentPanelReady.reject();
                        });
                    }, function (error) {
                        console.log(JSON.stringify(error));
                        splash.replacePrompt(i18n.signin.noMoreSurveys);
                        contentPanelReady.reject();
                    });
                }
            });

            return contentPanelReady;
        },

        launch: function () {
            var contentComponentsReady = $.Deferred();

            var visualsCtrlr = visualsController.init(content._prepareAppConfigInfo, dataAccess, $("#mainContent"));
            var surveyCtrlr = surveyController.init(content._prepareAppConfigInfo, dataAccess, $("#sidebarContent"));

            $.when(visualsCtrlr, surveyCtrlr).then(function () {

                // Wire up buttons and menu choices
                $.subscribe("signedIn:user", function () {
                    $.publish("request:newSurvey");
                });

                $.subscribe("request:newSurvey", function () {

                    // Get candidate
                    dataAccess.getCandidate(
                        content._prepareAppConfigInfo.appParams.randomizeSelection).then(function (candidate) {
                        // id:num
                        // obj:feature{}
                        // attachments:[{id,url},...]

                        // Do we have a valid candidate?
                        if (!candidate.obj) {
                            $.publish("show:noSurveys");
                            return;
                        }

                        // Is this candidate usable?
                        var numPhotos = candidate.attachments ? candidate.attachments.length : 0;
                        if (numPhotos === 0) {
                            diag.appendWithLF("no photos for property <i>"
                                + JSON.stringify(candidate.obj.attributes) + "</i>");  //???
                            candidate.obj.attributes[content._prepareAppConfigInfo.appParams.surveyorNameField] =
                                "no photos";
                            dataAccess.updateCandidate(candidate);
                            $.publish("request:newSurvey");
                            return;
                        }
                        diag.appendWithLF("showing property <i>"
                            + JSON.stringify(candidate.obj.attributes) + "</i> with "  //???
                            + numPhotos + " photos");  //???

                        candidate.numPhotos = numPhotos;
                        $.publish("show:newSurvey", candidate);

                    }, function () {
                        $.publish("show:noSurveys");
                    });
                });

                // Done with setup
                contentComponentsReady.resolve();
            });

            return contentComponentsReady;
        },

        show: function (makeVisible, thenDo, thenDoArg) {
            if (makeVisible) {
                $("#contentPage").fadeIn("fast", function () {
                    thenDo && thenDo(thenDoArg);
                });
            } else {
                $("#contentPage").fadeOut("fast", function () {
                    thenDo && thenDo(thenDoArg);
                });
            }
        }

        //------------------------------------------------------------------------------------------------------------//
    };
    return content;
});
