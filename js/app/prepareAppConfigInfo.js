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
define(['parseConfigInfo', 'fetchConfigInfo'], function (parseConfigInfo, fetchConfigInfo) {
    var that;
    return {

        //--------------------------------------------------------------------------------------------------------------------//

        // Available after init's parametersReady deferred
        appParams: {
            // Parameters that can be overridden by the configuration file, webmap, online app, and/or URL
            webmap: "",
            useWebmapOrigImg: true,
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
        survey: [],

        // Available after init's webmapOrigImageUrlReady deferred: event arg is URL to original image or null if no image
        // configured or if original image not found


        //--------------------------------------------------------------------------------------------------------------------//

        /**
         * Initializes the module by fetching parameters from the URL, the configuration file, and the webmap.
         * @return {object} Object with properties parametersReady, surveyReady, webmapOrigImageUrlReady that contain
         * Deferreds for when the app's configuration parameters are ready to use, when the survey gleaned from the webmap
         * is ready to use, and when the original-size version of the webmap's thumbnail has been checked and is ready to use,
         * respectively.
         */
        init: function () {
            var parametersReady, surveyReady, webmapOrigImageUrlReady, webmapParamsFetch, webmapDataFetch, webmapFetcher,
                paramsFromUrl, onlineAppFetch, configFileFetch;

            that = this;
            fetchConfigInfo.init();

            // Set up external notifications for various stages of preparation
            parametersReady = $.Deferred();
            surveyReady = $.Deferred();
            webmapOrigImageUrlReady = $.Deferred();

            // Prepare for a webmap fetch as soon as we can
            webmapParamsFetch = $.Deferred();
            webmapDataFetch = $.Deferred();
            webmapFetcher = null;

            // Get the URL parameters
            paramsFromUrl = that._screenProperties(["webmap", "diag"], fetchConfigInfo._getParamsFromUrl());

            // If webmap specified in the URL, we can start a fetch of its data now
            if (parseConfigInfo._isUsableString(paramsFromUrl.webmap)) {
                webmapFetcher = "url";
                fetchConfigInfo._getParamsFromWebmap(paramsFromUrl.webmap, webmapParamsFetch, webmapOrigImageUrlReady);
                fetchConfigInfo._getWebmapData(paramsFromUrl.webmap, webmapDataFetch);
            }

            // If the appId is specified in the URL, fetch its parameters; resolves immediately if no appId
            onlineAppFetch = $.Deferred();
            fetchConfigInfo._getParamsFromOnlineApp(paramsFromUrl.appid).done(function (data) {
                if (!webmapFetcher) {
                    if (data && data.webmap) {
                        // Use webmap specified in online app
                        webmapFetcher = "online";
                        fetchConfigInfo._getParamsFromWebmap(data.webmap, webmapParamsFetch, webmapOrigImageUrlReady);
                        fetchConfigInfo._getWebmapData(data.webmap, webmapDataFetch);
                    }
                }
                onlineAppFetch.resolve(data);
            });

            // Get the configuration file
            configFileFetch = fetchConfigInfo._getParamsFromConfigFile(configFileFetch);

            // Once we have config file and online app config (if any), see if we have a webmap
            $.when(configFileFetch, onlineAppFetch).done(function (paramsFromFile, paramsFromOnline) {
                // If webmapFetcher is still null, that means that the webmap was not specified
                // in the URL or in the online app; try the config file
                if (!webmapFetcher) {
                    if (paramsFromFile.webmap) {
                        webmapFetcher = "file";
                        fetchConfigInfo._getParamsFromWebmap(paramsFromFile.webmap, webmapParamsFetch, webmapOrigImageUrlReady);
                        fetchConfigInfo._getWebmapData(paramsFromFile.webmap, webmapDataFetch);
                    } else {
                        // We've no webmap; nothing more that can be done
                        parametersReady.resolve(false);
                        surveyReady.resolve(false);
                        webmapOrigImageUrlReady.resolve(false);
                    }
                }

                // Once we have the webmap, we can assemble the app parameters
                webmapParamsFetch.done(function (paramsFromWebmap) {
                    // Parameters priority in increasing-importance order:
                    //  1. barebones structure appParams
                    //  2. configuration file
                    //  3. webmap
                    //  4. online app
                    //  5. URL
                    that.appParams = $.extend(
                        that.appParams,
                        paramsFromFile,
                        paramsFromWebmap,
                        paramsFromOnline,
                        paramsFromUrl
                    );

                    // Normalize booleans
                    that.appParams.showGuest = parseConfigInfo._toBoolean(that.appParams.showGuest);
                    that.appParams.showFacebook =
                        that.appParams.facebookAppId !== null && that.appParams.facebookAppId.length > 0;
                    that.appParams.showGooglePlus =
                        that.appParams.googleplusClientId !== null && that.appParams.googleplusClientId.length > 0;
                    that.appParams.showTwitter = parseConfigInfo._toBoolean(that.appParams.showTwitter);
                    that.appParams.allowGuestSubmissions = parseConfigInfo._toBoolean(that.appParams.allowGuestSubmissions, false);
                    that.appParams.thumbnailLimit = parseConfigInfo.toNumber(that.appParams.thumbnailLimit, -1);

                    parametersReady.resolve(true);
                }).fail(function () {
                    parametersReady.resolve(false);
                });

                // Once we have the webmap's data, we can try assemble the survey
                webmapDataFetch.done(function (data) {
                    var dictionary;

                    if (data.opLayerParams && data.opLayerParams.popupInfo && data.opLayerParams.popupInfo.description
                            && data.featureSvcParams && data.featureSvcParams.fields) {
                        that.featureSvcParams.url = data.opLayerParams.url;
                        that.featureSvcParams.id = data.featureSvcParams.id;
                        that.featureSvcParams.objectIdField = data.featureSvcParams.objectIdField;
                        that.featureSvcParams.canBeUpdated = data.featureSvcParams.canBeUpdated;

                        // Create dictionary of domains
                        dictionary = parseConfigInfo._createSurveyDictionary(data.featureSvcParams.fields);

                        // Parse survey
                        that.survey = parseConfigInfo._parseSurvey(data.opLayerParams.popupInfo.description, dictionary);
                        surveyReady.resolve();
                    } else {
                        that.featureSvcParams = {};
                        that.survey = {};
                        surveyReady.reject();
                    }
                }).fail(function () {
                    surveyReady.reject();
                });
            });

            return {
                "parametersReady": parametersReady,
                "surveyReady" : surveyReady,
                "webmapOrigImageUrlReady": webmapOrigImageUrlReady
            };
        },

        /**
         * Copies and returns only specified properties of the supplied object.
         * @param {array} supportedProperties List of properties to return
         * @param {object} objectToScreen Source of property data
         * @return {object} Object composed of properties from the supportedProperties list
         * with values assigned from the objectToScreen object; supportedProperties not
         * found in objectToScreen are assigned 'null'
         * @memberOf js.LGDropdownBox#
         */
        _screenProperties: function (supportedProperties, objectToScreen) {
            var screenedObject = {};

            $.each(supportedProperties, function (indexInArray, param) {
                screenedObject[param] = objectToScreen[param];
            });
            return screenedObject;
        }

    };
});
