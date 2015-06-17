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
    return {

        //--------------------------------------------------------------------------------------------------------------------//

        // Available upon return
        contribLevels: [],

        // Available after init's parametersReady deferred
        urlParams: {},
        appParams: {  // Provide fallback values in case neither the configuration file nor the online app can be retrieved
            webmap: "",
            title: "Photo Survey",
            splashText: "The Property Survey application can be used to conduct rapid damage assessments, inventory blighted properties, target reappraisal efforts, and identify structures that could pose safety concerns.",
            splashBackgroundUrl: "images/splash.jpg",
            helpText: "",
            contributorLevels: ",100,,200,,400,,800,,1600,",

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
        opLayer: null,
        featureSvcParams: {},

        // Available after init's surveyReady deferred
        survey: [],

        //--------------------------------------------------------------------------------------------------------------------//

        logElapsedTime: function (tag, startMs) {  //???
            var ticks = (new Date()).getTime() - startMs;
            console.log(tag + ": " + ticks);
        },


        init: function () {
            var self = this;
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
                    self.urlParams[paramParts[0].toLowerCase()] = paramParts[1];
                });
            }

            // We have two sources of app parameters: an online app indicated by the appId URL parameter
            // and a configuration file. We want both because the online app only includes parameters that
            // were changed from the defaults.
            var fileAppDeferred = $.Deferred();
            $.getJSON("js/configuration.json", function (data) {
                self.logElapsedTime("resolve config file", startMs);  //???
                fileAppDeferred.resolve(data);
            });

            var onlineAppDeferred = $.Deferred();
            if (self.urlParams.appid) {
                $.getJSON("http://www.arcgis.com/sharing/content/items/" + self.urlParams.appid + "/data?f=json", function (data) {
                    self.logElapsedTime("resolve online config", startMs);  //???
                    onlineAppDeferred.resolve(data);
                });
            } else {
                self.logElapsedTime("no online config", startMs);  //???
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
                self.appParams = $.extend(self.appParams, fileAppData, onlineAppData);

                // Normalize booleans
                self.appParams.showFacebook = self._toBoolean(self.appParams.showFacebook);
                self.appParams.showGooglePlus = self._toBoolean(self.appParams.showGooglePlus);
                self.appParams.showTwitter = self._toBoolean(self.appParams.showTwitter);

                self.logElapsedTime("merged configs", startMs);  //???

                // GA URL-supplied webmap overrides a configured one
                if (self.urlParams.webmap) {
                    self.appParams.webmap = self.urlParams.webmap;
                }

                // Get the app's webmap's data
                if (self.appParams.webmap) {
                    $.getJSON("http://www.arcgis.com/sharing/content/items/" + self.appParams.webmap + "?f=json", function (data) {
                        var backgroundUrl;
                        self.logElapsedTime("have webmap", startMs);  //???

                        // Extract the app configuration from the webmap
                        if (data) {
                            self.appParams.title = data.title;
                            self.appParams.splashText = data.snippet;
                            self.appParams.helpText = data.description;
                            var imageFilename = data.thumbnail;
                            if(imageFilename) {
                                var iExt = imageFilename.lastIndexOf(".");
                                if (iExt >= 0) {
                                    imageFilename = imageFilename.substring(0, iExt) + "_orig" + imageFilename.substr(iExt);
                                    self.appParams.webmapImageUrl = "http://www.arcgis.com/sharing/content/items/" + self.appParams.webmap + "/info/" + imageFilename;
                                }
                            }
                            self._parseAccessConfig(data.licenseInfo);//???
                        }
                        parametersReady.resolve();
                    });
                }

                // Get the app's webmap's data
                if (self.appParams.webmap) {
                    $.getJSON("http://www.arcgis.com/sharing/content/items/" + self.appParams.webmap + "/data?f=json", function (data) {
                        self.webmapParams = data || {};
                        self.logElapsedTime("have webmap data", startMs);  //???

                        if (self.webmapParams && self.webmapParams.operationalLayers && self.webmapParams.operationalLayers.length > 0) {
                            self.opLayer = self.webmapParams.operationalLayers[0];

                        // Get the app's webmap's feature service's data
                            $.getJSON(self.opLayer.url + "?f=json", function (data) {
                                self.featureSvcParams = data || {};
                                featureServiceReady.resolve();
                                self.logElapsedTime("have feature svc", startMs);  //???

                                if (self.featureSvcParams.fields) {
                                    // Create dictionary of fields with their domains and nullability; skip fields without domains
                                    var fieldDomains = {};
                                    $.each(self.featureSvcParams.fields, function (idx, field) {
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
                                    self.survey = self._parseSurvey(self.opLayer.popupInfo.description, fieldDomains);

                                    surveyReady.resolve();
                                }
                            });
                        }
                    });
                }

                // Expand the contributor level definition into an array for easier lookup.
                self.contribLevels = self._parseContributorLevels(self.appParams.contributorLevels)
            });

            return {
                "parametersReady": parametersReady,
                "featureServiceReady" : featureServiceReady,
                "surveyReady" : surveyReady
            };
        },

        //--------------------------------------------------------------------------------------------------------------------//


        _parseContributorLevels: function (source) {
            // The display uses five stars, so we support six contributor levels separated by five
            // >0 values in increasing order, e.g., "A,100,B,200,C,400,D,800,E,1600,F". This string
            // defines contributor levels labeled "A" through "F", with "A" standing for 0 to 99
            // (i.e., separator 100 minus one), "B" 100 through 199, "C" 200 through 399, etc.
            var contribLevels = [];

            var contributorLevelsDataList = source.split(",");
            if (contributorLevelsDataList.length === 11) {
                try {
                    var i, label, minimumSurveysNeeded;
                    for (i = 0; i < contributorLevelsDataList.length; i += 2) {
                        label = contributorLevelsDataList[i];
                        minimumSurveysNeeded = i === 0 ? 0 :
                            Number.parseInt(contributorLevelsDataList[i - 1]);
                        contribLevels.push({
                            "label": label,
                            "minimumSurveysNeeded": minimumSurveysNeeded
                        });
                    }
                } catch (ignore) {
                    // Reset the contributor levels array to empty
                    contribLevels = [];
                }
            }

            return contribLevels;
        },

        _parseSurvey: function (source, fieldDomains) {
            // e.g., <p>Is there a Structure on the Property? <b>{<font color='#0000ff'>Structure</font>} </b><b>{<span style='background-color:
            //  rgb(255, 0, 0);'>button</span>}</b></p><p><ul><li>Is the lot overgrown? <b>{Lot} </b><b>{button}</b><br /></li><li>Foundation type
            //  : <b>{<font color='#ffff00' style='background-color: rgb(255, 69, 0);'>FoundationType</font>} </b><b>{radio}</b><br /></li></ul>
            //  </p><p><b><br /></b></p><p>Is there roof damage? <b>{RoofDamage} </b><b>{button}</b></p><p>Is the exterior damaged? <b>
            //  {ExteriorDamage} </b><b>{button}</b></p><p></p><ol><li>Is there graffiti? <b>{Graffiti} </b><b>{button}</b><br /></li><li>
            //  Are there boarded windows/doors? <b>{Boarded} </b><b>{button}</b><br /></li></ol>

            //   1. split on </p> and then </li> (lists are enclosed in <p></p> sets)
            var survey = [];
            var taggedSurveyLines = [];
            var descriptionSplitP = source.split("</p>");
            $.each(descriptionSplitP, function (idx, line) {
                $.merge(taggedSurveyLines, line.split("</li>"));
            });

            //   2. remove all html tags (could have <b>, <i>, <u>, <ol>, <ul>, <li>, <a>, <font>, <span>, <br>,
            // and their closures included or explicit)
            var surveyLines = [];
            $.each(taggedSurveyLines, function (idx, line) {
                var cleanedLine = $(line).text().trim();
                if (cleanedLine.length > 0) {
                    surveyLines.push(cleanedLine);
                }
            });

            //   3. Separate into question, field, and style
            //      e.g., "Is there a Structure on the Property? {Structure} {button}"
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

        _parseAccessConfig: function (source) {//???
            // Sample content after beautifying:
            //    <div>Copyright 2015 My City</div>
            //    <div>
            //        <br />
            //    </div>
            //    <div>=== Access and use settings ===</div>
            //    <div>contribution levels:</div><span style='line-height: 1.38461538461538;'>0: Getting Started<br /></span><span style='line-height: 1.38461538461538;'>5: Beginner<br /></span><span style='line-height: 1.38461538461538;'>10: Helper<br /></span><span style='line-height: 1.38461538461538;'>15: Intermediate<br /></span><span style='line-height: 1.38461538461538;'>20: Advanced<br /></span><span style='line-height: 1.38461538461538;'>25: Wow!</span>
            //    <div>
            //        <br />
            //        <div>
            //            <div>Facebook app id: 101991193476073</div>
            //        </div>
            //        <div>Google+ client id: 884148190980-mrcnakr5q14ura5snpcbgp85ovq7s7ea.apps.googleusercontent.com</div>
            //        <div>show Twitter: true</div>
            //        <div>
            //            <br />
            //        </div>
            //        <div>
            //            <div>surveyor name field: SRVNAME</div>
            //            <div>best photo field: BSTPHOTOID</div>
            //        </div>
            //    </div>


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
