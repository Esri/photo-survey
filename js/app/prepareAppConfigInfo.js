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
define(['parseConfigInfo', 'fetchConfigInfo', 'survey'], function (parseConfigInfo, fetchConfigInfo, survey) {
    'use strict';
    var prepareAppConfigInfo;
    prepareAppConfigInfo = {

        //--------------------------------------------------------------------------------------------------------------------//

        // Available after init's parametersReady deferred
        appParams: {
            // Parameters that can be overridden by the configuration file, webmap, online app, and/or URL
            survey123: "",
            usesurvey123OrigImg: true,
            title: "",
            splashText: "",
            splashBackgroundUrl: "",
            helpText: "",
            contribLevels: [],
            proxyProgram: "",

            facebookAppId: "",
            googleplusClientId: "",
            googleplusLogoutUrl: "",
            twitterSigninUrl: "",
            twitterUserUrl: "",
            twitterCallbackUrl: "",
            allowGuestSubmissions: false,
            thumbnailLimit: "10",

            surveyorNameField: "",
            bestPhotoField: "",
            //filterDefinition: "",

            // Parameters defined here
            showFacebook: "false",
            showGooglePlus: "false",
            showTwitter: "false"
        },

        // Available after init's surveyReady deferred
        featureSvcParams: {
            url: "",
            id: "",
            objectIdField: ""
        },
        formUISvcParams:{
            url: "",
            id: "",
            objectIdField: "",
            queryString: "/query?where=1=1&objectIds=&time=&resultType=none&outFields=*&returnIdsOnly=false&returnCountOnly=false&returnDistinctValues=false&orderByFields=QORDER&groupByFieldsForStatistics=&outStatistics=&having=&resultOffset=&resultRecordCount=&sqlFormat=none&f=json"
        },
        survey: [],

        // Available after init's webmapOrigImageUrlReady deferred: event arg is URL to original image or null if no image
        // configured or if original image not found


        //--------------------------------------------------------------------------------------------------------------------//

        /**
         * Initializes the module by fetching parameters from the URL, the configuration file, and the webmap.
         * @return {object} Object with object properties parametersReady, surveyReady, webmapOrigImageUrlReady that contain
         * Deferreds for when the app's configuration parameters are ready to use, when the survey gleaned from the webmap
         * is ready to use, and when the original-size version of the webmap's thumbnail has been checked and is ready to use,
         * respectively.
         */
        init: function () {
            //var webmapParamsFetch, webmapDataFetch, webmapFetcher, paramsFromUrl, onlineAppFetch, configFileFetch;
            var survey123ParamsFetch, survey123DataFetch, survey123Fetcher, paramsFromUrl, onlineAppFetch, configFileFetch;

            // Set up external notifications for various stages of preparation
            prepareAppConfigInfo.parametersReady = $.Deferred();
            prepareAppConfigInfo.surveyReady = $.Deferred();
            prepareAppConfigInfo.survey123OrigImageUrlReady = $.Deferred();

            // Prepare for a webmap fetch as soon as we can
            survey123ParamsFetch = $.Deferred();
            survey123DataFetch = $.Deferred();
            survey123Fetcher = null;

            // Get the configuration file
            configFileFetch = fetchConfigInfo.getParamsFromConfigFile("js/configuration.json", configFileFetch);
            $.when(configFileFetch).done(function (paramsFromFile) {

                // Get the URL parameters
                paramsFromUrl = prepareAppConfigInfo.screenProperties(["survey123", "diag", "test"], fetchConfigInfo.getParamsFromUrl());

                // If webmap specified in the URL, we can start a fetch of its data now
                if (parseConfigInfo.isUsableString(paramsFromUrl.survey123)) {
                    survey123Fetcher = "url";
                    fetchConfigInfo.getParamsFromSurvey123(paramsFromFile.arcgisUrl,
                            paramsFromUrl.survey123, survey123ParamsFetch, prepareAppConfigInfo.survey123OrigImageUrlReady);
                    fetchConfigInfo.getSurvey123Data(paramsFromFile.arcgisUrl,
                            paramsFromUrl.survey123, survey123DataFetch);
                }

                // If the appId is specified in the URL, fetch its parameters; resolves immediately if no appId
                //onlineAppFetch = $.Deferred();
                // fetchConfigInfo.getParamsFromOnlineApp(paramsFromFile.arcgisUrl, paramsFromUrl.appid).done(function (data) {
                //     if (!survey123Fetcher) {
                //         if (data && data.survey123) {
                //             // Use webmap specified in online app
                //             survey123Fetcher = "online";
                //             fetchConfigInfo.getParamsFromWebmap(paramsFromFile.arcgisUrl,
                //                     data.survey123, survey123ParamsFetch, prepareAppConfigInfo.survey123OrigImageUrlReady);
                //             fetchConfigInfo.getWebmapData(paramsFromFile.arcgisUrl,
                //                     data.survey123, survey123DataFetch);
                //         }
                //     }
                //     onlineAppFetch.resolve(data);
                // });

                // Once we have config file and online app config (if any), see if we have a webmap
                $.when(onlineAppFetch).done(function (paramsFromOnline) {
                    // If webmapFetcher is still null, that means that the webmap was not specified
                    // in the URL or in the online app; try the config file
                    if (!survey123Fetcher) {
                        if (paramsFromFile.survey123) {
                            survey123Fetcher = "file";
                            fetchConfigInfo.getParamsFromSurvey123(paramsFromFile.arcgisUrl,
                                    paramsFromFile.survey123, survey123ParamsFetch, prepareAppConfigInfo.survey123OrigImageUrlReady);
                            fetchConfigInfo.getSurvey123Data(paramsFromFile.arcgisUrl,
                                    paramsFromFile.survey123, survey123DataFetch);
                        } else {
                            // We've no webmap; nothing more that can be done
                            prepareAppConfigInfo.parametersReady.resolve(false);
                            prepareAppConfigInfo.surveyReady.resolve(false);
                            prepareAppConfigInfo.survey123OrigImageUrlReady.resolve(false);
                        }
                    }

                    // Once we have the webmap, we can assemble the app parameters
                    survey123ParamsFetch.done(function (paramsFromSurvey123) {
                        // Parameters priority in increasing-importance order:
                        //  1. barebones structure appParams
                        //  2. configuration file
                        //  3. webmap
                        //  4. online app
                        //  5. URL
                        prepareAppConfigInfo.appParams = $.extend(
                            prepareAppConfigInfo.appParams,
                            paramsFromFile,
                            paramsFromSurvey123,
                            paramsFromOnline,
                            paramsFromUrl
                        );

                        // Normalize booleans
                        prepareAppConfigInfo.appParams.showGuest = prepareAppConfigInfo.toBoolean(prepareAppConfigInfo.appParams.showGuest);
                        prepareAppConfigInfo.appParams.showFacebook =
                                prepareAppConfigInfo.appParams.facebookAppId !== null && prepareAppConfigInfo.appParams.facebookAppId.length > 0;
                        prepareAppConfigInfo.appParams.showGooglePlus =
                                prepareAppConfigInfo.appParams.googleplusClientId !== null && prepareAppConfigInfo.appParams.googleplusClientId.length > 0;
                        prepareAppConfigInfo.appParams.showTwitter = prepareAppConfigInfo.toBoolean(prepareAppConfigInfo.appParams.showTwitter);
                        prepareAppConfigInfo.appParams.allowGuestSubmissions = prepareAppConfigInfo.toBoolean(prepareAppConfigInfo.appParams.allowGuestSubmissions, false);
                        prepareAppConfigInfo.appParams.thumbnailLimit = prepareAppConfigInfo.toNumber(prepareAppConfigInfo.appParams.thumbnailLimit, -1);

                        prepareAppConfigInfo.parametersReady.resolve(true);
                    }).fail(function () {
                        prepareAppConfigInfo.parametersReady.resolve(false);
                    });

                    // Once we have the webmap's data, we can try assemble the survey
                    survey123DataFetch.done(function (data) {
                        var dictionary;

                        if (data.opLayerParams && data.featureSvcParams && data.featureSvcParams.fields) {
                            prepareAppConfigInfo.featureSvcParams.url = data.opLayerParams.serviceInfo.url;
                            //Test if user has added a definition expression to the candidate layer, if so set filterDefinition value
                            //if (data.opLayerParams.hasOwnProperty('layerDefinition')){
                                //prepareAppConfigInfo.filterDefinition = data.opLayerParams.layerDefinition.definitionExpression;
                            //}
                            prepareAppConfigInfo.featureSvcParams.id = data.featureSvcParams.id;
                            prepareAppConfigInfo.featureSvcParams.objectIdField = data.featureSvcParams.objectIdField;
                            prepareAppConfigInfo.featureSvcParams.canBeUpdated = data.featureSvcParams.canBeUpdated;

                            // prepareAppConfigInfo.formUISvcParams.url = data.formUIParams.url;
                            // prepareAppConfigInfo.formUISvcParams.id = data.formUISvcParams.id;
                            // prepareAppConfigInfo.formUISvcParams.objectIdField = data.formUISvcParams.objectIdField;
                            // prepareAppConfigInfo.formUISvcParams.canBeUpdated = data.formUISvcParams.canBeUpdated;

                            // //Access Survey Form UI Config Info from Survey Questions setting table in the service
                            
                            // $.getJSON(prepareAppConfigInfo.formUISvcParams.url + 
                            //             prepareAppConfigInfo.formUISvcParams.queryString, function(results){
                            //     if (!results){
                            //         prepareAppConfigInfo.surveyReady.reject()
                            //     }
                            //     prepareAppConfigInfo.survey = survey.createSurvey(
                            //         results, data.featureSvcParams.fields);
                                
                            // });

                            prepareAppConfigInfo.surveyReady.resolve();



                        } else {
                            prepareAppConfigInfo.featureSvcParams = {};
                            prepareAppConfigInfo.survey = [];
                            prepareAppConfigInfo.surveyReady.reject();
                        }
                    }).fail(function () {
                        prepareAppConfigInfo.surveyReady.reject();
                    });
                });
            });

            return {
                parametersReady: prepareAppConfigInfo.parametersReady,
                surveyReady: prepareAppConfigInfo.surveyReady,
                survey123OrigImageUrlReady: prepareAppConfigInfo.survey123OrigImageUrlReady
            };
        },

        /**
         * Copies and returns only specified properties of the supplied object.
         * @param {array} supportedProperties List of properties to return
         * @param {object} objectToScreen Source of property data
         * @return {object} Object composed of properties from the supportedProperties list
         * with values assigned from the objectToScreen object; supportedProperties not
         * found in objectToScreen are assigned 'null'
         * @private
         */
        screenProperties: function (supportedProperties, objectToScreen) {
            var screenedObject = {};

            $.each(supportedProperties, function (ignore, param) {
                screenedObject[param] = objectToScreen[param];
            });
            return screenedObject;
        },

        /**
         * Insures that a supplied value is a number.
         * @param {number|string} numValue Item to check
         * @param {number} [defaultValue] Value to use if numValue is not a number or convertable
         * to a number from a string; if omitted, zero is used
         * @return {number} Supplied number, supplied string converted to a number, the
         * default value, or zero
         */
        toNumber: function (numValue, defaultValue) {
            var parsedNumValue;

            // Fall back to default
            if (defaultValue === undefined) {
                defaultValue = 0;
            }

            if (typeof numValue === "number") {
                return numValue;
            }

            if (typeof numValue === "string") {
                try {
                    parsedNumValue = parseInt(numValue, 10);
                    if (isNaN(parsedNumValue)) {
                        parsedNumValue = defaultValue;
                    }
                } catch (ignore) {
                    parsedNumValue = defaultValue;
                }
            } else {
                parsedNumValue = defaultValue;
            }

            return parsedNumValue;
        },

        /** Normalizes a boolean value to true or false.
         * @param {boolean|string} boolValue A true or false value that is returned directly or a string "true" or "false"
         * (case-insensitive) that is interpreted and returned; if neither a a boolean or a usable string, falls back to
         * defaultValue
         * @param {boolean} [defaultValue] A true or false that is returned if boolValue can't be used; if not defined,
         * true is returned
         * @private
         */
        toBoolean: function (boolValue, defaultValue) {
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
    return prepareAppConfigInfo;
});
