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
define(['i18n', 'appConfig', 'userConfig', 'dataAccess'],
    function (i18n, appConfig, userConfig, dataAccess) {
    var self;

    self = {
        iVisiblePhoto: 0,
        photoSelected: false,
        iSelectedPhoto: -1,
        candidate: null,
        signedIn: false,
        completions: 0
    };

//============================================================================================================================//

    // Bring the app to visibility
    $("#signinPage").fadeIn("normal");

    // Get language localization
    var i18nReady = i18n.init();

    // Get app, webmap, feature service
    var appConfigReadies = appConfig.init();

    // When the DOM is ready and we have the app parameters, we can start adjusting the UI; some of the UI is also dependent
    // on the i18n setup
    appConfigReadies.parametersReady.then(function () {
        $().ready(function () {

            // Start up the social media connections
            var socialMediaReady = userConfig.init(appConfig, $("#socialMediaButtonArea")[0], function (notificationType) {
                // Callback from current social medium
                switch (notificationType) {
                    case userConfig.notificationSignIn:
                        if (!self.signedIn) {
                            self.signedIn = true;
                            console.warn("signing in user " + userConfig.getUser().name);//???
                            $(document).triggerHandler('signedIn:user');
                        }
                        break;
                    case userConfig.notificationSignOut:
                        self.signedIn = false;
                        break;
                    case userConfig.notificationAvatarUpdate:
                        var avatar = userConfig.getUser().avatar;
                        if (avatar) {
                            $("#profileAvatar").css("backgroundImage", "url(" + avatar + ")");
                            $("#profileAvatar").fadeIn("fast");
                        } else {
                            $("#profileAvatar").css("display", "none");
                        }
                        break;
                }
            });

            // Splash UI
            $("#signinTitle")[0].innerHTML = appConfig.appParams.title;
            $("#signinParagraph")[0].innerHTML = appConfig.appParams.splashText;
            $("#signinPage").css("background-image", "url(" + appConfig.appParams.splashBackgroundUrl + ")");

            // UI parts using i18n
            i18nReady.then(function () {

                // When the feature service info is ready, we can set up the module that reads from and writes to the service
                appConfigReadies.featureServiceReady.then(function () {
                    dataAccess.init(appConfig.opLayer.url, appConfig.featureSvcParams.id, appConfig.featureSvcParams.objectIdField,
                        appConfig.appParams.surveyorNameField + "+is+null");
                    $("#signinBlock").fadeIn("normal");

                    // Test if there are any surveys remaining to be done
                    dataAccess.getObjectCount().then(function (countRemaining) {
                        if (countRemaining > 0) {
                            // When the social media connections are ready, we can enable the social-media sign-in buttons
                            $("#signinLoginPrompt")[0].innerHTML = i18n.signin.signinFetching;
                            $("#signinLoginPrompt").fadeIn("normal");
                            socialMediaReady.then(function () {
                                $("#signinLoginPrompt").fadeOut("fast", function () {
                                    $("#signinLoginPrompt")[0].innerHTML = i18n.signin.signinLoginPrompt;
                                    $("#signinLoginPrompt").fadeIn("fast");
                                    $("#socialMediaButtonArea").fadeIn("fast");
                                });
                            }).fail(function () {
                                $("#signinLoginPrompt").fadeOut("fast", function () {
                                    $("#signinLoginPrompt")[0].innerHTML = i18n.signin.noMoreSurveys;
                                    $("#signinLoginPrompt").fadeIn("fast");
                                });
                            });
                        } else {
                            $("#signinLoginPrompt")[0].innerHTML = i18n.signin.noMoreSurveys;
                            $("#signinLoginPrompt").fadeIn("normal");
                        }
                    }).fail(function () {
                        $("#signinLoginPrompt")[0].innerHTML = i18n.signin.noMoreSurveys;
                        $("#signinLoginPrompt").fadeIn("normal");
                    });
                });
            });


            // Don't need help button if there's no help to display
            if (appConfig.appParams.helpText.length === 0) {
                $("#helpButton").css("display", "none");
            } else {
                $("#helpTitle")[0].innerHTML = appConfig.appParams.title;
                $("#helpBody")[0].innerHTML = appConfig.appParams.helpText;
            }


        });
    });


    // Using colons for custom event names as recommended by https://learn.jquery.com/events/introduction-to-custom-events/#naming-custom-events
    $(document).on('signedIn:user', function (e) {
        appConfigReadies.featureServiceReady.then(function () {
            var user = userConfig.getUser();

            // Heading on survey/profile page
            $("#name")[0].innerHTML = user.name;
            $("#name2")[0].innerHTML = user.name;

            dataAccess.getObjectCount(appConfig.appParams.surveyorNameField + "=\'" + user.name + "\'").then(function (count) {
                if (count >= 0) {
                    self.completions = count;
                    updateCount();
                } else {
                    $("#profileCount").css("display", "none");
                    $("#ranking").css("display", "none");
                }

            }).fail(function (error) {
                $("#profileCount").css("display", "none");
                $("#ranking").css("display", "none");
            });

            $("#hearts").css("display", "none");

            $("#signinPage").fadeOut("normal");
        });
        appConfigReadies.surveyReady.then(function () {
            $(document).triggerHandler('show:newSurvey');
        });
    });

    $(document).on('signedOut:user', function (e) {
        $("#contentPage").fadeOut("fast");
        $("#signinPage").fadeIn("normal");
        $(document).triggerHandler('hide:profile');
        userConfig.signOut();
    });

    $(document).on('show:newSurvey', function (e) {
        $("#submitBtn")[0].blur();

        // Get candidate property
        dataAccess.getCandidate().then(function (candidate) {
            // obj:feature{}
            // attachments:[{id,url},...]

            if (!candidate.obj) {
                debugger;  //???
                $(document).triggerHandler('show:newSurvey');
                return;
            } else if (candidate.attachments.length === 0) {
                candidate.obj.attributes[appConfig.appParams.surveyorNameField] = "no photos";
                dataAccess.updateCandidate(candidate);
                console.warn("No photos for " + JSON.stringify(candidate));//???
                $(document).triggerHandler('show:newSurvey');
                return;
            }


            self.candidate = candidate;
            self.iSelectedPhoto = -1;
            console.warn("Surveying property " + self.candidate.obj.attributes.PIN) //???


            // Gallery
            var carouselSlidesHolder = $("#carouselSlidesHolder")[0];
            $(carouselSlidesHolder).children().remove();  // remove children and their events
            var carouselIndicatorsHolder = $("#carouselIndicatorsHolder")[0];
            $(carouselIndicatorsHolder).children().remove();  // remove children and their events
            var initiallyActiveItem = self.iSelectedPhoto >= 0 ? self.iSelectedPhoto : 0;

            $.each(candidate.attachments, function (indexInArray, attachment) {
                addPhoto(carouselSlidesHolder, indexInArray, (initiallyActiveItem === indexInArray), attachment.url);
                addPhotoIndicator(carouselIndicatorsHolder, indexInArray, (initiallyActiveItem === indexInArray), "carousel");
            });
            $("#carousel").trigger('create');

            updatePhotoSelectionDisplay();
        }).fail(function (error) {
            debugger;//???
        });

        // Survey
        var surveyContainer = $("#surveyContainer")[0];
        $(surveyContainer).children().remove();  // remove children and their events
        $.each(appConfig.survey, function (indexInArray, questionInfo) {
            addQuestion(surveyContainer, indexInArray, questionInfo);
        });
        $(".btn-group").trigger('create');

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
        $(document).triggerHandler('show:newSurvey', userConfig.getUser().name);
    });
    $("#submitBtn").on('click', function () {
        var surveyContainer, msg, iQuestionResult, hasImportants = true;

        surveyContainer = $('#surveyContainer');
        $.each(appConfig.survey, function (iQuestion, questionInfo) {
            if (questionInfo.style === "button") {
                iQuestionResult = $('#q' + iQuestion + ' .active', surveyContainer).val();
            } else {
                iQuestionResult = $('input[name=q' + iQuestion + ']:checked', surveyContainer).val();
            }
            if (iQuestionResult) {
                self.candidate.obj.attributes[questionInfo.field] = questionInfo.domain.split("|")[iQuestionResult];
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

        // Submit the survey if it has the important responses
        if (hasImportants) {
            self.candidate.obj.attributes[appConfig.appParams.surveyorNameField] = userConfig.getUser().name;
            if (self.iSelectedPhoto >= 0) {
                self.candidate.obj.attributes[appConfig.appParams.bestPhotoField] = self.candidate.attachments[self.iSelectedPhoto].id;
            }
            console.warn("Saving survey for property " + self.candidate.obj.attributes.PIN) //???
            dataAccess.updateCandidate(self.candidate);

            self.completions += 1;
            updateCount();

            $(document).triggerHandler('show:newSurvey');
        }
    });

    $("#hearts").on('click', function () {
        self.photoSelected = !self.photoSelected;
        self.iVisiblePhoto = parseInt($("#carouselSlidesHolder > .item.active")[0].id.substring(1));
        self.iSelectedPhoto = self.photoSelected ? self.iVisiblePhoto : -1;
        /*showHeart('filledHeart', self.photoSelected);
        self.iSelectedPhoto = self.photoSelected ? self.iVisiblePhoto : -1;*/
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
        self.photoSelected = self.iVisiblePhoto === self.iSelectedPhoto;
        showHeart('emptyHeart', !self.photoSelected);
        showHeart('filledHeart', self.photoSelected);
        $("#hearts").attr("title", (self.photoSelected ? "This is the best photo for the property" : "Click if this is the best photo for the property"));
        $("#hearts")[0].style.display = "block";
    }

    function updateCount() {
        $("#score")[0].innerHTML = self.completions;
        $("#score2")[0].innerHTML = self.completions;
        $("#profileCount").fadeIn("normal");

        if (appConfig.contribLevels.length > 0) {
            var level = appConfig.contribLevels.length - 1;
            var remainingToNextLevel = 0;
            while (appConfig.contribLevels[level].minimumSurveysNeeded > self.completions) {
                remainingToNextLevel = appConfig.contribLevels[level].minimumSurveysNeeded;
                level -= 1;
            }
            var doneThisLevel = self.completions - appConfig.contribLevels[level].minimumSurveysNeeded;
            remainingToNextLevel = Math.max(0, remainingToNextLevel - self.completions);
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

            $("#ranking").fadeIn("normal");
        } else {
            $("#ranking").css("display", "none");
        }
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

    function addPhoto(carouselSlidesHolder, indexInArray, isActive, photoUrl) {
        // <div id='carousel0' class='item active'><img src='__test/VIRB0125.JPG' alt='VIRB0125.JPG'></div>
        //var content = "<div id='c" + indexInArray + "' class='item" + (isActive ? " active" : "") +
        //    "'><img src='" + photoUrl + "'></div>";
        // $(carouselSlidesHolder).append(content);

        // var content = $("<div id='c" + indexInArray + "' class='item" + (isActive ? " active" : "") + "'></div>");
        var content = "<div id='c" + indexInArray + "' class='item" + (isActive ? " active" : "") +
            "'><img /></div>";
        $(carouselSlidesHolder).append(content);

        if (indexInArray === -1) {  //???
            loadImage(photoUrl, $("#c" + indexInArray + " img")[0]);  //???
        } else {
            $("#c" + indexInArray + " img")[0].src = photoUrl;
        }

        /*loadImage(photoUrl).then(function (imgElement) {
            $(content).append(imgElement);
            $(carouselSlidesHolder).append(content);
        });*/
    }

    function addPhotoIndicator(carouselIndicatorsHolder, indexInArray, isActive, carouselId) {
        // <li data-target='#myCarousel' data-slide-to='0' class='active'></li>
        var content = "<li data-target='#" + carouselId + "' data-slide-to='" + indexInArray +
            "'" + (isActive ? " class='active'" : "") + "></li>";
        $(carouselIndicatorsHolder).append(content);
    }

    //------------------------------------------------------------------------------------------------------------------------//

    function startPhotoSet(numPhotos) {
        // Init shared progress bar
    }

    // https://gist.github.com/jafstar/3395525
    // with mods to anonymous functions
    var progressBar;

    function loadImage(imageURI, context)
    {
        var request;
        //var deferred = $.Deferred();
        //var imageElement = document.createElement("img");

        request = new XMLHttpRequest();
        request.onloadstart = function () {
            progressBar = document.createElement("progress");
            progressBar.value = 0;
            progressBar.max = 100;
            progressBar.removeAttribute("value");
            document.body.appendChild(progressBar);
        };
        request.onprogress = function (e) {
            if (e.lengthComputable)
                progressBar.value = e.loaded / e.total * 100;
            else
                progressBar.removeAttribute("value");
        };
        request.onload = function () {
            //imageElement.src = "data:image/jpeg;base64," + base64Encode(request.responseText);
            //deferred.resolve(imageElement);

            context.src = "data:image/jpeg;base64," + base64Encode(request.responseText);
        };
        request.onloadend = function () {
            document.body.removeChild(progressBar);
        };
        request.open("GET", imageURI, true);
        request.overrideMimeType('text/plain; charset=x-user-defined');
        request.send(null);

        //return deferred;
    }

    // This encoding function is from Philippe Tenenhaus's example at http://www.philten.com/us-xmlhttprequest-image/
    function base64Encode(inputStr)
    {
       var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
       var outputStr = "";
       var i = 0;

       while (i < inputStr.length)
       {
           //all three "& 0xff" added below are there to fix a known bug
           //with bytes returned by xhr.responseText
           var byte1 = inputStr.charCodeAt(i++) & 0xff;
           var byte2 = inputStr.charCodeAt(i++) & 0xff;
           var byte3 = inputStr.charCodeAt(i++) & 0xff;

           var enc1 = byte1 >> 2;
           var enc2 = ((byte1 & 3) << 4) | (byte2 >> 4);

           var enc3, enc4;
           if (isNaN(byte2))
           {
               enc3 = enc4 = 64;
           }
           else
           {
               enc3 = ((byte2 & 15) << 2) | (byte3 >> 6);
               if (isNaN(byte3))
               {
                   enc4 = 64;
               }
               else
               {
                   enc4 = byte3 & 63;
               }
           }

           outputStr += b64.charAt(enc1) + b64.charAt(enc2) + b64.charAt(enc3) + b64.charAt(enc4);
        }

        return outputStr;
    }


});
