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
define(['diag'], function (diag) {
    'use strict';
    var dataAccess;
    dataAccess = {

        fixedQueryParams: "&time=&geometry=&geometryType=esriGeometryEnvelope&inSR=&spatialRel=esriSpatialRelIntersects&distance=&units=esriSRUnit_Meter&returnGeometry=false&maxAllowableOffset=&geometryPrecision=&outSR=&returnExtentOnly=false&orderByFields=&groupByFieldsForStatistics=&outStatistics=&resultOffset=&resultRecordCount=&returnZ=false&returnM=false&quantizationParameters=&f=pjson",
        featureServiceUrl: null,
        featureServiceLayerId: null,
        objectIdField: null,
        validCandidateCondition: null,
        proxyProgram: null,

        //--------------------------------------------------------------------------------------------------------------------//

        /**
         * Initializes the module.
         * @param {string} featureServiceUrl URL to feature service providing data
         * @param {number} featureServiceLayerId Id that the feature layer reports as its id
         * @param {string} objectIdField Field that the feature layer reports as its objectIdField
         * @param {string} validCandidateCondition Query 'where' clause to use to get survey candidates, e.g.,
         * "SRVNAME+is+null+or+SRVNAME=''", where SRVNAME is the name of the field used to store the name of the surveyor
         * @param {string} proxyProgram Path to the app's proxy, usually defined in the js/configuration.json file, e.g.,
         * "proxy/proxy.ashx"; use null if browser doesn't need proxy to query and update feature service (at this time,
         * only IE9 needs the proxy)
         */
        init: function (featureServiceUrl, featureServiceLayerId, objectIdField, validCandidateCondition, proxyProgram) {
            dataAccess.featureServiceUrl = featureServiceUrl;
            if (dataAccess.featureServiceUrl.lastIndexOf("/") !== dataAccess.featureServiceUrl.length - 1) {
                dataAccess.featureServiceUrl += "/";
            }
            dataAccess.featureServiceLayerId = featureServiceLayerId;
            dataAccess.objectIdField = objectIdField;
            dataAccess.validCandidateCondition = validCandidateCondition;
            dataAccess.proxyProgram = proxyProgram;
        },

        /**
         * Gets the number of features satisfying a condition.
         * @param {string} [condition] Condition to test; if omitted, the validCandidateCondition provided to this module's
         * init() function is used; a sample condition is "SRVNAME='" + username + "'", where SRVNAME is the name of the
         * field used to store the name of the surveyor, to count how many surveys the user given by 'username' has completed
         * @return {object} Deferred to provide count when it arrives; a count of -1 is used to flag an error
         */
        getObjectCount: function (condition) {
            var deferred, url;
            deferred = $.Deferred();

            url = dataAccess.featureServiceUrl + "query?where=" + (condition || dataAccess.validCandidateCondition)
                    + "&objectIds=&returnIdsOnly=false&returnCountOnly=true&outFields=" + dataAccess.fixedQueryParams
                    + "&callback=?";
            $.getJSON(url, "jsonp", function (results) {
                if (!results || results.error) {
                    deferred.reject(-1);
                }
                diag.appendWithLF("surveys " + (condition
                    ? "for \"" + condition + "\""
                    : "available") + ": " + results.count);
                deferred.resolve(results.count);
            });

            return deferred;
        },

        /**
         * Gets a survey candidate from the list of available unsurveyed candidates.
         * @param {boolean} [randomizeSelection] Indicates if a feature should be selected randomly from the list of available
         * features;  if omitted or false, the first available feature in the list of object ids returned by the feature
         * service is used
         * @return {object} Deferred indicating when candidate is ready; successful resolution includes object with
         * obj and attachments properties; 'obj' contains an attributes property with the candidate's attributes and
         * attachments contains an array containing objects each of which describes an attachment using id and url properties
         */
        getCandidate: function (randomizeSelection) {
            var deferred, url;
            deferred = $.Deferred();

            // Get the ids of available unsurveyed candidates
            url = dataAccess.featureServiceUrl + "query?where=" + dataAccess.validCandidateCondition
                    + "&objectIds=&returnIdsOnly=true&returnCountOnly=false&outFields=" + dataAccess.fixedQueryParams
                    + "&callback=?";
            $.getJSON(url, "jsonp", function handleCandidatesClosure (results) {
                dataAccess.handleCandidates(results, randomizeSelection, deferred);
            });

            return deferred;
        },

        handleCandidates: function (results, randomizeSelection, deferred) {
            var objectId, attributesDeferred, objectAttrsUrl, attachmentsDeferred, objectAttachmentsUrl;

            if (!results || results.error) {
                deferred.reject({
                    obj: null,
                    attachments: []
                });
                return;
            }
            if (results.objectIds.length === 0) {
                deferred.resolve({
                    obj: null,
                    attachments: []
                });
                return;
            }

            // Pick a candidate from amongst the available
            objectId = randomizeSelection
                ? results.objectIds[Math.floor(Math.random() * results.objectIds.length)]
                : results.objectIds[0];

            // Get the candidate's attributes
            attributesDeferred = $.Deferred();
            objectAttrsUrl = dataAccess.featureServiceUrl + "query?objectIds=" + objectId
                    + "&returnIdsOnly=false&returnCountOnly=false&outFields=*" + dataAccess.fixedQueryParams
                    + "&callback=?";
            $.getJSON(objectAttrsUrl, "jsonp", function (results) {
                // No attributes is a problem
                if (!results || results.error || !results.features || results.features.length === 0) {
                    attributesDeferred.reject();
                    return;
                }

                attributesDeferred.resolve(results.features[0]);
            });

            // Get the candidate's attachments
            attachmentsDeferred = $.Deferred();
            objectAttachmentsUrl = dataAccess.featureServiceUrl + objectId + "/attachments?f=json&callback=?";
            $.getJSON(objectAttachmentsUrl, "jsonp", function (results) {
                var attachments = [];

                if (!results || results.error) {
                    attachmentsDeferred.reject();
                    return;
                }

                // Empty list of attachments is possible
                if (results && results.attachmentInfos) {

                    attributesDeferred.done(function (feature) {
                        // Watch for request to reverse order of attachments
                        var doReversal = false;
                        if (feature && feature.attributes && feature.attributes.REVERSE) {
                            doReversal = dataAccess.toBoolean(feature.attributes.REVERSE, false);
                        }

                        // Build list of attachments
                        if (doReversal) {
                            results.attachmentInfos.reverse();
                        }
                        $.each(results.attachmentInfos, function (ignore, attachment) {
                            attachments.push({
                                id: attachment.id,
                                url: dataAccess.featureServiceUrl + objectId + "/attachments/" + attachment.id
                            });
                        });
                        attachmentsDeferred.resolve(attachments);
                    }).fail(function () {
                        attachmentsDeferred.reject();
                    });
                } else {
                    attachmentsDeferred.resolve(attachments);
                }
            });

            // Return the attributes and attachments
            $.when(attributesDeferred, attachmentsDeferred).done(function (attributesData, attachmentsData) {
                deferred.resolve({
                    obj: attributesData,
                    attachments: attachmentsData
                });
            });

        },

        /**
         * Updates a candidate to its feature service.
         * @param {object} candidate Candidate to write to its feature service; contains object with obj property; 'obj'
         * contains an attributes property with the candidate's attributes; only the 'obj' property is used; any other
         * properties in 'candidate' are ignored
         * @return {object} Deferred to provide information about success or failure of update
         */
        updateCandidate: function (candidate) {
            var deferred, url, update;
            deferred = $.Deferred();

            update = "f=json&id=" + dataAccess.featureServiceLayerId + "&updates=%5B" + dataAccess.stringifyForApplyEdits(candidate.obj) + "%5D";
            url = (dataAccess.proxyProgram
                ? dataAccess.proxyProgram + "?"
                : "") + dataAccess.featureServiceUrl + "applyEdits";
            $.post(url, update, function (results, status) {
                // seek
                //   * status === "success"
                //   * results.updateResults[0].objectId === candidate.obj[dataAccess.objectIdField]
                //   * results.updateResults[0].success === true
                diag.append("update obj #" + candidate.obj.attributes[dataAccess.objectIdField] + " result: ");
                if (status === "success" && results && results.updateResults.length > 0) {
                    if (results.updateResults[0].success === true
                            && results.updateResults[0].objectId === candidate.obj.attributes[dataAccess.objectIdField]) {
                        diag.appendWithLF("OK");
                        deferred.resolve();
                    } else if (results.updateResults[0].error) {
                        diag.appendWithLF("fail #" + results.updateResults[0].error.code
                                + " (" + results.updateResults[0].error.description + ")");
                        deferred.reject();
                    } else {
                        diag.appendWithLF("unspecified fail");
                        deferred.reject();
                    }
                } else {
                    diag.appendWithLF("overall fail: " + status);
                    deferred.reject();
                }
            }, "json").fail(function (err) {
                // Unable to POST; can be IE 9 proxy problem
                diag.appendWithLF("update obj #" + candidate.obj.attributes[dataAccess.objectIdField]
                        + " POST fail: " + JSON.stringify(err) + "; failing URL: " + url);
                deferred.reject();
            });

            return deferred;
        },

        //--------------------------------------------------------------------------------------------------------------------//

        /**
         * Converts a value into the escaped form required by updates to a feature service.
         * @param {null|string|object} value Value to escape
         * @return {string} Escaped value
         * @private
         */
        stringifyForApplyEdits: function (value) {
            var isFirst = true, result = "";

            if (value === null) {
                result += 'null';
            } else if (typeof value === "string") {
                result += '%22' + value + '%22';
            } else if (typeof value === "object") {
                result += '%7B';
                $.each(value, function (part) {
                    if (value.hasOwnProperty(part)) {
                        result += (isFirst
                            ? ''
                            : '%2C') + part + '%3A' + dataAccess.stringifyForApplyEdits(value[part]);
                        isFirst = false;
                    }
                });
                result += '%7D';
            } else {
                result += value;
            }
            return result;
        },

        /** Normalizes a boolean value to true or false.
         * @param {boolean|string} boolValue A true or false value that is returned directly or a string
         * "true", "t", "yes", "y", "false", "f", "no", "n" (case-insensitive) or a number (0 for false; non-zero for true)
         * that is interpreted and returned; if neither a boolean nor a usable string nor a number, falls back to defaultValue
         * @param {boolean} [defaultValue] A true or false that is returned if boolValue can't be used; if not defined, true
         * is returned
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
                if (lowercaseValue === "true" || lowercaseValue === "t" || lowercaseValue === "yes" || lowercaseValue === "y" || lowercaseValue === "1") {
                    return true;
                }
                if (lowercaseValue === "false" || lowercaseValue === "f" || lowercaseValue === "no" || lowercaseValue === "n" || lowercaseValue === "0") {
                    return false;
                }
            } else if (typeof boolValue === "number") {
                return boolValue !== 0;
            }
            // Fall back to default
            if (defaultValue === undefined) {
                return true;
            }
            return defaultValue;
        }

    };
    return dataAccess;
});
