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
define(function () {
    var that;
    return {

        //--------------------------------------------------------------------------------------------------------------------//

        // Available after init's parametersReady deferred
        urlParams: {},
        appParams: {
            webmap: "",
            webmapImageUrl: "",
            title: "",
            splashText: "",
            splashBackgroundUrl: "images/splash.jpg",
            helpText: "",
            contribLevels: [],

            showFacebook: "true",
            showGooglePlus: "true",
            showTwitter: "true",
            facebookAppId: "",
            googleplusClientId: "",
            googleplusLogoutUrl: "https://accounts.google.com/logout",
            twitterSigninUrl: "https://utility.arcgis.com/tproxy/signin",
            twitterUserUrl: "https://utility.arcgis.com/tproxy/proxy/1.1/account/verify_credentials.json?q=&include_entities=true&skip_status=true&locale=en",
            twitterCallbackUrl: "/oauth-callback-twitter.html",

            surveyorNameField: "",
            bestPhotoField: ""
        },

        // Available after init's featureServiceReady deferred
        webmapParams: {},
        opLayerParams: null,
        featureSvcParams: {},

        // Available after init's surveyReady deferred; array of {question, style, domain, field, important}
        survey: [],

        //--------------------------------------------------------------------------------------------------------------------//

        logElapsedTime: function (tag, startMs) {  //???
            var ticks = (new Date()).getTime() - startMs;
            console.log(tag + ": " + ticks);
        },


        init: function () {
            that = this;
            var url;
            var startMs = (new Date()).getTime();  //???

            var parametersReady = $.Deferred();
            var featureServiceReady = $.Deferred();
            var surveyReady = $.Deferred();


            // Get the URL parameters
            var params = window.location.search;
            if (params.length > 0 && params[0] === "?") {
                params = params.substring(1).split("&");
                $.map(params, function (item, index) {
                    var paramParts = item.split("=");
                    that.urlParams[paramParts[0].toLowerCase()] = paramParts[1];
                });
            }

            // We have two sources of app parameters: an online app indicated by the appId URL parameter
            // and a configuration file. We want both because the online app only includes parameters that
            // were changed from the defaults.
            var fileAppDeferred = $.Deferred();
            $.getJSON("js/configuration.json", function (data) {
                that.logElapsedTime("resolve config file", startMs);  //???
                fileAppDeferred.resolve(data);
            });

            var onlineAppDeferred = $.Deferred();
            if (that.urlParams.appid) {
                $.getJSON("http://www.arcgis.com/sharing/content/items/" + that.urlParams.appid + "/data?f=json", function (data) {
                    that.logElapsedTime("resolve online config", startMs);  //???
                    onlineAppDeferred.resolve(data);
                });
            } else {
                that.logElapsedTime("no online config", startMs);  //???
                onlineAppDeferred.resolve({});
            }

            // After getting both parameter sets, we overwrite the barebones parameters defined above first with the file
            // values and then with the online app values
            $.when(fileAppDeferred, onlineAppDeferred).done(function (fileAppData, onlineAppData) {
                if (fileAppData && fileAppData.values) {
                    fileAppData = fileAppData.values;
                } else {
                    fileAppData = {};
                }
                if (onlineAppData && onlineAppData.values) {
                    onlineAppData = onlineAppData.values;
                } else {
                    onlineAppData = {};
                }
                that.appParams = $.extend(that.appParams, fileAppData, onlineAppData);

                // Normalize booleans
                that.appParams.showFacebook = that._toBoolean(that.appParams.showFacebook);
                that.appParams.showGooglePlus = that._toBoolean(that.appParams.showGooglePlus);
                that.appParams.showTwitter = that._toBoolean(that.appParams.showTwitter);

                that.logElapsedTime("merged configs", startMs);  //???

                // GA URL-supplied webmap overrides a configured one
                if (that.urlParams.webmap) {
                    that.appParams.webmap = that.urlParams.webmap;
                }

                // Get the app's webmap's data
                if (that.appParams.webmap) {
                    $.getJSON("http://www.arcgis.com/sharing/content/items/" + that.appParams.webmap + "?f=json", function (data) {
                        var backgroundUrl;
                        that.logElapsedTime("have webmap", startMs);  //???

                        // Extract the app configuration from the webmap
                        if (data) {
                            that.appParams.title = data.title;
                            that.appParams.splashText = data.snippet;
                            that.appParams.helpText = data.description;
                            var imageFilename = data.thumbnail;
                            if(imageFilename) {
                                var iExt = imageFilename.lastIndexOf(".");
                                if (iExt >= 0) {
                                    imageFilename = imageFilename.substring(0, iExt) + "_orig" + imageFilename.substr(iExt);
                                    that.appParams.webmapImageUrl = "http://www.arcgis.com/sharing/content/items/" + that.appParams.webmap + "/info/" + imageFilename;
                                }
                            }
                            that.appParams = $.extend(that.appParams, that._parseAccessConfig(data.licenseInfo));

                            // Normalize booleans
                            that.appParams.showFacebook = that._toBoolean(that.appParams.showFacebook);
                            that.appParams.showGooglePlus = that._toBoolean(that.appParams.showGooglePlus);
                            that.appParams.showTwitter = that._toBoolean(that.appParams.showTwitter);
                        }
                        parametersReady.resolve();
                    });
                }

                // Get the app's webmap's data
                if (that.appParams.webmap) {
                    $.getJSON("http://www.arcgis.com/sharing/content/items/" + that.appParams.webmap + "/data?f=json", function (data) {
                        that.webmapParams = data || {};
                        that.logElapsedTime("have webmap data", startMs);  //???

                        if (that.webmapParams && that.webmapParams.operationalLayers && that.webmapParams.operationalLayers.length > 0) {
                            that.opLayerParams = that.webmapParams.operationalLayers[0];

                        // Get the app's webmap's feature service's data
                            $.getJSON(that.opLayerParams.url + "?f=json", function (data) {
                                that.featureSvcParams = data || {};
                                featureServiceReady.resolve();
                                that.logElapsedTime("have feature svc", startMs);  //???

                                if (that.featureSvcParams.fields) {
                                    // Create dictionary of fields with their domains and nullability; skip fields without domains
                                    var fieldDomains = {};
                                    $.each(that.featureSvcParams.fields, function (idx, field) {
                                        if (field.domain && field.domain.codedValues) {
                                            fieldDomains[field.name] = {
                                                domain: $.map(field.domain.codedValues, function (item, index) {
                                                    return item.code
                                                }).join("|"),
                                                important: !field.nullable
                                            }
                                        }
                                    });

                                    // Parse survey
                                    that.survey = that._parseSurvey(
                                        that.opLayerParams.popupInfo.description, fieldDomains);

                                    surveyReady.resolve();
                                }
                            });
                        }
                    });
                }
            });

            return {
                "parametersReady": parametersReady,
                "featureServiceReady" : featureServiceReady,
                "surveyReady" : surveyReady
            };
        },

        //--------------------------------------------------------------------------------------------------------------------//

        _parseSurvey: function (source, fieldDomains) {
            // e.g., <p>Is there a Structure on the Property? <b>{<font color='#0000ff'>Structure</font>} </b><b>{<span
            //  style='background-color:rgb(255, 0, 0);'>button</span>}</b></p><p><ul><li>Is the lot overgrown? <b>{Lot}
            //  </b><b>{button}</b><br /></li><li>Foundation type: <b>{<font color='#ffff00' style='background-color:
            //  rgb(255, 69, 0);'>FoundationType</font>} </b><b>{radio}</b><br /></li></ul></p><p><b><br /></b></p><p>Is
            //  there roof damage? <b>{RoofDamage} </b><b>{button}</b></p><p>Is the exterior damaged? <b>{ExteriorDamage}
            //  </b><b>{button}</b></p><p></p><ol><li>Is there graffiti? <b>{Graffiti} </b><b>{button}</b><br /></li><li>
            //  Are there boarded windows/doors? <b>{Boarded} </b><b>{button}</b><br /></li></ol>
            var survey = [];

            // 1. split on </p> and then </li> (lists are enclosed in <p></p> sets)
            var taggedSurveyLines = [];
            var descriptionSplitP = source.split("</p>");
            $.each(descriptionSplitP, function (idx, line) {
                $.merge(taggedSurveyLines, line.split("</li>"));
            });

            // 2. remove all html tags (could have <b>, <i>, <u>, <ol>, <ul>, <li>, <a>, <font>, <span>, <br>,
            // and their closures included or explicit)
            var surveyLines = [];
            $.each(taggedSurveyLines, function (idx, line) {
                var cleanedLine = that._stripHTML(line).trim();
                if (cleanedLine.length > 0) {
                    surveyLines.push(cleanedLine);
                }
            });

            // 3. Separate into question, field, and style
            // e.g., "Is there a Structure on the Property? {Structure} {button}"
            $.each(surveyLines, function (idx, line) {
                var paramParts = line.split("{");
                var trimmedParts = [];
                $.each(paramParts, function (idx, part) {
                    var trimmed = part.replace("}", "").trim();
                    if (trimmed.length > 0) {
                        trimmedParts.push(trimmed);
                    }
                });

                // Should have three parts now: question, field, style; we can add in the question's
                // domain and importance from the fieldDomain dictionary created just above
                if (trimmedParts.length === 3) {
                    var fieldName = trimmedParts[1];
                    if (fieldDomains[fieldName]) {
                        var surveyQuestion = {
                            question: trimmedParts[0],
                            field: fieldName,
                            style: trimmedParts[2],
                            domain: fieldDomains[fieldName].domain,
                            important: fieldDomains[fieldName].important
                        };
                        survey.push(surveyQuestion);
                    }
                }
            });
            return survey;
        },

        _parseAccessConfig: function (source) {
            // e.g., <div>Copyright 2015 My City</div><div><br /></div><div>=== Access and use settings ===</div><div><br />
            //  </div><div>contribution star levels:</div><div>0: Getting Started @0</div><div>1: Beginner @5</div><div>2:
            //  Helper @10</div><div>3: Intermediate @15</div><div>4: Advanced @20</div><div>5: Wow! @25</div><div><br />
            //  </div><div>Facebook app id: 101991193476073</div><div>Google+ client id:
            //  884148190980-mrcnakr5q14ura5snpcbgp85ovq7s7ea.apps.googleusercontent.com</div><div>show Twitter: true</div>
            //  <div><br /></div><div>surveyor name field: SRVNAME</div><div>best photo field: BSTPHOTOID</div><div><br /></div>
            var config = {};

            // 1. split on </div> and then <br
            var taggedConfigLines = [];
            var descriptionSplitDiv = source.split("</div>");
            $.each(descriptionSplitDiv, function (idx, line) {
                $.merge(taggedConfigLines, line.split("<br />"));
            });

            // 2. remove all html tags (could have <b>, <i>, <u>, <ol>, <ul>, <li>, <a>, <font>, <span>, <br>, <div>,
            // and their closures included or explicit)
            // yields something like:
            //  0: "Copyright 2015 My City"
            //  1: "=== Access and use settings ==="
            //  2: "contribution star levels:"
            //  3: "0: Getting Started @0"
            //  4: "1: Beginner @5"
            //  5: "2: Helper @10"
            //  6: "3: Intermediate @15"
            //  7: "4: Advanced @18"
            //  8: "5: Wow! @25"
            //  9: "Facebook app id: 103782893296903"
            //  10: "Google+ client id: 801106938257-am9uvo6dm0ih06r7h048k7m66l6oo3v1.apps.googleusercontent.com"
            //  11: "show Twitter: true"
            //  12: "surveyor name field: SRVNAME"
            //  13: "best photo field: BSTPHOTOID"
            var configLines = [];
            $.each(taggedConfigLines, function (idx, line) {
                var cleanedLine = that._stripHTML(line).trim();
                if (cleanedLine.length > 0) {
                    configLines.push(cleanedLine);
                }
            });

            // 3. step thru lines seeking keywords
            var keywordParts = ["=== access and use settings ===",
                "contribution star levels", "0", "1", "2", "3", "4", "5",
                "facebook", "google", "twitter", "surveyor", "photo"];
            var iLine;
            var iKeyword = 0;
            var config = {
                "showFacebook": false,
                "showGooglePlus": false,
                "showTwitter": false
            };
            var contribLevels = [];

            for (iLine = 0; iLine < configLines.length; iLine += 1) {
                var lineParts = configLines[iLine].split(':');
                if (lineParts[0].toLowerCase().indexOf(keywordParts[iKeyword]) >= 0) {
                    switch (iKeyword) {
                    case 0: // "=== Access and use settings ==="
                        break;
                    case 1: // "contribution star levels"
                        break;
                    case 2: // "0"
                        that._getContribLevel(0, lineParts[1], contribLevels);
                        break;
                    case 3: // "1"
                        that._getContribLevel(1, lineParts[1], contribLevels);
                        break;
                    case 4: // "2"
                        that._getContribLevel(2, lineParts[1], contribLevels);
                        break;
                    case 5: // "3"
                        that._getContribLevel(3, lineParts[1], contribLevels);
                        break;
                    case 6: // "4"
                        that._getContribLevel(4, lineParts[1], contribLevels);
                        break;
                    case 7: // "5"
                        that._getContribLevel(5, lineParts[1], contribLevels);
                        if (contribLevels != null) {
                            config.contribLevels = contribLevels;
                        }
                        break;
                    case 8: // "Facebook app id"
                        config.showFacebook = true;
                        config.facebookAppId = lineParts[1].trim();
                        break;
                    case 9: // "Google+ client id"
                        config.showGooglePlus = true;
                        config.googleplusClientId = lineParts[1].trim();
                        break;
                    case 10: // "show Twitter"
                        config.showTwitter = true;
                        break;
                    case 11: // "surveyor name field"
                        config.surveyorNameField = lineParts[1].trim();
                        break;
                    case 12: // "best photo field"
                        config.bestPhotoField = lineParts[1].trim();
                        break;
                    }

                    iKeyword += 1;
                    if (iKeyword >= keywordParts.length) {
                        break;
                    }
                }
            }
            return config;
        },

        _getContribLevel: function (iLevel, levelDescrip, contribLevels) {
            var levelParts, minimumSurveysNeeded;

            if (contribLevels != null && levelDescrip != null) {
                levelParts = levelDescrip.split('@');
                try {
                    minimumSurveysNeeded = iLevel === 0 ? 0 :
                        Number.parseInt(levelParts[1]);
                    contribLevels.push({
                        "label": levelParts[0].trim(),
                        "minimumSurveysNeeded": minimumSurveysNeeded
                    });
                } catch (ignore) {
                    // Flag an unusable set
                    contribLevels = null;
                }
            }
        },

        // By Simon Boudrias, http://stackoverflow.com/a/13140100
        _stripHTML: function (dirtyString) {
            var text;
            var container = document.createElement('div');
            container.innerHTML = dirtyString;
            return container.textContent || container.innerText;
        },

        /** Normalizes a boolean value to true or false.
         * @param {boolean|string} boolValue A true or false
         *        value that is returned directly or a string
         *        "true" or "false" (case-insensitive) that
         *        is checked and returned; if neither a
         *        a boolean or a usable string, falls back to
         *        defaultValue
         * @param {boolean} [defaultValue] A true or false
         *        that is returned if boolValue can't be
         *        used; if not defined, true is returned
         * @memberOf js.LGObject#
         */
        _toBoolean: function (boolValue, defaultValue) {
            var lowercaseValue;

            // Shortcut true|false
            if (boolValue === true) {
                return true;
            }
            if (boolValue === false) {
                return false;
            }

            // Handle a true|false string
            if (typeof boolValue === "string") {
                lowercaseValue = boolValue.toLowerCase();
                if (lowercaseValue === "true") {
                    return true;
                }
                if (lowercaseValue === "false") {
                    return false;
                }
            }
            // Fall back to default
            if (defaultValue === undefined) {
                return true;
            }
            return defaultValue;
        }

    };
});
