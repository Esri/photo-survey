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

        fixedQueryParams: "&time=&geometry=&geometryType=esriGeometryEnvelope&inSR=&spatialRel=esriSpatialRelIntersects&distance=&units=esriSRUnit_Meter&returnGeometry=true&maxAllowableOffset=&geometryPrecision=&returnExtentOnly=false&orderByFields=&groupByFieldsForStatistics=&outStatistics=&resultOffset=&resultRecordCount=&returnZ=false&returnM=false&quantizationParameters=&f=json&outSR=4326",
        featureServiceUrl: null,
        featureServiceLayerId: null,
        objectIdField: null,
        validCandidateCondition: null,
        proxyProgram: null,
        exclusionList: {},

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
         * Adds an item to the to-be-skipped list.
         * @param {number} item Object to be skipped; NOP if already in the list
         */
        addItemToExclusionList: function (item) {
            dataAccess.exclusionList[item] = true;
        },

        /**
         * Checks if an item is in the to-be-skipped list.
         * @param {number} item Object to be checked
         * @return {boolean} True if item is in list
         */
        isItemInExclusionList: function (item) {
            return dataAccess.exclusionList.hasOwnProperty(item);
        },

        /**
         * Empties the to-be-skipped list.
         */
        resetExclusionList: function () {
            dataAccess.exclusionList = {};
        },

        /**
         * Returns a list that doesn't include the items in the to-be-skipped list.
         * @param {array} itemList List to be filtered
         * @return {array} Filtered list
         */
        filterList: function (itemList) {
            return $.grep(itemList, function (element) {
                return !dataAccess.isItemInExclusionList(element);
            });
        },

        /**
         * Selects an item from a list of items; selection is subject to an exclusion limitation.
         * @param {array} itemList List of items to choose from
         * @param {boolean} randomizeSelection True if pseudorandom selection should be used
         * @return {object} Selected item or null if list is empty or only contains items
         * that are also in the skip list
         */
        pickFromList: function (itemList, randomizeSelection) {
            var item = null, filteredItems;

            if (itemList.length > 0) {
                filteredItems = dataAccess.filterList(itemList);
                if (filteredItems.length > 0) {
                    // Pick a candidate from amongst the available
                    item = randomizeSelection
                        ? filteredItems[Math.floor(Math.random() * filteredItems.length)]
                        : filteredItems[0];
                }
            }

            return item;
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
            $.getJSON(url, function handleObjectCountClosure(results) {
                dataAccess.handleObjectCount(results, deferred, condition);
            });

            return deferred;
        },

        /**
         * Handles the callback for an object-count query.
         * @param {object} results Results provided by callback; .error if there's an error; .count contains count
         * otherwise
         * @param {object} deferred Deferred to receive results of interpreting results
         * @param {string} condition Condition used in query for diagnostic display
         */
        handleObjectCount: function (results, deferred, condition) {
            if (!results || results.error) {
                deferred.reject(-1);
            }
            diag.appendWithLF("surveys " + (condition
                ? "for \"" + condition + "\""
                : "available") + ": " + results.count);
            deferred.resolve(results.count);
        },

        /**
         * Gets a survey candidate from the list of available unsurveyed candidates.
         * @param {boolean} [randomizeSelection] Indicates if a feature should be selected randomly from the list of available
         * features;  if omitted or false, the first available feature in the list of object ids returned by the feature
         * service is used
         * @return {object} Deferred indicating when candidate is ready; successful resolution includes object with
         * obj and attachments properties; 'obj' contains an attributes property with the candidate's attributes and
         * attachments contains an array containing objects each of which describes an attachment using id and url properties;
         * if there are no more candidates, deferred resolves successfully but with 'obj'=null and 'attachments'=[]; if
         * the fetch fails, the deferred resolves with a failure
         */
        getCandidate: function (randomizeSelection) {
            var deferred, url;
            deferred = $.Deferred();

            // Get the ids of available unsurveyed candidates
            url = dataAccess.featureServiceUrl + "query?where=" + dataAccess.validCandidateCondition
                    + "&objectIds=&returnIdsOnly=true&returnCountOnly=false&outFields=" + dataAccess.fixedQueryParams
                    + "&callback=?";
            $.getJSON(url, function handleCandidatesClosure(results) {
                dataAccess.handleCandidates(results, randomizeSelection, deferred);
            });

            return deferred;
        },

        handleCandidates: function (results, randomizeSelection, deferred) {
            var objectId;

            if (!results || results.error) {
                deferred.reject({
                    id: null,
                    obj: null,
                    attachments: []
                });
                return;
            }

            // Pick a candidate from amongst the available
            objectId = dataAccess.pickFromList(results.objectIds, randomizeSelection);

            // No more surveys!
            if (objectId === null) {
                deferred.resolve({
                    id: null,
                    obj: null,
                    attachments: []
                });
                return;
            }

            // Get its info
            dataAccess.getCandidateInfo(objectId, deferred);
        },

        getCandidateInfo: function (objectId, deferred) {
            var attributesDeferred, objectAttrsUrl, attachmentsDeferred, objectAttachmentsUrl;

            // Get the candidate's attributes
            attributesDeferred = $.Deferred();
            objectAttrsUrl = dataAccess.featureServiceUrl + "query?objectIds=" + objectId
                    + "&returnIdsOnly=false&returnCountOnly=false&outFields=*" + dataAccess.fixedQueryParams
                    + "&callback=?";
            $.getJSON(objectAttrsUrl, function handleCandidateAttrsClosure(results) {
                dataAccess.handleCandidateAttrs(results, attributesDeferred);
            });

            // Get the candidate's attachments
            attachmentsDeferred = $.Deferred();
            objectAttachmentsUrl = dataAccess.featureServiceUrl + objectId + "/attachments?f=json&callback=?";
            $.getJSON(objectAttachmentsUrl, function handleCandidateAttachmentsClosure(results) {
                dataAccess.handleCandidateAttachments(objectId, results, attributesDeferred, attachmentsDeferred);
            });

            // Return the attributes and attachments
            $.when(attributesDeferred, attachmentsDeferred).then(function (attributesData, attachmentsData) {
                deferred.resolve({
                    id: objectId,
                    obj: attributesData,
                    attachments: attachmentsData
                });
            }, function () {
                deferred.reject();
            });
        },

        handleCandidateAttrs: function (results, attributesDeferred) {
            // No attributes is a problem
            if (!results || results.error || !results.features || results.features.length === 0) {
                attributesDeferred.reject();
                return;
            }

            attributesDeferred.resolve(results.features[0]);
        },

        handleCandidateAttachments: function (objectId, results, attributesDeferred, attachmentsDeferred) {
            var attachments = [];

            if (!results || results.error) {
                attachmentsDeferred.resolve(null);
                return;
            }

            // Empty list of attachments is possible
            if (results && results.attachmentInfos) {

                attributesDeferred.then(function (feature) {
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
                }, function () {
                    attachmentsDeferred.resolve(null);
                });
            } else {
                attachmentsDeferred.resolve(attachments);
            }
        },

        /**
         * Updates a candidate to its feature service.
         * @param {object} candidate Candidate to write to its feature service; contains object with obj property; 'obj'
         * contains an attributes property with the candidate's attributes; only the 'obj' property is used; any other
         * properties in 'candidate' are ignored
         * @return {object} Deferred to provide information about success or failure of update
         */
        updateCandidate: function (candidate) {
            var deferred, url, update, updatePacket;
            deferred = $.Deferred();

            // Create update content from attributes only--we don't need or want to send coordinates
            updatePacket = {
                attributes: candidate.obj.attributes
            };
            update = "f=json&id=" + dataAccess.featureServiceLayerId + "&updates=%5B" + dataAccess.stringifyForApplyEdits(updatePacket) + "%5D";

            // POST the update
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
                result += '%22' + encodeURIComponent(value) + '%22';
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
