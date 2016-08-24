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
define(["lib/i18n.min!nls/resources.js", "app/survey", "app/message", "app/diag"],
    function (i18n, survey, message, diag) {
    "use strict";
    var surveyController = {
        _prepareAppConfigInfo: null,
        _dataAccess: null,
        _splash: null,
        _currentUser: {
            name: "",
            id: "",
            canSubmit: false
        },
        _completions: 0,
        _currentCandidate: null,

        //------------------------------------------------------------------------------------------------------------//

        init: function (prepareAppConfigInfo, dataAccess, container) {
            var surveyControllerReady = $.Deferred();
            surveyController._prepareAppConfigInfo = prepareAppConfigInfo;
            surveyController._dataAccess = dataAccess;

            // Provide the i18n strings to the survey
            survey.flag_important_question = i18n.tooltips.flag_important_question;

            // Instantiate the surveyController template
            container.loadTemplate("js/app/surveyController.html", {
            }, {
                prepend: true,
                complete: function () {

                    // Don't need help button if there's no help to display
                    if (!surveyController._prepareAppConfigInfo.appParams.helpText ||
                        surveyController._prepareAppConfigInfo.appParams.helpText.length === 0) {
                        $("#helpButton").css("display", "none");
                    } else {
                        $("#helpButton")[0].title = i18n.tooltips.button_additionalInfo;
                        $("#helpTitle")[0].innerHTML = surveyController._prepareAppConfigInfo.appParams.title;
                        $("#helpBody")[0].innerHTML = surveyController._prepareAppConfigInfo.appParams.helpText;
                    }

                    // i18n-ize content
                    $("#closeProfileBtn")[0].innerHTML = i18n.labels.button_returnToSurvey;
                    $("#skipBtn")[0].innerHTML = i18n.tooltips.button_skip;
                    $("#submitBtn")[0].innerHTML = i18n.tooltips.button_submit;
                    $("#surveysCompleted")[0].innerHTML = i18n.labels.label_surveys_completed;
                    $("#userProfileSelectionText")[0].innerHTML = i18n.labels.menuItem_profile;
                    $("#userSignoutSelectionText")[0].innerHTML = i18n.labels.menuItem_signout;

                    // Wire up app
                    $.subscribe("signedIn:user", function (ignore, loginInfo) {
                        surveyController._updateUser(loginInfo);
                    });

                    $("#userSignoutSelection").on("click", function () {
                        surveyController._dataAccess.resetExclusionList();
                        surveyController._updateUser({
                            name: "",
                            id: "",
                            canSubmit: false
                        });
                        $.publish("request:signOut");
                    });

                    $("#submitBtn").on("click", function () {
                        surveyController._hideSurvey();
                        surveyController._submitSurvey();
                        $.publish("request:newSurvey");
                    });

                    $("#userProfileSelection").on("click", function () {
                        $.publish("show:profile");
                    });

                    $("#closeProfileBtn").on("click", function () {
                        $.publish("hide:profile");
                    });

                    $("#skipBtn").on("click", function () {
                        surveyController._hideSurvey();
                        if (surveyController._currentCandidate !== null) {
                            surveyController._dataAccess.addItemToExclusionList(surveyController._currentCandidate.id);
                        }
                        $.publish("request:newSurvey");
                    });

                    $.subscribe("show:newSurvey", surveyController._showNewSurvey);

                    $.subscribe("show:noSurveys", function () {
                        // Show the profile view & help window
                        $("#profileActionBar").css("display", "none");
                        $.publish("show:profile");
                        message.showMessage(i18n.signin.noMoreSurveys,
                            surveyController._prepareAppConfigInfo.appParams.title)
                    });

                    $.subscribe("show:profile", function () {
                        $("#survey").fadeOut("fast", function () {
                            $("#profile").fadeIn("fast");
                        });
                    });

                    $.subscribe("hide:profile", function () {
                        $("#profile").fadeOut("fast", function () {
                            $("#survey").fadeIn("fast");
                        });
                    });

                    // Done with setup
                    surveyControllerReady.resolve();
                }
            });

            return surveyControllerReady;
        },

        //------------------------------------------------------------------------------------------------------------//

        _hideSurvey: function () {
            $("#skipBtn").fadeTo(100, 0.0).blur();
            $("#submitBtn").fadeTo(100, 0.0).blur();
            $("#surveyContainer").fadeTo(100, 0.0);
        },

        _showSurvey: function (isReadOnly) {
            $("#surveyContainer").fadeTo(500, (isReadOnly
                ? 0.75
                : 1.0));
            $("#skipBtn").fadeTo(500, 1.0);
            if (!isReadOnly) {
                $("#submitBtn").fadeTo(500, 1.0);
            }
        },

        _submitSurvey: function () {

        },

        _showNewSurvey: function (ignore, candidate) {
            // id:num
            // obj:feature{}
            // numPhotos:num
            // attachments:[{id,url},...]
            surveyController._currentCandidate = candidate;

            var isReadOnly = !(surveyController._prepareAppConfigInfo.featureSvcParams.canBeUpdated &&
                surveyController._currentUser.canSubmit);


            // Create survey
            survey.createNewForm($("#surveyContainer")[0], surveyController._prepareAppConfigInfo.survey, isReadOnly);

            // Continue the visual feedback for the switch to a new survey
            surveyController._showSurvey(isReadOnly);
        },

        _updateUser: function (loginInfo) {
            surveyController._currentUser = loginInfo;

            // Heading on survey/profile page
            $("#name")[0].innerHTML = loginInfo.name;
            $("#name2")[0].innerHTML = loginInfo.name;

            if (loginInfo.name) {
                surveyController._dataAccess.getObjectCount(
                    surveyController._prepareAppConfigInfo.appParams.surveyorNameField + "='" +
                    loginInfo.name + "'").then(function (count) {
                    if (count >= 0) {
                        surveyController._completions = count;
                        surveyController._updateCount();
                    } else {
                        $("#profileCount").css("display", "none");
                        $("#ranking").css("display", "none");
                    }

                }, function () {
                    $("#profileCount").css("display", "none");
                    $("#ranking").css("display", "none");
                });
            }
        },

        _updateCount: function () {
            $("#score")[0].innerHTML = surveyController._completions;
            $("#score2")[0].innerHTML = surveyController._completions;
            $("#profileCount").fadeIn();

            if (surveyController._prepareAppConfigInfo.appParams.contribLevels.length > 0) {
                // Find the user's level
                var level = surveyController._prepareAppConfigInfo.appParams.contribLevels.length - 1;
                var surveysForNextLevel = -1;
                while (surveyController._prepareAppConfigInfo.appParams.contribLevels[level].minimumSurveysNeeded >
                    surveyController._completions) {
                    surveysForNextLevel =
                        surveyController._prepareAppConfigInfo.appParams.contribLevels[level].minimumSurveysNeeded;
                    level -= 1;
                }

                // Show ranking via text and stars
                $("#rankLabel")[0].innerHTML =
                    surveyController._prepareAppConfigInfo.appParams.contribLevels[level].label;
                $("#level")[0].innerHTML = i18n.labels.label_level.replace("${0}", level);
                if (level === 0) {
                    $("div", ".profileRankStars").removeClass("filled-star").addClass("empty-star");
                } else {
                    var stars = $("div:eq(" + (level - 1) + ")", ".profileRankStars");
                    stars.prevAll().andSelf().removeClass("empty-star").addClass("filled-star");
                    stars.nextAll().removeClass("filled-star").addClass("empty-star");
                }

                // If below top level, show how far to next level
                var doneThisLevel = surveyController._completions -
                    surveyController._prepareAppConfigInfo.appParams.contribLevels[level].minimumSurveysNeeded;
                var remainingToNextLevel = Math.max(0, surveysForNextLevel - surveyController._completions);
                var surveysThisLevel = doneThisLevel + remainingToNextLevel;
                if (surveysForNextLevel >= 0 && surveysThisLevel > 0) {
                    var cRankBarWidthPx = 170;
                    $("#profileRankBarFill")[0].style.width =
                        (cRankBarWidthPx * doneThisLevel / surveysThisLevel) + "px";
                    $("#profileRankBar").css("display", "block");

                    $("#remainingToNextLevel")[0].innerHTML =
                            i18n.labels.label_remaining_surveys.replace("${0}", remainingToNextLevel);
                } else {
                    $("#remainingToNextLevel")[0].innerHTML = "";
                    $("#profileRankBar").css("display", "none");
                }

                $("#ranking").fadeIn();
            } else {
                $("#ranking").css("display", "none");
            }
        }

        //------------------------------------------------------------------------------------------------------------//
    };
    return surveyController;
});
