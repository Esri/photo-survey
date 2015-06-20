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

        fixedQueryParams: "&time=&geometry=&geometryType=esriGeometryEnvelope&inSR=&spatialRel=esriSpatialRelIntersects&distance=&units=esriSRUnit_Meter&returnGeometry=false&maxAllowableOffset=&geometryPrecision=&outSR=&returnExtentOnly=false&orderByFields=&groupByFieldsForStatistics=&outStatistics=&resultOffset=&resultRecordCount=&returnZ=false&returnM=false&quantizationParameters=&f=pjson",
        featureServiceUrl: null,
        featureServiceLayerId: null,
        objectIdField: null,
        validCandidateCondition: null,


        init: function (featureServiceUrl, featureServiceLayerId, objectIdField, validCandidateCondition) {
            that = this;
            that.featureServiceUrl = featureServiceUrl;
            if (that.featureServiceUrl.lastIndexOf("/") != that.featureServiceUrl.length - 1) {
                that.featureServiceUrl += "/";
            }
            that.featureServiceLayerId = featureServiceLayerId;
            that.objectIdField = objectIdField;
            that.validCandidateCondition = validCandidateCondition;
        },

        getObjectCount: function (condition) {
            var deferred = $.Deferred();

            var url = that.featureServiceUrl + "query?where=" + (condition || that.validCandidateCondition)
                + "&objectIds=&returnIdsOnly=false&returnCountOnly=true&outFields=" + that.fixedQueryParams
                + "&callback=?";
            $.getJSON(url, "jsonp", function (results) {
                if (!results || results.error) {
                    deferred.reject(-1);
                }
                deferred.resolve(results.count);
            });

            return deferred;
        },

        updateCandidate: function (candidate) {
            var deferred = $.Deferred();

            var update = "rollbackOnFailure=true&f=pjson&adds=&deletes=&id=" + that.featureServiceLayerId
                + "&updates=" + that.stringifyForApplyEdits(candidate.obj);
            var url = that.featureServiceUrl + "applyEdits";
            $.post(url, update, function (results, status) {

                //???
                // seek
                // status === "success"
                // results.updateResults[0].objectId === candidate.obj.<objectIdField>
                // results.updateResults[0].success === true


            }, "json");

            return deferred;
        },

        stringifyForApplyEdits: function (value) {
            var isFirst = true;
            var result = "";
            if (value === null) {
               result += 'null';
            } else if (typeof(value) === "string") {
                result += '%22' + value + '%22';
            } else if (typeof(value) === "object") {
                result += '%7B';
                $.each(value, function (part) {
                    if (value.hasOwnProperty(part)) {
                        result += (isFirst ? '' : '%2C') + part + '%3A' + that.stringifyForApplyEdits(value[part]);
                        isFirst = false;
                    }
                });
                result += '%7D';
            } else {
                result += value;
            }
            return result;
        },

        getCandidate: function () {
            var deferred = $.Deferred();

            // Get
            var url = that.featureServiceUrl + "query?where=" + that.validCandidateCondition
                + "&objectIds=&returnIdsOnly=true&returnCountOnly=false&outFields=" + that.fixedQueryParams
                + "&callback=?";
            $.getJSON(url, "jsonp", function (results) {
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
                var objectId = results.objectIds[ Math.floor(Math.random() * results.objectIds.length)];

                // Get the candidate's attributes
                var attributesDeferred = $.Deferred();
                var objectAttrsUrl = that.featureServiceUrl + "query?objectIds=" + objectId
                    + "&returnIdsOnly=false&returnCountOnly=false&outFields=*" + that.fixedQueryParams
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
                var attachmentsDeferred = $.Deferred();
                var objectAttachmentsUrl = that.featureServiceUrl + objectId + "/attachments?f=json&callback=?";
                $.getJSON(objectAttachmentsUrl, "jsonp", function (results) {
                    if (!results || results.error) {
                        attributesDeferred.reject();
                        return;
                    }

                    // No attachments is acceptable
                    var attachments = [];
                    if (results && results.attachmentInfos) {
                        $.each(results.attachmentInfos, function (idx, attachment) {
                            attachments.push({
                                id: attachment.id,
                                url: that.featureServiceUrl + objectId + "/attachment/" + attachment.id
                            });
                        });
                    }
                    attachmentsDeferred.resolve(attachments);
                });

                // Return the attributes and attachments
                $.when(attributesDeferred, attachmentsDeferred).done(function (attributesData, attachmentsData) {
                    deferred.resolve({
                        obj: attributesData,
                        attachments: attachmentsData
                    });
                });

            });

            return deferred;
        }

    };
});
