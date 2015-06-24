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
define(['parseConfig', 'fetchConfig'], function (parseConfig, fetchConfig) {
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

        init: function (needProxy, proxyReady) {
            that = this;
            fetchConfig.init();

            // Set up external notifications for various stages of preparation
            var parametersReady = $.Deferred();
            var surveyReady = $.Deferred();
            var webmapOrigImageUrlReady = $.Deferred();

            // Prepare for a webmap fetch as soon as we can
            var webmapParamsFetch = $.Deferred();
            var webmapDataFetch = $.Deferred();
            var webmapFetcher = null;

            // Get the URL parameters
            var paramsFromUrl = fetchConfig._getParamsFromUrl();

            // If webmap specified in the URL, we can start a fetch of its data now
            if (parseConfig._isUsableString(paramsFromUrl.webmap)) {
                webmapFetcher = "url";
                fetchConfig._getParamsFromWebmap(paramsFromUrl.webmap, webmapParamsFetch);
                fetchConfig._getWebmapData(paramsFromUrl.webmap, webmapDataFetch);
            }

            // If the appId is specified in the URL, fetch its parameters; resolves immediately if no appId
            var onlineAppFetch = $.Deferred();
            fetchConfig._getParamsFromOnlineApp(paramsFromUrl.appid).done(function (data) {
                if (!webmapFetcher) {
                    if (data && data.webmap) {
                        // Use webmap specified in online app
                        webmapFetcher = "online";
                        fetchConfig._getParamsFromWebmap(data.webmap, webmapParamsFetch);
                        fetchConfig._getWebmapData(data.webmap, webmapDataFetch);
                    }
                }
                onlineAppFetch.resolve(data);
            });

            // Get the configuration file
            var configFileFetch = fetchConfig._getParamsFromConfigFile(configFileFetch);

            // Once we have config file and online app config (if any), see if we have a webmap
            $.when(configFileFetch, onlineAppFetch).done(function (paramsFromFile, paramsFromOnline) {
                // If webmapFetcher is still null, that means that the webmap was not specified
                // in the URL or in the online app; try the config file
                if (!webmapFetcher) {
                    if (paramsFromFile.webmap) {
                        webmapFetcher = "file";
                        fetchConfig._getParamsFromWebmap(data.webmap, webmapParamsFetch);
                        fetchConfig._getWebmapData(data.webmap, webmapDataFetch);
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
                        that.appParams, paramsFromFile, paramsFromWebmap, paramsFromOnline, paramsFromUrl);

                    // Normalize booleans
                    that.appParams.showFacebook =
                        that.appParams.facebookAppId && that.appParams.facebookAppId.length > 0;
                    that.appParams.showGooglePlus =
                        that.appParams.googleplusClientId && that.appParams.googleplusClientId.length > 0;
                    that.appParams.showTwitter = parseConfig._toBoolean(that.appParams.showTwitter);

                    // If a proxy is needed, launch the test for a usable proxy
                    if (needProxy) {
                        $.getJSON(that.appParams.proxyProgram + "?ping", function () {
                            proxyReady.resolve();
                        }).fail(function () {
                            proxyReady.reject();
                        });
                    } else {
                        that.appParams.proxyProgram = null;
                        proxyReady.resolve();
                    }

                    proxyReady.done(function () {
                        // Test for the existence of the original image of the webmap's thumbnail
                        fetchConfig._getOrigImageFromWebmap(that.appParams.webmap, that.appParams.webmapImageUrl,
                            that.appParams.proxyProgram, webmapOrigImageUrlReady);
                    }).fail(function () {
                        webmapOrigImageUrlReady.reject();
                    });

                    parametersReady.resolve(true);
                });

                // Once we have the webmap's data, we can try assemble the survey
                webmapDataFetch.done(function (data) {
                    if (data.opLayerParams && data.opLayerParams.popupInfo && data.opLayerParams.popupInfo.description
                        && data.featureSvcParams && data.featureSvcParams.fields) {
                        that.featureSvcParams.url = data.opLayerParams.url;
                        that.featureSvcParams.id = data.featureSvcParams.id;
                        that.featureSvcParams.objectIdField = data.featureSvcParams.objectIdField;

                        // Create dictionary of domains
                        var dictionary = parseConfig._createSurveyDictionary(data.featureSvcParams.fields);

                        // Parse survey
                        that.survey = parseConfig._parseSurvey(data.opLayerParams.popupInfo.description, dictionary);
                        surveyReady.resolve(true);
                    } else {
                        that.featureSvcParams = {};
                        that.survey = {};
                        surveyReady.resolve(false);
                    }
                });
            });

            return {
                "parametersReady": parametersReady,
                "surveyReady" : surveyReady,
                "webmapOrigImageUrlReady": webmapOrigImageUrlReady
            };
        }

    };
});
