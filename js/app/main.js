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
define(['lib/i18n.min!nls/resources.js', 'prepareAppConfigInfo', 'handleUserSignin', 'dataAccess', 'diag'],
    function (i18n, prepareAppConfigInfo, handleUserSignin, dataAccess, diag) {
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


        showHeart: function (heartId, makeVisible) {
            document.getElementById(heartId).style.display = makeVisible ? 'block' : 'none';
        },

        completeSetup: function  () {
            if (prepareAppConfigInfo.appParams.diag !== undefined) {diag.init()};

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
            var socialMediaReady = handleUserSignin.init(prepareAppConfigInfo.appParams, function (notificationType) {
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
                        var avatar = handleUserSignin.getUser().avatar;
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
                    appConfigReadies.webmapOrigImageUrlReady.then(function (url) {
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
                    appConfigReadies.surveyReady.done(function () {
                        dataAccess.init(prepareAppConfigInfo.featureSvcParams.url, prepareAppConfigInfo.featureSvcParams.id,
                            prepareAppConfigInfo.featureSvcParams.objectIdField,
                            prepareAppConfigInfo.appParams.surveyorNameField + "+is+null+or+"
                                + prepareAppConfigInfo.appParams.surveyorNameField + "=''", prepareAppConfigInfo.appParams.proxyProgram);

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
                                }).fail(function () {
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
                    if (prepareAppConfigInfo.appParams.helpText.length === 0) {
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

                // i18n updates
                $("#previousImageBtn")[0].title = i18n.tooltips.button_previous_image;
                $("#nextImageBtn")[0].title = i18n.tooltips.button_next_image;

                $("#skipBtn")[0].innerHTML = i18n.tooltips.button_skip;
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
            $("#leftCarouselCtl").css("display", (main.iVisiblePhoto === 0 ? "none" : "block"));
            $("#rightCarouselCtl").css("display", (main.iVisiblePhoto === (main.numPhotos - 1) ? "none" : "block"));

            if (prepareAppConfigInfo.appParams.bestPhotoField) {
                // Update selected photo indicator
                main.photoSelected = main.iVisiblePhoto === main.iSelectedPhoto;
                main.showHeart('emptyHeart', !main.photoSelected);
                main.showHeart('filledHeart', main.photoSelected);
                $("#hearts").attr("title",
                    (main.photoSelected ? i18n.tooltips.button_best_image : i18n.tooltips.button_click_if_best_image));
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
                    $("div", ".profileRankStars").removeClass("filled-star").addClass("empty-star")
                } else {
                    var stars = $("div:eq(" + (level - 1) + ")", ".profileRankStars");
                    stars.prevAll().andSelf().removeClass("empty-star").addClass("filled-star")
                    stars.nextAll().removeClass("filled-star").addClass("empty-star")
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

        startQuestion: function (surveyContainer, iQuestion, questionInfo) {
            // <div class='form-group'>
            //   <label for='q1'>Is there a structure on the property? <span class='glyphicon glyphicon-star'></span></label><br>
            var start =
                "<div id='qg" + iQuestion + "' class='form-group'>"
                + "<label for='q" + iQuestion + "'>" + questionInfo.question
                + (questionInfo.important ? "&nbsp;<div class='importantQuestion sprites star' title=\""
                + i18n.tooltips.flag_important_question + "\"></div>" : "")
                + "</label><br>";
            return start;
        },

        createButtonChoice: function (surveyContainer, iQuestion, questionInfo, isReadOnly) {
            // <div id='q1' class='btn-group'>
            //   <button type='button' class='btn'>Yes</button>
            //   <button type='button' class='btn'>No</button>
            //   <button type='button' class='btn'>Not sure</button>
            // </div>
            var buttons = "<div id='q" + iQuestion + "' class='btn-group'>";
            var domain = questionInfo.domain.split('|');
            $.each(domain, function (i, choice) {
                buttons += "<button type='button' class='btn' value='" + i + "' " + (isReadOnly ? "disabled" : "") + ">" + choice + "</button>";
            });
            buttons += "</div>";
            return buttons;
        },

        createListChoice: function (surveyContainer, iQuestion, questionInfo, isReadOnly) {
            // <div class='radio'><label><input type='radio' name='q1' id='optionFound1' value='0'>Crawlspace</label></div>
            // <div class='radio'><label><input type='radio' name='q1' id='optionFound2' value='1'>Raised</label></div>
            // <div class='radio'><label><input type='radio' name='q1' id='optionFound3' value='2'>Elevated</label></div>
            // <div class='radio'><label><input type='radio' name='q1' id='optionFound4' value='3'>Slab on grade</label></div>
            // <div class='radio'><label><input type='radio' name='q1' id='optionFound0' value='4'>Not sure</label></div>
            var list = "";
            var domain = questionInfo.domain.split('|');
            $.each(domain, function (i, choice) {
                list += "<div class='radio'><label><input type='radio' name='q" + iQuestion + "' value='" + i + "' " + (isReadOnly ? "disabled" : "") + ">" + choice + "</label></div>";
            });
            return list;
        },

        wrapupQuestion: function (surveyContainer, iQuestion, questionInfo) {
            // </div>
            // <div class='clearfix'></div>
            var wrap = "</div><div class='clearfix'></div>";
            return wrap;
        },

        addQuestion: function (surveyContainer, iQuestion, questionInfo, isReadOnly) {
            var question = main.startQuestion(surveyContainer, iQuestion, questionInfo);
            if (questionInfo.style === "button") {
                question += main.createButtonChoice(surveyContainer, iQuestion, questionInfo, isReadOnly);
            } else {
                question += main.createListChoice(surveyContainer, iQuestion, questionInfo, isReadOnly);
            }
            question += main.wrapupQuestion(surveyContainer, iQuestion, questionInfo);
            $(surveyContainer).append(question);

            // Fix radio-button toggling
            if (questionInfo.style === "button") {
                $('#q' + iQuestion + ' button').click(function() {
                    $(this).addClass('active').siblings().removeClass('active');
                });
            }
        },

        addPhoto: function (carouselSlidesHolder, indexInArray, isActive, photoUrl) {
            // <div id='carousel0' class='item active'><img src='__test/VIRB0125.JPG' alt='VIRB0125.JPG'></div>
            // var content = "<div id='c" + indexInArray + "' class='item" + (isActive ? " active" : "") +
            //    "'><img src='" + photoUrl + "'></div>";
            // $(carouselSlidesHolder).append(content);

            var content = "<div id='c" + indexInArray + "' class='item" + (isActive ? " active" : "") + "'><img /></div>";
            $(carouselSlidesHolder).append(content);

            var img = $("#c" + indexInArray + " img")[0];
            img.src = photoUrl;
            $(img).on('error', function (err) {
                img.src = "images/noPhoto.png";
                $(img).css("margin", "auto");
            });
        },

        addPhotoIndicator: function (carouselIndicatorsHolder, indexInArray, isActive, carouselId, photoUrl) {
            // <li data-target='#myCarousel' data-slide-to='0' class='active'></li>
            var content = "<li id='indicator-" + indexInArray + "' data-target='#" + carouselId + "' data-slide-to='" + indexInArray +
                "'" + (isActive ? " class='active'" : "") + "></li>";
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
            $.ajax( {
                type: 'HEAD',
                url: url,
                success: function() {
                    callback(true);
                },
                error: function() {
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
    $('.carousel').bcSwipe({ threshold: 50 });

    // Get app, webmap, feature service
    var appConfigReadies = prepareAppConfigInfo.init();

    // When we have the app parameters, we can continue setting up the app
    appConfigReadies.parametersReady.then(main.completeSetup);

    //------------------------------------------------------------------------------------------------------------------------//
    // Wire up app events

    // Using colons for custom event names as recommended by https://learn.jquery.com/events/introduction-to-custom-events/#naming-custom-events
    $(document).on('signedIn:user', function (e) {
        appConfigReadies.surveyReady.then(function () {
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

            }).fail(function (error) {
                $("#profileCount").css("display", "none");
                $("#ranking").css("display", "none");
            });

            $("#hearts").css("display", "none");

            $("#signinPage").fadeOut( );
        });
        appConfigReadies.surveyReady.then(function () {
            $(document).triggerHandler('show:newSurvey');
        });
    });

    $(document).on('signedOut:user', function (e) {
        dataAccess.resetExclusionList();
        handleUserSignin.signOut();
    });

    $(document).on('show:noSurveys', function (e) {
        // No more surveys available either due to error or completion
        // Hide the main content
        main.hideMainContent();

        // Show the profile view & help window
        $(document).triggerHandler('show:profile');
        $('#additionalInfoPanel').modal('show');
    });

    $(document).on('show:newSurvey', function (e) {
        var isReadOnly = !(prepareAppConfigInfo.featureSvcParams.canBeUpdated && handleUserSignin.getUser().canSubmit);
        $("#submitBtn")[0].blur();

        // Provide some visual feedback for the switch to a new survey
        $("#surveyContainer").fadeTo(100, 0.0);

        // Get candidate property
        dataAccess.getCandidate(prepareAppConfigInfo.appParams.randomizeSelection).then(function (candidate) {
            // obj:feature{}
            // attachments:[{id,url},...]
            var showThumbnails = (prepareAppConfigInfo.appParams.thumbnailLimit < 0) ||
                (candidate.attachments.length <= prepareAppConfigInfo.appParams.thumbnailLimit);

            main.numPhotos = candidate.attachments.length;
            if (!candidate.obj) {
                $(document).triggerHandler('show:noSurveys');
                return;
            } else if (main.numPhotos === 0) {
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

            // Gallery
            var carouselSlidesHolder = $("#carouselSlidesHolder")[0];
            $(carouselSlidesHolder).children().remove();  // remove children and their events
            var carouselIndicatorsHolder = $("#carouselIndicatorsHolder")[0];
            $(carouselIndicatorsHolder).children().remove();  // remove children and their events
            var initiallyActiveItem =
                Math.floor((main.numPhotos + 1) / 2) - 1;  // len=1,2: idx=0; len=3,4; idx=1; etc. (idx 0-based)

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
            $("#surveyContainer").fadeTo(1000, (isReadOnly ? 0.75 : 1.0));

        }).fail(function (error) {
            $(document).triggerHandler('show:noSurveys');
        });

        // Survey
        var surveyContainer = $("#surveyContainer")[0];
        $(surveyContainer).children().remove();  // remove children and their events
        $.each(prepareAppConfigInfo.survey, function (indexInArray, questionInfo) {
            main.addQuestion(surveyContainer, indexInArray, questionInfo, isReadOnly);
        });
        $(".btn-group").trigger('create');

        // Can submit?
        $("#submitBtn").css("display",
            isReadOnly
            ? "none"
            : "inline-block");

        // Show the content
        $("#contentPage").fadeIn("fast");
    });

    $(document).on('show:profile', function (e) {
        $("#survey").fadeOut("fast", function () {
            $("#profile").fadeIn("fast");
        });
    });
    $(document).on('hide:profile', function (e) {
        $("#profile").fadeOut("fast", function () {
            $("#survey").fadeIn("fast");
        });
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
        dataAccess.addItemToExclusionList(main.candidate.id);
        $(document).triggerHandler('show:newSurvey');
    });
    $("#submitBtn").on('click', function () {
        var surveyContainer, msg, iQuestionResult, hasImportants = true, firstMissing;

        surveyContainer = $('#surveyContainer');
        $.each(prepareAppConfigInfo.survey, function (iQuestion, questionInfo) {
            if (questionInfo.style === "button") {
                iQuestionResult = $('#q' + iQuestion + ' .active', surveyContainer).val();
            } else {
                iQuestionResult = $('input[name=q' + iQuestion + ']:checked', surveyContainer).val();
            }
            if (iQuestionResult) {
                main.candidate.obj.attributes[questionInfo.field] = questionInfo.domain.split("|")[iQuestionResult];
            }

            // Flag missing importants
            if (questionInfo.important) {
                if (iQuestionResult) {
                    $("#qg" + iQuestion).removeClass("flag-error");
                } else {
                    $("#qg" + iQuestion).addClass("flag-error");
                    hasImportants = false;
                    if (firstMissing === undefined) {
                        firstMissing = $("#qg" + iQuestion)[0];
                    }
                }
            }
        });

        // Submit the survey if it has the important responses
        if (hasImportants) {
            main.candidate.obj.attributes[prepareAppConfigInfo.appParams.surveyorNameField] = handleUserSignin.getUser().name;
            if (main.iSelectedPhoto >= 0) {
                main.candidate.obj.attributes[prepareAppConfigInfo.appParams.bestPhotoField] = main.candidate.attachments[main.iSelectedPhoto].id;
            }
            diag.appendWithLF("saving survey for property <i>" + JSON.stringify(main.candidate.obj.attributes) + "</i>");  //???
            dataAccess.updateCandidate(main.candidate);

            main.completions += 1;
            main.updateCount();

            $(document).triggerHandler('show:newSurvey');

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
        main.iSelectedPhoto = main.photoSelected ? main.iVisiblePhoto : -1;
        main.updatePhotoSelectionDisplay();
    });

    // Manage group of buttons in a radio style
    $(".btn-group > .btn").click(function(){
        $(this).addClass("active").siblings().removeClass("active");
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

    $("#carousel").on('slid.bs.carousel', function (data) {
        main.updatePhotoSelectionDisplay();
    });

   return main;
});
