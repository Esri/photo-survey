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
define(function (require) {
    var i18nLoader, self, appConfig, userConfig;

    i18nLoader = require('app/i18n');
    appConfig = require('app/appConfig');
    userConfig = require('app/userConfig');
    self = {
        iVisiblePhoto: 0,
        photoSelected: false
    };

//============================================================================================================================//

    // Photos of property from attachment(s) for property; selected photo initially -1, then id? saved as 'best photo id' in FS
    var _photos = [{
        label: "VIRB0125.JPG",
        url: "__test/VIRB0125.5.JPG"
    }, {
        label: "VIRB0126.JPG",
        url: "__test/VIRB0126.5.JPG"
    }, {
        label: "VIRB0127.JPG",
        url: "__test/VIRB0127.5.JPG"
    }];
    var iSelectedPhoto = -1;

//============================================================================================================================//



    //??? appConfig.ready
    appConfig.init();
    $("#signinPage").css("background-image", "url(" + appConfig.appParams.splashBackgroundUrl + ")");

    // Don't need help button if there's no help to display
    if (appConfig.appParams.helpText.length === 0) {
        $("#helpButton").css("display", "none");
    } else {
        $("#helpTitle")[0].innerHTML = appConfig.appParams.title;
        $("#helpBody")[0].innerHTML = appConfig.appParams.helpText;
    }

    // Using colons for custom event names as recommended by https://learn.jquery.com/events/introduction-to-custom-events/#naming-custom-events
    $(document).on('signedIn:user', function (e) {
        $("#signinPage").fadeOut("normal");
        $(document).triggerHandler('show:newSurvey');
    });

    $(document).on('signedOut:user', function (e) {
        $("#contentPage").fadeOut("fast");
        $("#signinPage").fadeIn("normal");
        $(document).triggerHandler('hide:profile');
        userConfig.signOut();
    });

    //??? TODO: split out new user from new survey
    $(document).on('show:newSurvey', function (e) {
        // Heading
        $("#name")[0].innerHTML = userConfig.name;
        $("#score")[0].innerHTML = userConfig.completions;



        // Gallery
        var carouselSlidesHolder = $("#carouselSlidesHolder")[0];
        $(carouselSlidesHolder).children().remove();  // remove children and their events
        var carouselIndicatorsHolder = $("#carouselIndicatorsHolder")[0];
        $(carouselIndicatorsHolder).children().remove();  // remove children and their events
        var initiallyActiveItem = iSelectedPhoto >= 0 ? iSelectedPhoto : 0;
        $.each(_photos, function (indexInArray, photoInfo) {
            addPhoto(carouselSlidesHolder, indexInArray, (initiallyActiveItem === indexInArray), photoInfo);
            addPhotoIndicator(carouselIndicatorsHolder, indexInArray, (initiallyActiveItem === indexInArray), "carousel");
        });
        $("#carousel").trigger('create');

        updatePhotoSelectionDisplay();


        // Survey
        var surveyContainer = $("#surveyContainer")[0];
        $(surveyContainer).children().remove();  // remove children and their events
        $.each(appConfig.survey, function (indexInArray, questionInfo) {
            addQuestion(surveyContainer, indexInArray, questionInfo);
        });
        $(".btn-group").trigger('create');

        $("#SURVEY_RESULTS").css("background-color", "white").css("border-left-color", "white")[0].innerHTML = "";  //???


        // Profile
        if (userConfig.avatar) {
            $("#profileAvatar").css("backgroundImage", "url(" + userConfig.avatar + ")");
        } else {
            $("#profileAvatar").css("display", "none");
        }
        $("#name2")[0].innerHTML = userConfig.name;
        $("#score2")[0].innerHTML = userConfig.completions;

        if (appConfig.contribLevels.length > 0) {
            var level = appConfig.contribLevels.length - 1;
            var remainingToNextLevel = 0;
            while (appConfig.contribLevels[level].minimumSurveysNeeded > userConfig.completions) {
                remainingToNextLevel = appConfig.contribLevels[level].minimumSurveysNeeded;
                level -= 1;
            }
            var doneThisLevel = userConfig.completions - appConfig.contribLevels[level].minimumSurveysNeeded;
            remainingToNextLevel = Math.max(0, remainingToNextLevel - userConfig.completions);
            var cRankBarWidthPx = 170;
            $("#profileRankBarFill")[0].style.width = (cRankBarWidthPx * doneThisLevel / (doneThisLevel + remainingToNextLevel)) + "px";

            if (level === 0) {
                $("img", ".profileRankStars").attr("src", "images/empty-star.png");
            } else {
                var stars = $("img:eq(" + (level - 1) + ")", ".profileRankStars");
                stars.prevAll().andSelf().attr("src", "images/filled-star.png");
                stars.nextAll().attr("src", "images/empty-star.png");
            }
            $("#rankLabel")[0].innerHTML = appConfig.contribLevels[level].label;
            $("#level")[0].innerHTML = "level $(level)".replace("$(level)", level);
            $("#remainingToNextLevel")[0].innerHTML = remainingToNextLevel === 0? "" :
                "$(remainingToNextLevel) surveys left until next level".replace("$(remainingToNextLevel)", remainingToNextLevel);
        } else {
            $("#ranking").css("display", "none");
        }


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



    // Get and apply the language localization
    this.i18n = {};
    i18nLoader.then(function (data) {
        var self = this;
        this.i18n = data;

        // Update language-dependent parts of UI
        $().ready(function () {
            $("#signinTitle")[0].innerHTML = appConfig.appParams.title;
            $("#signinParagraph")[0].innerHTML = appConfig.appParams.splashText;
            $("#signinLoginPrompt")[0].innerHTML = self.i18n.signin.signinLoginPrompt;
            $("#signinBlock").fadeIn("normal", function () {
                // Simulate display awaiting setup of social media access
                setTimeout(function () {
                    $("#socialMediaButtonArea").fadeIn("fast");
                }, 200);
            });

            //??? TODO: placeholder for sign-in
            $("#signinBlock").on('click', function () {
                userConfig.signIn().then(function () {
                    $(document).triggerHandler('signedIn:user');
                });
            });



        });
    });



    // Wire up app
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
        $(document).triggerHandler('show:newSurvey', userConfig.name);
    });
    $("#submitBtn").on('click', function () {
        var surveyContainer, msg, iQuestionResult, hasImportants = true;

        surveyContainer = $('#surveyContainer');
        msg = "<u>Selections (0-based indices)</u><br>";
        $.each(appConfig.survey, function (iQuestion, questionInfo) {
            if (questionInfo.style === "button") {
                iQuestionResult = $('#q' + iQuestion + ' .active', surveyContainer).val();
            } else {
                iQuestionResult = $('input[name=q' + iQuestion + ']:checked', surveyContainer).val();
            }
            if (iQuestionResult) {
                msg += iQuestion + ": " + iQuestionResult + " (" + questionInfo.domain.split("|")[iQuestionResult] + ")<br>";
            } else {
                msg += iQuestion + ": <br>";
            }

            // Flag missing importants
            if (questionInfo.important) {
                if (iQuestionResult) {
                    $("#qg" + iQuestion).removeClass("flag-error");
                } else {
                    $("#qg" + iQuestion).addClass("flag-error");
                    hasImportants = false;
                }
            }
        });

        $("#SURVEY_RESULTS").css("background-color", (hasImportants ? "darkseagreen" : "#fbdcd5")).css("border-left-color", (hasImportants ? "forestgreen" : "#de2900"))[0].innerHTML = msg;
    });

    $("#hearts").on('click', function () {
        self.photoSelected = !self.photoSelected;
        self.iVisiblePhoto = parseInt($("#carouselSlidesHolder > .item.active")[0].id.substring(1));
        iSelectedPhoto = self.photoSelected ? self.iVisiblePhoto : -1;
        /*showHeart('filledHeart', self.photoSelected);
        iSelectedPhoto = self.photoSelected ? self.iVisiblePhoto : -1;*/
        updatePhotoSelectionDisplay();
    });

    function showHeart(heartId, makeVisible) {
        document.getElementById(heartId).style.display = makeVisible ? 'block' : 'none';
    }

    // Manage group of buttons in a radio style
    $(".btn-group > .btn").click(function(){
        $(this).addClass("active").siblings().removeClass("active");
    });

    $("#carousel").on('slide.bs.carousel', function (data) {
        // Before carousel slide
        $("#hearts")[0].style.display = "none";
    });

    $("#carousel").on('slid.bs.carousel', function (data) {
        updatePhotoSelectionDisplay();
    });

    function updatePhotoSelectionDisplay() {
        // After carousel slide
        self.iVisiblePhoto = parseInt($("#carouselSlidesHolder > .item.active")[0].id.substring(1));
        self.photoSelected = self.iVisiblePhoto === iSelectedPhoto;
        showHeart('emptyHeart', !self.photoSelected);
        showHeart('filledHeart', self.photoSelected);
        $("#hearts").attr("title", (self.photoSelected ? "This is the best photo for the property" : "Click if this is the best photo for the property"));
        $("#hearts")[0].style.display = "block";
    }






    function startQuestion(surveyContainer, iQuestion, questionInfo) {
        // <div class='form-group'>
        //   <label for='q1'>Is there a structure on the property? <span class='glyphicon glyphicon-star'></span></label><br>
        //??? TODO: i18n "Please answer this question"
        var start =
            "<div id='qg" + iQuestion + "' class='form-group'>"
            + "<label for='q" + iQuestion + "'>" + questionInfo.question
            + (questionInfo.important ? "&nbsp;<span class='glyphicon glyphicon-star' title='" + "Please answer this question" + "'></span>" : "")
            + "</label><br>";
        return start;
    }

    function createButtonChoice(surveyContainer, iQuestion, questionInfo) {
        // <div id='q1' class='btn-group'>
        //   <button type='button' class='btn'>Yes</button>
        //   <button type='button' class='btn'>No</button>
        //   <button type='button' class='btn'>Not sure</button>
        // </div>
        var buttons = "<div id='q" + iQuestion + "' class='btn-group'>";
        var domain = questionInfo.domain.split('|');
        $.each(domain, function (i, choice) {
            buttons += "<button type='button' class='btn' value='" + i + "'>" + choice + "</button>";
        });
        buttons += "</div>";
        return buttons;
    }

    function createListChoice(surveyContainer, iQuestion, questionInfo) {
        // <div class='radio'><label><input type='radio' name='q1' id='optionFound1' value='0'>Crawlspace</label></div>
        // <div class='radio'><label><input type='radio' name='q1' id='optionFound2' value='1'>Raised</label></div>
        // <div class='radio'><label><input type='radio' name='q1' id='optionFound3' value='2'>Elevated</label></div>
        // <div class='radio'><label><input type='radio' name='q1' id='optionFound4' value='3'>Slab on grade</label></div>
        // <div class='radio'><label><input type='radio' name='q1' id='optionFound0' value='4'>Not sure</label></div>
        var list = "";
        var domain = questionInfo.domain.split('|');
        $.each(domain, function (i, choice) {
            list += "<div class='radio'><label><input type='radio' name='q" + iQuestion + "' value='" + i + "'>" + choice + "</label></div>";
        });
        return list;
    }

    function wrapupQuestion(surveyContainer, iQuestion, questionInfo) {
        // </div>
        // <div class='clearfix'></div>
        var wrap = "</div><div class='clearfix'></div>";
        return wrap;
    }

    function addQuestion(surveyContainer, iQuestion, questionInfo) {
        var question = startQuestion(surveyContainer, iQuestion, questionInfo);
        if (questionInfo.style === "button") {
            question += createButtonChoice(surveyContainer, iQuestion, questionInfo);
        } else {
            question += createListChoice(surveyContainer, iQuestion, questionInfo);
        }
        question += wrapupQuestion(surveyContainer, iQuestion, questionInfo);
        $(surveyContainer).append(question);

        // Fix radio-button toggling
        if (questionInfo.style === "button") {
            $('#q' + iQuestion + ' button').click(function() {
                $(this).addClass('active').siblings().removeClass('active');
            });
        }
    }

    function addPhoto(carouselSlidesHolder, indexInArray, isActive, photoInfo) {
        // <div id='carousel0' class='item active'><img src='__test/VIRB0125.JPG' alt='VIRB0125.JPG'></div>
        var content = "<div id='c" + indexInArray + "' class='item" + (isActive ? " active" : "") +
            "'><img src='" + photoInfo.url + "' alt='" + photoInfo.label + "'></div>";
        $(carouselSlidesHolder).append(content);
    }

    function addPhotoIndicator(carouselIndicatorsHolder, indexInArray, isActive, carouselId) {
        // <li data-target='#myCarousel' data-slide-to='0' class='active'></li>
        var content = "<li data-target='#" + carouselId + "' data-slide-to='" + indexInArray +
            "'" + (isActive ? " class='active'" : "") + "></li>";
        $(carouselIndicatorsHolder).append(content);
    }

});
