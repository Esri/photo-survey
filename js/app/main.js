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
define(['lib/i18n.min!nls/resources.js', 'prepareAppConfigInfo', 'dataAccess', 'splash', 'message', 'proxy', 'user', 'content', 'survey', 'diag'],
    function (i18n, prepareAppConfigInfo, dataAccess, splash, message, proxy, user, content, survey, diag) {
    'use strict';
    var main = {
        _currentUser: {
            name: "",
            id: "",
            canSubmit: false
        },

        //------------------------------------------------------------------------------------------------------------//

        init: function () {
            // Get app, webmap, feature service; when we have the app parameters, we can continue setting up the app
            prepareAppConfigInfo.init().parametersReady.then(main.completeSetup);
        },

        completeSetup: function () {
            document.title = prepareAppConfigInfo.appParams.title;
            if (prepareAppConfigInfo.appParams.diag !== undefined) {
                diag.init();
            }

            // Start some async inits
            var splashInfoPanelReady = splash.init(prepareAppConfigInfo);
            var proxyReady = proxy.test(prepareAppConfigInfo);

            // Display the splash screen and, if there are any surveys remaining to be done, the sign-in UI
            splashInfoPanelReady.then(function () {
                proxyReady.then(function () {

                    // When the feature service and survey are ready, we can set up the module that reads from and writes to the service
                    prepareAppConfigInfo.surveyReady.then(function () {
                        dataAccess.init(prepareAppConfigInfo.featureSvcParams.url, prepareAppConfigInfo.featureSvcParams.id,
                                prepareAppConfigInfo.featureSvcParams.objectIdField,
                                prepareAppConfigInfo.appParams.surveyorNameField + "+is+null+or+"
                                + prepareAppConfigInfo.appParams.surveyorNameField + "=''", prepareAppConfigInfo.appParams.proxyProgram);

                        // Test if there are any surveys remaining to be done
                        splash.replacePrompt(i18n.signin.lookingForSurveys);
                        dataAccess.getObjectCount().then(function (countRemaining) {
                            if (countRemaining > 0) {
                                console.log(countRemaining + " surveys are available");
                                main._setupSignin();
                            } else {
                                splash.replacePrompt(i18n.signin.noMoreSurveys);
                            }
                        }, function (error) {
                            console.log(JSON.stringify(error));
                            splash.replacePrompt(i18n.signin.noMoreSurveys);
                        });
                    }, function (error) {
                        console.log(JSON.stringify(error));
                        splash.replacePrompt(i18n.signin.noMoreSurveys);
                    });

                }, function (error) {
                    // If unsupported browser or proxy problem, tell the user and proceed no further
                    if (error === "Unsupported browser") {
                        splash.replacePrompt(i18n.signin.unsupported);
                    } else {
                        splash.replacePrompt(i18n.signin.needProxy);
                    }
                });
            });

            // Build the content while the splash and sign-in are going on
            var contentPanelReady = content.init(prepareAppConfigInfo);
            var messagePanelReady = message.init();

            //--------------------------------------------------------------------------------------------------------//
            // Wire up app events

            // Using colons for custom event names as recommended by https://learn.jquery.com/events/introduction-to-custom-events/#naming-custom-events
            $.subscribe('signedIn:user', function (ignore, loginInfo) {
                console.log("signedIn:user " + JSON.stringify(loginInfo));
               main._currentUser = loginInfo;

                // Show the content
                splash.show(false, function () {
                    content.show(true);
                });

                prepareAppConfigInfo.surveyReady.then(function () {

                    // Heading on survey/profile page
                    $("#name")[0].innerHTML = loginInfo.name;
                    $("#name2")[0].innerHTML = loginInfo.name;

                    dataAccess.getObjectCount(prepareAppConfigInfo.appParams.surveyorNameField + "='" + loginInfo.name + "'").then(function (count) {
                        if (count >= 0) {
                            main.completions = count;
                            main.updateCount();
                        } else {
                            $("#profileCount").css("display", "none");
                            $("#ranking").css("display", "none");
                        }

                    }, function () {
                        $("#profileCount").css("display", "none");
                        $("#ranking").css("display", "none");
                    });

                    $("#hearts").css("display", "none");

                    $("#signinPage").fadeOut();
                });
                prepareAppConfigInfo.surveyReady.then(function () {
                    $(document).triggerHandler('show:newSurvey');
                });
            });

            $(document).on('signedOut:user', function () {
                dataAccess.resetExclusionList();
                content.show(false, function () {
                    user.signout();
                    splash.show(true);
                });
            });

            $(document).on('show:noSurveys', function () {
                // No more surveys available either due to error or completion
                // Hide the main content
                content.show(false, function () {
                    // Show the profile view & help window
                    $(document).triggerHandler('show:profile');
                    //$('#additionalInfoPanel').modal('show');
                });
            });

            $(document).on('show:newSurvey', function () {
                var isReadOnly = !(prepareAppConfigInfo.featureSvcParams.canBeUpdated && main._currentUser.canSubmit);

                // Provide some visual feedback for the switch to a new survey
                $("#submitBtn").fadeTo(100, 0.0).blur();
                $("#surveyContainer").fadeTo(100, 0.0);

                // Get candidate property
                dataAccess.getCandidate(prepareAppConfigInfo.appParams.randomizeSelection).then(function (candidate) {
                    // obj:feature{}
                    // attachments:[{id,url},...]

                    // Do we have a valid candidate?
                    if (!candidate.obj) {
                        $(document).triggerHandler('show:noSurveys');
                        return;
                    }

                    main.numPhotos = candidate.attachments ? candidate.attachments.length : 0;
                    if (main.numPhotos === 0) {
                        diag.appendWithLF("no photos for property <i>" + JSON.stringify(candidate.obj.attributes) + "</i>");  //???
                        candidate.obj.attributes[prepareAppConfigInfo.appParams.surveyorNameField] = "no photos";
                        dataAccess.updateCandidate(candidate);
                        $(document).triggerHandler('show:newSurvey');
                        return;
                    }
                    diag.appendWithLF("showing property <i>" + JSON.stringify(candidate.obj.attributes) + "</i> with "  //???
                            + main.numPhotos + " photos");  //???

                    main.candidate = candidate;
                    main.iSelectedPhoto = -1;

                    if (prepareAppConfigInfo.appParams.includeOverviewMap) {
                        // Jump the overview map to candidate.obj.geometry after transforming to lat/long;
                        // we've asked the server to give us the geometry in lat/long (outSR=4326) for Leaflet
                        main.overviewMap.setView([candidate.obj.geometry.y, candidate.obj.geometry.x],
                            prepareAppConfigInfo.appParams.overviewMapZoom);
                    }

                    // Gallery
                    var carouselSlidesHolder = $("#carouselSlidesHolder")[0];
                    $(carouselSlidesHolder).children().remove();  // remove children and their events
                    var carouselIndicatorsHolder = $("#carouselIndicatorsHolder")[0];
                    $(carouselIndicatorsHolder).children().remove();  // remove children and their events
                    var initiallyActiveItem =
                            Math.floor((main.numPhotos + 1) / 2) - 1;  // len=1,2: idx=0; len=3,4; idx=1; etc. (idx 0-based)

                    var showThumbnails = (prepareAppConfigInfo.appParams.thumbnailLimit < 0) ||
                            (candidate.attachments.length <= prepareAppConfigInfo.appParams.thumbnailLimit);

                    $.each(candidate.attachments, function (indexInArray, attachment) {
                        main.addPhoto(carouselSlidesHolder, indexInArray, (initiallyActiveItem === indexInArray), attachment.url);
                        if (showThumbnails) {
                            main.addPhotoIndicator(carouselIndicatorsHolder, indexInArray, (initiallyActiveItem === indexInArray),
                                    "carousel", attachment.url);
                        }
                    });
                    $("#carousel").trigger('create');

                    main.updatePhotoSelectionDisplay();

                    // Provide some visual feedback for the switch to a new survey
                    $("#surveyContainer").fadeTo(1000, (isReadOnly
                        ? 0.75
                        : 1.0));
                    if (!isReadOnly) {
                        $("#submitBtn").fadeTo(1000, 1.0);
                    }

                }, function () {
                    $(document).triggerHandler('show:noSurveys');
                });

                // Create survey
                survey.createNewForm($("#surveyContainer")[0], prepareAppConfigInfo.survey, isReadOnly);

                // Show the content
                $("#contentPage").fadeIn("fast");
            });

            $(document).on('show:profile', function () {
                $("#survey").fadeOut("fast", function () {
                    $("#profile").fadeIn("fast");
                });
            });
            $(document).on('hide:profile', function () {
                $("#profile").fadeOut("fast", function () {
                    $("#survey").fadeIn("fast");
                });
            });

            contentPanelReady.then(function () {
                $("#userSignoutSelection").on('click', function () {
                    $(document).triggerHandler('signedOut:user');
                });
                $("#userProfileSelection").on('click', function () {
                    $(document).triggerHandler('show:profile');
                });
                $("#closeProfileBtn").on('click', function () {
                    $(document).triggerHandler('hide:profile');
                });
                $("#skipBtn").on('click', function () {
                    $("#skipBtn").blur();
                    dataAccess.addItemToExclusionList(main.candidate.id);
                    $(document).triggerHandler('show:newSurvey');
                });
                $("#submitBtn").on('click', function () {
                    var firstMissing =
                        survey.validateForm($('#surveyContainer'), prepareAppConfigInfo.survey, main.candidate.obj.attributes);

                    // Submit the survey if it has the important responses
                    if (firstMissing === undefined) {
                        main.candidate.obj.attributes[prepareAppConfigInfo.appParams.surveyorNameField] = main._currentUser.name;
                        if (main.iSelectedPhoto >= 0) {
                            main.candidate.obj.attributes[prepareAppConfigInfo.appParams.bestPhotoField] = main.candidate.attachments[main.iSelectedPhoto].id;
                        }
                        diag.appendWithLF("saving survey for property <i>" + JSON.stringify(main.candidate.obj.attributes) + "</i>");  //???
                        dataAccess.updateCandidate(main.candidate).then(function () {
                            main.completions += 1;
                            main.updateCount();

                            $(document).triggerHandler('show:newSurvey');
                        });

                    // Jump to the first missing important question otherwise
                    // From http://stackoverflow.com/a/6677069
                    } else {
                        $("#sidebarContent").animate({
                            scrollTop: firstMissing.offsetTop - 5
                        }, 500);
                    }
                });

                $("#hearts").on('click', function () {
                    main.photoSelected = !main.photoSelected;
                    main.iVisiblePhoto = parseInt($("#carouselSlidesHolder > .item.active")[0].id.substring(1));
                    main.iSelectedPhoto = main.photoSelected
                        ? main.iVisiblePhoto
                        : -1;
                    main.updatePhotoSelectionDisplay();
                });

                // Manage group of buttons in a radio style
                $(".btn-group > .btn").click(function (evt) {
                    $(evt.currentTarget).addClass("active").siblings().removeClass("active");
                });

                $("#carousel").on('slide.bs.carousel', function (data) {
                    // Check if we should slide: swipe jumps right into here
                    if ((main.iVisiblePhoto === 0 && data.direction === "right")
                            || (main.iVisiblePhoto === (main.numPhotos - 1) && data.direction === "left")) {
                        // Block move
                        data.preventDefault();
                    } else {
                        // Otherwise, hide the heart until the next slide appears
                        $("#hearts")[0].style.display = "none";
                    }
                });

                $("#carousel").on('slid.bs.carousel', function () {
                    main.updatePhotoSelectionDisplay();
                });
            });

        },

        //----- User sign-in -----------------------------------------------------------------------------------------//

        _setupSignin: function () {
            var _this = this;

            user.launch(prepareAppConfigInfo, splash);

            $.subscribe("signedOut:user", function () {
                console.log("signed-out");
                $(document).triggerHandler('hide:profile');
                $("#profileAvatar").css("display", "none");
               _this._currentUser = {
                    name: "",
                    id: "",
                    canSubmit: false
                };
            });

            $.subscribe("avatar:update", function (ignore, url) {
                if (url) {
                    $("#profileAvatar").css("backgroundImage", "url(" + url + ")");
                    $("#profileAvatar").fadeIn("fast");
                } else {
                    $("#profileAvatar").css("display", "none");
                }
            });
        },

        //------------------------------------------------------------------------------------------------------------//

        _updateIconToggle: function (state, onIconId, offIconId) {
            content._showIcon(onIconId, state);
            content._showIcon(offIconId, !state);
        },

        updatePhotoSelectionDisplay: function () {
            // After carousel slide
            main.iVisiblePhoto = parseInt($("#carouselSlidesHolder > .item.active")[0].id.substring(1));

            // Update left & right sliders for where we are in the carousel to block wrapping of carousel movement
            $("#leftCarouselCtl").css("display", (main.iVisiblePhoto === 0
                ? "none"
                : "block"));
            $("#rightCarouselCtl").css("display", (main.iVisiblePhoto === (main.numPhotos - 1)
                ? "none"
                : "block"));

            if (prepareAppConfigInfo.appParams.bestPhotoField) {
                // Update selected photo indicator
                main.photoSelected = main.iVisiblePhoto === main.iSelectedPhoto;
                main._updateIconToggle(main.photoSelected, 'filledHeart', 'emptyHeart');
                $("#hearts").attr("title",
                        (main.photoSelected
                    ? i18n.tooltips.button_best_image
                    : i18n.tooltips.button_click_if_best_image));
                $("#hearts")[0].style.display = "block";
            }
        },

        updateCount: function () {
            $("#score")[0].innerHTML = main.completions;
            $("#score2")[0].innerHTML = main.completions;
            $("#profileCount").fadeIn();

            if (prepareAppConfigInfo.appParams.contribLevels.length > 0) {
                // Find the user's level
                var level = prepareAppConfigInfo.appParams.contribLevels.length - 1;
                var surveysForNextLevel = -1;
                while (prepareAppConfigInfo.appParams.contribLevels[level].minimumSurveysNeeded > main.completions) {
                    surveysForNextLevel = prepareAppConfigInfo.appParams.contribLevels[level].minimumSurveysNeeded;
                    level -= 1;
                }

                // Show ranking via text and stars
                $("#rankLabel")[0].innerHTML = prepareAppConfigInfo.appParams.contribLevels[level].label;
                $("#level")[0].innerHTML = i18n.labels.label_level.replace("${0}", level);
                if (level === 0) {
                    $("div", ".profileRankStars").removeClass("filled-star").addClass("empty-star");
                } else {
                    var stars = $("div:eq(" + (level - 1) + ")", ".profileRankStars");
                    stars.prevAll().andSelf().removeClass("empty-star").addClass("filled-star");
                    stars.nextAll().removeClass("filled-star").addClass("empty-star");
                }

                // If below top level, show how far to next level
                var doneThisLevel = main.completions - prepareAppConfigInfo.appParams.contribLevels[level].minimumSurveysNeeded;
                var remainingToNextLevel = Math.max(0, surveysForNextLevel - main.completions);
                var surveysThisLevel = doneThisLevel + remainingToNextLevel;
                if (surveysForNextLevel >= 0 && surveysThisLevel > 0) {
                    var cRankBarWidthPx = 170;
                    $("#profileRankBarFill")[0].style.width = (cRankBarWidthPx * doneThisLevel / surveysThisLevel) + "px";
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
        },

        addPhoto: function (carouselSlidesHolder, indexInArray, isActive, photoUrl) {
            // <div id='carousel0' class='item active'><img src='__test/VIRB0125.JPG' alt='VIRB0125.JPG'></div>
            // var content = "<div id='c" + indexInArray + "' class='item" + (isActive ? " active" : "") +
            //    "'><img src='" + photoUrl + "'></div>";
            // $(carouselSlidesHolder).append(content);

            var content = "<div id='c" + indexInArray + "' class='item" + (isActive
                ? " active"
                : "") + "'><img /></div>";
            $(carouselSlidesHolder).append(content);

            var img = $("#c" + indexInArray + " img")[0];
            img.src = photoUrl;
            $(img).on('error', function () {
                img.src = "images/noPhoto.png";
                $(img).css("margin", "auto");
            });
        },

        addPhotoIndicator: function (carouselIndicatorsHolder, indexInArray, isActive, carouselId, photoUrl) {
            // <li data-target='#myCarousel' data-slide-to='0' class='active'></li>
            var content = "<li id='indicator-" + indexInArray + "' data-target='#" + carouselId + "' data-slide-to='" + indexInArray +
                    "'" + (isActive
                ? " class='active'"
                : "") + "></li>";
            $(carouselIndicatorsHolder).append(content);
            $("#indicator-" + indexInArray).css("background-image", "url(" + photoUrl + ")");
        },

        showMainContent: function () {
            // Show the main content
            $("#mainContent").css("visibility", "visible");

            // Show the profile's action bar
            $("#profileActionBar").css("display", "block");

            // Switch in the help display
            $("#helpBody")[0].innerHTML = prepareAppConfigInfo.appParams.helpText;
        },

        hideMainContent: function () {
            // Hide the main content
            $("#mainContent").css("visibility", "hidden");

            // Hide the profile's action bar
            $("#profileActionBar").css("display", "none");

            // Switch out the help display
            $("#helpBody")[0].innerHTML = i18n.signin.noMoreSurveys;
        },

        testURL: function (url, callback) {
            $.ajax({
                type: 'HEAD',
                url: url,
                success: function () {
                    callback(true);
                },
                error: function () {
                    callback(false);
                }
            });
        }

        //------------------------------------------------------------------------------------------------------------//
    };
    main.init();
});
