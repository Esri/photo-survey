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
define(['lib/i18n.min!nls/resources.js', 'diag'],
    function (i18n, diag) {
    'use strict';
    var content = {
        _overviewMap: null,
        _overviewMapVisible: false,

        //------------------------------------------------------------------------------------------------------------//

        init: function (prepareAppConfigInfo) {
            var _this = this, contentPanelReady = $.Deferred();

            // When the DOM is ready, we can start adjusting the UI
            $().ready(function () {
                // Instantiate the content template
                $("body").loadTemplate("js/app/content.html", {
                }, {
                    prepend: true,
                    complete: function () {

                        // Don't need help button if there's no help to display
                        if (!prepareAppConfigInfo.appParams.helpText || prepareAppConfigInfo.appParams.helpText.length === 0) {
                            $("#helpButton").css("display", "none");
                        } else {
                            $("#helpButton")[0].title = i18n.tooltips.button_additionalInfo;
                            /*$("#helpTitle")[0].innerHTML = prepareAppConfigInfo.appParams.title;
                            $("#helpBody")[0].innerHTML = prepareAppConfigInfo.appParams.helpText;*/
                        }

                        // Create overview map if desired
                        if (prepareAppConfigInfo.appParams.includeOverviewMap) {
                            // Prepare overview map and set its initial visibility
                            content._overviewMap = L.map('overviewMap', {
                                scrollWheelZoom: "center",
                                doubleClickZoom: "center"
                            });
                            L.esri.basemapLayer(prepareAppConfigInfo.appParams.overviewMapBasemap).addTo(content._overviewMap);

                            content._showOverviewMap(prepareAppConfigInfo.appParams.overviewMapInitiallyOpen);

                            // Show the container for the show & hide icons, which is outside of the overview map's frame,
                            // and enable the icons
                            $("#showHideOverview").css("visibility", "visible");

                            $('#showOverview').on('click', function () {
                                content._showOverviewMap(true);
                            });

                            $('#hideOverview').on('click', function () {
                                content._showOverviewMap(false);
                            });
                        }

                        // i18n updates
                        $("#previousImageBtn")[0].title = i18n.tooltips.button_previous_image;
                        $("#nextImageBtn")[0].title = i18n.tooltips.button_next_image;

                        $("#skipBtn")[0].innerHTML = i18n.tooltips.button_skip;
                        $("#submitBtn")[0].innerHTML = i18n.tooltips.button_submit;

                        $("#userProfileSelectionText")[0].innerHTML = i18n.labels.menuItem_profile;
                        $("#userSignoutSelectionText")[0].innerHTML = i18n.labels.menuItem_signout;

                        /*$("#modalCloseBtn1")[0].title = i18n.tooltips.button_close;
                        $("#modalCloseBtn2")[0].title = i18n.tooltips.button_close;
                        $("#modalCloseBtn2")[0].innerHTML = i18n.labels.button_close;*/

                        $("#surveysCompleted")[0].innerHTML = i18n.labels.label_surveys_completed;
                        $("#closeProfileBtn")[0].innerHTML = i18n.labels.button_returnToSurvey;

                        // Enable the carousel swipe for mobile
                        $('.carousel').bcSwipe({
                            threshold: 50
                        });

                        // Provide the i18n strings to the survey
                        survey.flag_important_question = i18n.tooltips.flag_important_question;



                        contentPanelReady.resolve();
                    }
                });
            });

            return contentPanelReady;
        },

        show: function (makeVisible, thenDo) {
            if (makeVisible) {
                $("#contentPage").fadeIn("fast", function () {
                    thenDo && thenDo();
                });
            } else {
                $("#contentPage").fadeOut("fast", function () {
                    thenDo && thenDo();
                });
            }
        },

        //------------------------------------------------------------------------------------------------------------//

        _showOverviewMap: function (show) {
            content._overviewMapVisible = show;
            $("#overviewMap").css("visibility", show ? "visible" : "hidden");
            content._updateIconToggle(show, 'hideOverview', 'showOverview');
        },

        _updateIconToggle: function (state, onIconId, offIconId) {
            content._showIcon(onIconId, state);
            content._showIcon(offIconId, !state);
        },

        _showIcon: function (iconId, makeVisible) {
            document.getElementById(iconId).style.display = makeVisible
                ? 'block'
                : 'none';
        }

        //------------------------------------------------------------------------------------------------------------//
    };
    return content;
});
