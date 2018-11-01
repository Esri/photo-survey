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
//============================================================================================================================//
define(['lib/i18n.min!nls/resources.js', 'prepareAppConfigInfo', 'handleUserSignin', 'dataAccess', 'survey', 'diag'],
        function (i18n, prepareAppConfigInfo, handleUserSignin, dataAccess, survey, diag) {
    'use strict';
    var main, unsupported = false, needProxy = false, proxyReady;

    //------------------------------------------------------------------------------------------------------------------------//
    // Functions

    main = {
        numPhotos: 0,
        iVisiblePhoto: 0,
        photoSelected: false,
        iSelectedPhoto: -1,
        candidate: null,
        signedIn: false,
        completions: 0,
        overviewMap: null,
        overviewMapVisible: false,


        showIcon: function (iconId, makeVisible) {
            document.getElementById(iconId).style.display = makeVisible
                ? 'block'
                : 'none';
        },

        updateIconToggle: function (state, onIconId, offIconId) {
            main.showIcon(onIconId, state);
            main.showIcon(offIconId, !state);
        },

        showOverviewMap: function (show) {
            main.overviewMapVisible = show;
            $("#overviewMap").css("visibility", show ? "visible" : "hidden");
            main.updateIconToggle(show, 'hideOverview', 'showOverview');
        },

        completeSetup: function () {
            var socialMediaReady, avatar;

            if (prepareAppConfigInfo.appParams.diag !== undefined) {
                diag.init();
            }

            // Update the page's title
            document.title = prepareAppConfigInfo.appParams.title;
            $("#page-title")[0].innerHTML = prepareAppConfigInfo.appParams.title;

            // If a proxy is needed, launch the test for a usable proxy
            proxyReady = $.Deferred();
            if (needProxy) {
                $.getJSON(prepareAppConfigInfo.appParams.proxyProgram + "?ping", function () {
                    proxyReady.resolve();
                }).fail(function () {
                    proxyReady.reject();
                });
            } else {
                prepareAppConfigInfo.appParams.proxyProgram = null;
                proxyReady.resolve();
            }

            // Start up the social media connections
            socialMediaReady = handleUserSignin.init(prepareAppConfigInfo.appParams, function (notificationType) {
                // Callback from current social medium
                switch (notificationType) {
                case handleUserSignin.notificationSignIn:
                    if (!main.signedIn) {
                        main.signedIn = true;
                        $(document).triggerHandler('signedIn:user');
                    }
                    break;
                case handleUserSignin.notificationSignOut:
                    if (main.signedIn) {
                        main.signedIn = false;
                        $("#contentPage").fadeOut("fast");
                        $("#signinPage").fadeIn();
                        $(document).triggerHandler('hide:profile');
                        $("#profileAvatar").css("display", "none");
                    }
                    break;
                case handleUserSignin.notificationAvatarUpdate:
                    avatar = handleUserSignin.getUser().avatar;
                    if (avatar) {
                        $("#profileAvatar").css("backgroundImage", "url(" + avatar + ")");
                        $("#profileAvatar").fadeIn("fast");
                    } else {
                        $("#profileAvatar").css("display", "none");
                    }
                    break;
                }
            });

            // When the DOM is ready, we can start adjusting the UI
            $().ready(function () {

                // Populate the splash UI
                $("#signinTitle")[0].innerHTML = prepareAppConfigInfo.appParams.title;
                $("#signinParagraph")[0].innerHTML = prepareAppConfigInfo.appParams.splashText;

                // If we're not going to wait for the webmap's original image, just set the splash
                if (prepareAppConfigInfo.appParams.useWebmapOrigImg) {
                    prepareAppConfigInfo.webmapOrigImageUrlReady.then(function (url) {
                        if (url) {
                            prepareAppConfigInfo.appParams.splashBackgroundUrl = url;
                        }
                        $("#signinPageBkgd").css("background-image", "url(" + prepareAppConfigInfo.appParams.splashBackgroundUrl + ")").fadeIn(2000);
                    });
                } else {
                    $("#signinPageBkgd").css("background-image", "url(" + prepareAppConfigInfo.appParams.splashBackgroundUrl + ")").fadeIn(2000);
                }

                // Show the splash UI
                $("#signinBlock").fadeIn();

                // If unsupported browser, tell the user and depart
                if (unsupported) {
                    $("#signinLoginPrompt")[0].innerHTML = i18n.signin.unsupported;
                    $("#signinLoginPrompt").fadeIn();
                    return;
                }

                // If checking for proxy, add "checking" message
                if (needProxy) {
                    $("#signinLoginPrompt")[0].innerHTML = i18n.signin.checkingServer;
                    $("#signinLoginPrompt").fadeIn();
                }

                // Wait for the proxy check; already bypassed for browsers that don't need it
                proxyReady.done(function () {

                    // When the feature service and survey are ready, we can set up the module that reads from and writes to the service
                    prepareAppConfigInfo.surveyReady.done(function () {
                        
                        //Test if the user has set a filter on the candidates feature service layer and update the validCondition parameter to query candidates accordingly
                        var validCondition;
                        if (prepareAppConfigInfo.filterDefinition){
                            validCondition = "(" + prepareAppConfigInfo.appParams.surveyorNameField + "+is+null+or+"
                            + prepareAppConfigInfo.appParams.surveyorNameField + "='') " + "and " + prepareAppConfigInfo.filterDefinition;
                        }
                        else{
                            validCondition = prepareAppConfigInfo.appParams.surveyorNameField + "+is+null+or+"
                            + prepareAppConfigInfo.appParams.surveyorNameField + "=''";
                        }

                        dataAccess.init(prepareAppConfigInfo.featureSvcParams.url, prepareAppConfigInfo.featureSvcParams.id,
                                prepareAppConfigInfo.featureSvcParams.objectIdField, validCondition, prepareAppConfigInfo.appParams.proxyProgram);

                        // Test if there are any surveys remaining to be done
                        dataAccess.getObjectCount().done(function (countRemaining) {
                            if (countRemaining > 0) {
                                // When the social media connections are ready, we can enable the social-media sign-in buttons
                                $("#signinLoginPrompt")[0].innerHTML = i18n.signin.signinFetching;
                                $("#signinLoginPrompt").fadeIn();
                                socialMediaReady.then(function () {
                                    // Add the sign-in buttons
                                    handleUserSignin.initUI($("#socialMediaButtonArea")[0]);

                                    // Switch to the sign-in prompt
                                    $("#signinLoginPrompt").fadeOut("fast", function () {
                                        $("#signinLoginPrompt")[0].innerHTML = i18n.signin.signinLoginPrompt;
                                        $("#signinLoginPrompt").fadeIn("fast");
                                        $("#socialMediaButtonArea").fadeIn("fast");
                                    });
                                }, function () {
                                    // Switch to the no-surveys message
                                    $("#signinLoginPrompt").fadeOut("fast", function () {
                                        $("#signinLoginPrompt")[0].innerHTML = i18n.signin.noMoreSurveys;
                                        $("#signinLoginPrompt").fadeIn("fast");
                                    });
                                });
                            } else {
                                $("#signinLoginPrompt")[0].innerHTML = i18n.signin.noMoreSurveys;
                                $("#signinLoginPrompt").fadeIn();
                            }
                        }).fail(function () {
                            $("#signinLoginPrompt")[0].innerHTML = i18n.signin.noMoreSurveys;
                            $("#signinLoginPrompt").fadeIn();
                        });
                    }).fail(function () {
                        $("#signinLoginPrompt")[0].innerHTML = i18n.signin.noMoreSurveys;
                        $("#signinLoginPrompt").fadeIn();
                    });

                    // Don't need help button if there's no help to display
                    if (!prepareAppConfigInfo.appParams.helpText || prepareAppConfigInfo.appParams.helpText.length === 0) {
                        $("#helpButton").css("display", "none");
                    } else {
                        $("#helpButton")[0].title = i18n.tooltips.button_additionalInfo;
                        $("#helpTitle")[0].innerHTML = prepareAppConfigInfo.appParams.title;
                        $("#helpBody")[0].innerHTML = prepareAppConfigInfo.appParams.helpText;
                    }

                }).fail(function () {
                    // If proxy not available, tell the user
                    $("#signinLoginPrompt").fadeOut("fast", function () {
                        $("#signinLoginPrompt")[0].innerHTML = i18n.signin.needProxy;
                        $("#signinLoginPrompt").fadeIn("fast");
                    });
                });

                // Create overview map if desired
                if (prepareAppConfigInfo.appParams.includeOverviewMap) {
                    // Prepare overview map and set its initial visibility
                    main.overviewMap = L.map('overviewMap', {
                        scrollWheelZoom: "center",
                        doubleClickZoom: "center"
                    });
                    L.esri.basemapLayer(prepareAppConfigInfo.appParams.overviewMapBasemap).addTo(main.overviewMap);

                    main.showOverviewMap(prepareAppConfigInfo.appParams.overviewMapInitiallyOpen);

                    // Show the container for the show & hide icons, which is outside of the overview map's frame,
                    // and enable the icons
                    $("#showHideOverview").css("visibility", "visible");

                    $('#showOverview').on('click', function () {
                        main.showOverviewMap(true);
                    });

                    $('#hideOverview').on('click', function () {
                        main.showOverviewMap(false);
                    });
                }

                // Create skip button if specified in config
                if(prepareAppConfigInfo.appParams.showSkip){

                    // Check if config file skipButtonText is not empty or null
                    if(prepareAppConfigInfo.appParams.skipButtonText){
                        $("#skipBtn")[0].innerHTML = prepareAppConfigInfo.appParams.skipButtonText;
                    }
                    else{
                        $("#skipBtn")[0].innerHTML = i18n.tooltips.button_skip;
                    }
                }
                else{
                    $("#skipBtn").css("visibility", "hidden");
                }    


                // i18n updates
                $("#previousImageBtn")[0].title = i18n.tooltips.button_previous_image;
                $("#nextImageBtn")[0].title = i18n.tooltips.button_next_image;

                $("#submitBtn")[0].innerHTML = i18n.tooltips.button_submit;

                $("#userProfileSelectionText")[0].innerHTML = i18n.labels.menuItem_profile;
                $("#userSignoutSelectionText")[0].innerHTML = i18n.labels.menuItem_signout;

                $("#modalCloseBtn1")[0].title = i18n.tooltips.button_close;
                $("#modalCloseBtn2")[0].title = i18n.tooltips.button_close;
                $("#modalCloseBtn2")[0].innerHTML = i18n.labels.button_close;

                $("#surveysCompleted")[0].innerHTML = i18n.labels.label_surveys_completed;
                $("#closeProfileBtn")[0].innerHTML = i18n.labels.button_returnToSurvey;

            });
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
                main.updateIconToggle(main.photoSelected, 'filledHeart', 'emptyHeart');
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
    };

    //------------------------------------------------------------------------------------------------------------------------//
    // Startup

    // Check for obsolete IE
    if ($("body").hasClass("unsupportedIE")) {
        unsupported = true;
    } else if ($("body").hasClass("IE9")) {
        needProxy = true;
    }

    // Bring the app to visibility
    $("#signinPage").fadeIn();

    // Enable the carousel swipe for mobile
    $('.carousel').bcSwipe({
        threshold: 50
    });

    // Get app, webmap, feature service
    prepareAppConfigInfo.init();

    // When we have the app parameters, we can continue setting up the app
    prepareAppConfigInfo.parametersReady.then(main.completeSetup);

    // Provide the i18n strings to the survey
    survey.flag_important_question = i18n.tooltips.flag_important_question;
    survey.error_text = i18n.messages.error_text;
    survey.domain_error_text = i18n.messages.domain_error_text;



    //------------------------------------------------------------------------------------------------------------------------//
    // Wire up app events

    // Using colons for custom event names as recommended by https://learn.jquery.com/events/introduction-to-custom-events/#naming-custom-events
    $(document).on('signedIn:user', function () {
        prepareAppConfigInfo.surveyReady.then(function () {
            var user = handleUserSignin.getUser();

            // Make sure that the main content is available
            main.showMainContent();

            // Heading on survey/profile page
            $("#name")[0].innerHTML = user.name;
            $("#name2")[0].innerHTML = user.name;

            dataAccess.getObjectCount(prepareAppConfigInfo.appParams.surveyorNameField + "='" + user.name + "'").then(function (count) {
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
        handleUserSignin.signOut();
    });

    $(document).on('show:noSurveys', function () {
        // No more surveys available either due to error or completion
        // Hide the main content
        main.hideMainContent();

        // Show the profile view & help window
        $(document).triggerHandler('show:profile');
        $('#additionalInfoPanel').modal('show');
    });

    $(document).on('show:newSurvey', function () {
        var isReadOnly = !(prepareAppConfigInfo.featureSvcParams.canBeUpdated && handleUserSignin.getUser().canSubmit);

        // Provide some visual feedback for the switch to a new survey
        $("#submitBtn").fadeTo(100, 0.0).blur();
        $("#skipBtn").fadeTo(100, 0.0).blur();
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
                $("#skipBtn").fadeTo(1000, 1.0);
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

    $(document).on("click", ".prime", function(){
        survey.updateForm($(this).val(), $(this).data("id"), prepareAppConfigInfo.survey);
    });

    $(document).on("change", ".primeD", function(){
        survey.updateForm($(this).val(), $(this).data("id"), prepareAppConfigInfo.survey);
    });

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
            main.candidate.obj.attributes[prepareAppConfigInfo.appParams.surveyorNameField] = handleUserSignin.getUser().name;
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

    return main;
});
