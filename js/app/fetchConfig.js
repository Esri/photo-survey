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
define(['parseConfig'], function (parseConfig) {
    var that;
    return {

        //--------------------------------------------------------------------------------------------------------------------//

        init: function () {
            that = this;
            parseConfig.init();
        },

        //--------------------------------------------------------------------------------------------------------------------//

        _getParamsFromUrl: function () {
            var params = {}, paramsString = window.location.search;
            if (paramsString.length > 0 && paramsString[0] === "?") {
                paramsString = paramsString.substring(1).split("&");
                $.map(paramsString, function (item, index) {
                    var paramParts = item.split("=");
                    params[paramParts[0].toLowerCase()] = paramParts[1] || null;
                });
            }
            return params;
        },

        _getParamsFromConfigFile: function (deferred) {
            var filename = "js/configuration.json";
            deferred = deferred || $.Deferred();

            $.getJSON(filename, function (data) {
                deferred.resolve((data && data.values) || {});
            });

            return deferred;
        },

        _getParamsFromOnlineApp: function (appId, deferred) {
            if (!deferred) {
                deferred = $.Deferred();
            }

            if (parseConfig._isUsableString(appId)) {
                $.getJSON("http://www.arcgis.com/sharing/content/items/" + appId + "/data?f=json&callback=?", "jsonp", function (data) {
                    deferred.resolve((data && data.values) || {});
                });
            } else {
                deferred.resolve({});
            }

            return deferred;
        },

        _getParamsFromWebmap: function (webmapId, deferred) {
            deferred = deferred || $.Deferred();

            if (parseConfig._isUsableString(webmapId)) {
                $.getJSON("http://www.arcgis.com/sharing/content/items/" + webmapId + "?f=json&callback=?", "jsonp", function (data) {
                    var normalizedData = {};
                    normalizedData.title = data.title;
                    normalizedData.splashText = data.snippet;
                    normalizedData.helpText = data.description;
                    normalizedData.webmapImageUrl = data.thumbnail;
                    normalizedData = $.extend(normalizedData, parseConfig._parseAccessConfig(data.licenseInfo));
                    deferred.resolve(normalizedData);
                });
            } else {
                deferred.resolve({});
            }

            return deferred;
        },

        _getOrigImageFromWebmap: function (webmapId, webmapImageUrl, proxyProgram, deferred) {
            deferred = deferred || $.Deferred();

            if (parseConfig._isUsableString(webmapId) && parseConfig._isUsableString(webmapImageUrl)) {
                // See if we can get an original-size image
                imageUrl = webmapImageUrl;
                if (imageUrl) {
                    iExt = imageUrl.lastIndexOf(".");
                    if (iExt >= 0) {
                        imageUrl = imageUrl.substring(0, iExt) + "_orig" + imageUrl.substr(iExt);
                    } else {
                        imageUrl = imageUrl + "_orig";
                    }
                    imageUrl = (proxyProgram ? proxyProgram + "?" : "")
                        + "http://www.arcgis.com/sharing/content/items/" + webmapId + "/info/" + imageUrl;

                    that._testURL(imageUrl, function (isOK) {
                        deferred.resolve(isOK ? imageUrl : null);
                    });
                } else {
                    deferred.resolve();
                }
            } else {
                deferred.resolve({});
            }

            return deferred;
        },

        _getWebmapData: function (webmapId, deferred) {
            if (!deferred) {
                deferred = $.Deferred();
            }

            if (parseConfig._isUsableString(webmapId)) {
                $.getJSON("http://www.arcgis.com/sharing/content/items/" + webmapId + "/data?f=json&callback=?", "jsonp", function (data) {
                    var featureSvcData = {};

                    if (data && data.operationalLayers && data.operationalLayers.length > 0) {
                        featureSvcData.opLayerParams = data.operationalLayers[0];

                        // Get the app's webmap's feature service's data
                        that._getFeatureSvcData(featureSvcData.opLayerParams.url).done(function (data) {
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

        _getFeatureSvcData: function (featureSvcUrl, deferred) {
            if (!deferred) {
                deferred = $.Deferred();
            }

            if (parseConfig._isUsableString(featureSvcUrl)) {
                $.getJSON(featureSvcUrl + "?f=json&callback=?", "jsonp", function (data) {
                    deferred.resolve(data);
                });
            } else {
                deferred.resolve({});
            }

            return deferred;
        },

        _testURL: function (url, callback) {
            // Shield the call--a cross-domain call in IE9 sporadically breaks with "Access refused"
            try {
                $.ajax({
                    type: 'HEAD',
                    url: url,
                    success: function () {
                        callback(true);
                    },
                    error: function (err) {
                        callback(false);
                    }
                });
            } catch (err) {
                callback(false);
            }
        }

    };
});
