/*global define,$,window */
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
define(['parseConfigInfo'], function (parseConfigInfo) {
    'use strict';
    var fetchConfigInfo = {

        //--------------------------------------------------------------------------------------------------------------------//

        /**
         * Initializes the module and its dependency 'parseConfigInfo'.
         */
        init: function () {
            parseConfigInfo.init();
        },

        //--------------------------------------------------------------------------------------------------------------------//

        /**
         * Extracts parameters from app's location URL.
         * @return {object} Parameters and values; a value is null if the parameter does not have a value assignment in the URL
         */
        getParamsFromUrl: function () {
            var params = {}, paramsString = window.location.search;
            if (paramsString.length > 0 && paramsString[0] === "?") {
                paramsString = paramsString.substring(1).split("&");
                $.map(paramsString, function (item) {
                    var paramParts = item.split("=");
                    params[paramParts[0].toLowerCase()] = paramParts[1] || null;
                });
            }
            return params;
        },

        /**
         * Extracts parameters from app's configuration file "js/configuration.json".
         * @param {object} [deferred] Deferred to use for fetch notification; if not supplied, function creates one
         * @return {object} Deferred indicating when parameters are ready; successful resolution includes object with
         * file's contents
         */
        getParamsFromConfigFile: function (deferred) {
            var filename = "js/configuration.json";
            if (!deferred) {
                deferred = $.Deferred();
            }

            $.getJSON(filename, function (data) {
                deferred.resolve((data && data.values) || {});
            });

            return deferred;
        },

        /**
         * Extracts parameters from app in the ArcGIS Online environment.
         * @param {string} appId AGOL id of application
         * @param {object} [deferred] Deferred to use for fetch notification; if not supplied, function creates one
         * @return {object} Deferred indicating when parameters are ready; successful resolution includes object with
         * app's data section contents
         */
        getParamsFromOnlineApp: function (appId, deferred) {
            if (!deferred) {
                deferred = $.Deferred();
            }

            if (parseConfigInfo.isUsableString(appId)) {
                $.getJSON("http://www.arcgis.com/sharing/content/items/"
                        + appId + "/data?f=json&callback=?", "jsonp", function (data) {
                    deferred.resolve((data && data.values) || {});
                });
            } else {
                deferred.resolve({});
            }

            return deferred;
        },

        /**
         * Extracts parameters from webmap.
         * @param {string} webmapId Id of webmap
         * @param {object} [paramsDeferred] Deferred to use for parameters fetch notification; if not supplied, function
         * creates one
         * @param {object} [origImageUrlDeferred] Deferred to use for original-size version of the webmap's thumbnail fetch
         * notification; if not supplied, function creates one
         * @return {object} Object with properties params and origImageUrl that contain the supplied (or created)
         * paramsDeferred and origImageUrlDeferred Deferreds, respectively, for when the app's configuration parameters are
         * ready to use and when the original-size version of the webmap's thumbnail has been checked and is ready to use;
         * successful resolution of 'params' includes object with title, splashText, helpText, contribLevels,
         * surveyorNameField, bestPhotoField; successful resolution of 'origImageUrl' contains the URL of the original-size
         * image.
         */
        getParamsFromWebmap: function (webmapId, paramsDeferred, origImageUrlDeferred) {
            var deferreds = {};
            deferreds.params = paramsDeferred || $.Deferred();
            deferreds.origImageUrl = origImageUrlDeferred || $.Deferred();

            if (parseConfigInfo.isUsableString(webmapId)) {
                $.getJSON("http://www.arcgis.com/sharing/content/items/" + webmapId + "?f=json&callback=?", "jsonp", function (data) {
                    var normalizedData = {}, imageUrl, iExt;
                    if (!data || data.error) {
                        deferreds.params.reject();
                        deferreds.origImageUrl.resolve();
                        return;
                    }

                    normalizedData.title = data.title;
                    normalizedData.splashText = data.snippet;
                    normalizedData.helpText = data.description;
                    normalizedData = $.extend(normalizedData, parseConfigInfo.parseAccessConfig(data.licenseInfo));
                    deferreds.params.resolve(normalizedData);

                    // See if we can get an original-size image
                    imageUrl = data.thumbnail;
                    if (imageUrl) {
                        iExt = imageUrl.lastIndexOf(".");
                        if (iExt >= 0) {
                            imageUrl = imageUrl.substring(0, iExt) + "_orig" + imageUrl.substr(iExt);
                        } else {
                            imageUrl = imageUrl + "_orig";
                        }
                        imageUrl = "http://www.arcgis.com/sharing/content/items/" + webmapId + "/info/" + imageUrl;

                        // Test that this URL is valid
                        fetchConfigInfo.testURL(imageUrl, function (isOK) {
                            deferreds.origImageUrl.resolve(isOK
                                ? imageUrl
                                : null);
                        });
                    } else {
                        deferreds.origImageUrl.resolve();
                    }
                });
            } else {
                deferreds.params.resolve({});
                deferreds.origImageUrl.resolve();
            }

            return deferreds;
        },

        /**
         * Gets operational layer and feature service information from parameters in webmap's data section.
         * @param {string} webmapId Id of webmap
         * @param {object} [deferred] Deferred to use for fetch notification; if not supplied, function
         * creates one
         * @return {object} Deferred indicating when service information is ready; successful resolution includes object with
         * opLayerParams and featureSvcParams
         */
        getWebmapData: function (webmapId, deferred) {
            if (!deferred) {
                deferred = $.Deferred();
            }

            if (parseConfigInfo.isUsableString(webmapId)) {
                $.getJSON("http://www.arcgis.com/sharing/content/items/" + webmapId + "/data?f=json&callback=?", "jsonp", function (data) {
                    var featureSvcData = {};

                    if (data && data.operationalLayers && data.operationalLayers.length > 0) {
                        featureSvcData.opLayerParams = data.operationalLayers[0];

                        // Get the app's webmap's feature service's data
                        fetchConfigInfo.getFeatureSvcData(featureSvcData.opLayerParams.url).done(function (data) {
                            if (!data || data.error) {
                                deferred.reject();
                            }
                            featureSvcData.featureSvcParams = data;
                            deferred.resolve(featureSvcData);
                        });
                    } else {
                        deferred.resolve({});
                    }
                });
            } else {
                deferred.resolve({});
            }

            return deferred;
        },


        /**
         * Gets feature service information.
         * @param {string} featureSvcUrl URL to feature service
         * @param {object} [deferred] Deferred to use for fetch notification; if not supplied, function
         * creates one
         * @return {object} Deferred indicating when service information is ready; successful resolution includes object with
         * data from feature service's main section
         */
        getFeatureSvcData: function (featureSvcUrl, deferred) {
            if (!deferred) {
                deferred = $.Deferred();
            }

            if (parseConfigInfo.isUsableString(featureSvcUrl)) {
                $.getJSON(featureSvcUrl + "?f=json&callback=?", "jsonp", function (data) {
                    data.canBeUpdated = data.capabilities && data.capabilities.indexOf("Update") >= 0;
                    deferred.resolve(data);
                });
            } else {
                deferred.resolve({});
            }

            return deferred;
        },

        /**
         * Makes a HEAD call to a URL to see if it is a valid URL.
         * @param {string} url URL to test
         * @param {function} callback Function to call upon response from test; function gets boolean parameter indicating
         * if the HEAD call succeeded or not
         * @private
         */
        testURL: function (url, callback) {
            // Shield the call--a cross-domain call in IE9 sporadically breaks with "Access refused"
            try {
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
            } catch (ignore) {
                callback(false);
            }
        }

    };
    return fetchConfigInfo;
});
