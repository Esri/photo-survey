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

        /**
         * Initializes the module.
         */
        init: function () {
            that = this;
        },

        /**
         * Parses HTML text such as appears in a webmap's feature layer's popup to generate a set of survey questions.
         * @param {string} source Text from source
         * @param {object} fieldDomains List of field domains and field required/optional state as created by function
         * _createSurveyDictionary using the 'fields' property of a feature service
         * @return {array} List of survey question objects, each of which contains question, field, style, domain, important
         * properties
         */
        _parseSurvey: function (source, fieldDomains) {
            // Survey is written as a series of lines in the popup. Each line is expected to have arbitrary text followed by
            // a feature layer field name in braces followed by a question style flag also in braces.
            // Here is a sample source:
            //  <p>Is there a Structure on the Property? <b>{<font color='#0000ff'>Structure</font>} </b><b>{<span
            //  style='background-color:rgb(255, 0, 0);'>button</span>}</b></p><p><ul><li>Is the lot overgrown? <b>{Lot}
            //  </b><b>{button}</b><br /></li><li>Foundation type: <b>{<font color='#ffff00' style='background-color:
            //  rgb(255, 69, 0);'>FoundationType</font>} </b><b>{radio}</b><br /></li></ul></p><p><b><br /></b></p><p>Is
            //  there roof damage? <b>{RoofDamage} </b><b>{button}</b></p><p>Is the exterior damaged? <b>{ExteriorDamage}
            //  </b><b>{button}</b></p><p></p><ol><li>Is there graffiti? <b>{Graffiti} </b><b>{button}</b><br /></li><li>
            //  Are there boarded windows/doors? <b>{Boarded} </b><b>{button}</b><br /></li></ol>
            var survey = [], descriptionSplit1, descriptionSplit2, descriptionSplit3, taggedSurveyLines, surveyLines;

            // 1. split on <div>, <p>, <br />, and <li>, all of which could be used to separate lines
            descriptionSplit2 = [];
            descriptionSplit3 = [];
            taggedSurveyLines = [];
            descriptionSplit1 = source.split("<div>");
            $.each(descriptionSplit1, function (idx, line) {
                $.merge(descriptionSplit2, line.split("<p>"));
            });
            $.each(descriptionSplit2, function (idx, line) {
                $.merge(descriptionSplit3, line.split("<br />"));
            });
            $.each(descriptionSplit3, function (idx, line) {
                $.merge(taggedSurveyLines, line.split("<li>"));
            });

            // 2. remove all html tags (could have <b>, <i>, <u>, <ol>, <ul>, <li>, <a>, <font>, <span>, <br>,
            // and their closures included or explicit)
            surveyLines = [];
            $.each(taggedSurveyLines, function (idx, line) {
                var cleanedLine = that._textOnly(line).trim();
                if (cleanedLine.length > 0) {
                    surveyLines.push(cleanedLine);
                }
            });

            // 3. Separate into question, field, and style
            // e.g., "Is there a Structure on the Property? {Structure} {button}"
            $.each(surveyLines, function (idx, line) {
                var paramParts, trimmedParts, fieldName, surveyQuestion;
                paramParts = line.split("{");
                trimmedParts = [];
                $.each(paramParts, function (idx, part) {
                    var trimmed = part.replace("}", "").trim();
                    if (trimmed.length > 0) {
                        trimmedParts.push(trimmed);
                    }
                });

                // Should have three parts now: question, field, style; we can add in the question's
                // domain and importance from the fieldDomain dictionary created just above
                if (trimmedParts.length === 3) {
                    fieldName = trimmedParts[1];
                    if (fieldDomains[fieldName]) {
                        surveyQuestion = {
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

        /**
         * Parses HTML text such as appears in an AGOL item's description to extract a set of configuration parameters.
         * @param {string} source Text from source
         * @return {object} Configuration properties contribLevels (an array of objects with properties label and
         * minimumSurveysNeeded), surveyorNameField, bestPhotoField properties
         */
        _parseAccessConfig: function (source) {
            // Access information is written as a series of lines in the webmap's description. Each line is de-HTMLed, then
            // each is checked until the text "=== Access and use settings ===" is found; this marks the start of the
            // configuration section to permit free text in the description before the configuration. In the configuration
            // section, each line is checked for the presence of the current tag out of the list ["0", "1", "2", "3", "4", "5",
            // "surveyor", "photo"]; if it matches, the line is split on ':', the content to the right of the colon is
            // considered the  parameter value, and the "current tag" becomes the next one in the list. If the current tag is
            // not found in the line, the line is skipped. By forcing this order, the app doesn't have to check all tags for
            // each line.
            // Here is a sample source:
            //  <div>Copyright 2015 My City</div><div><br /></div><div>=== Access and use settings ===</div><div><br />
            //  </div><div>contribution star levels:</div><div>0: Getting Started @0</div><div>1: Beginner @5</div><div>2:
            //  Helper @10</div><div>3: Intermediate @15</div><div>4: Advanced @20</div><div>5: Wow! @25</div><div><br />
            //  </div><div>surveyor name field: SRVNAME</div><div>best photo field: BSTPHOTOID</div><div><br /></div>
            var taggedConfigLines, descriptionSplitDiv, configLines, inConfigSection = false,
                keywordParts, iLine, iKeyword, config, contribLevels, lineParts;

            config = {};
            if (!source) {
                return;
            }

            // 1. split on </div> and then <br
            taggedConfigLines = [];
            descriptionSplitDiv = source.split("</div>");
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
            //  9: "surveyor name field: SRVNAME"
            //  10: "best photo field: BSTPHOTOID"
            configLines = [];
            $.each(taggedConfigLines, function (idx, line) {
                var cleanedLine = that._textOnly(line).trim();
                if (cleanedLine.length > 0) {
                    configLines.push(cleanedLine);
                }
            });

            // 3. find the start of the configuration section, then step thru lines seeking keywords
            keywordParts = ["0", "1", "2", "3", "4", "5", "surveyor", "photo"];
            iKeyword = 0;
            contribLevels = [];

            for (iLine = 0; iLine < configLines.length; iLine += 1) {
                if (!inConfigSection) {
                    inConfigSection = configLines[iLine].indexOf("=== Access and use settings ===") >= 0;
                } else {
                    lineParts = configLines[iLine].split(':');
                    if (lineParts[0].toLowerCase().indexOf(keywordParts[iKeyword]) >= 0) {
                        switch (iKeyword) {
                        case 0: // "0"
                            that._extractContribLevel(0, lineParts[1], contribLevels);
                            break;
                        case 1: // "1"
                            that._extractContribLevel(1, lineParts[1], contribLevels);
                            break;
                        case 2: // "2"
                            that._extractContribLevel(2, lineParts[1], contribLevels);
                            break;
                        case 3: // "3"
                            that._extractContribLevel(3, lineParts[1], contribLevels);
                            break;
                        case 4: // "4"
                            that._extractContribLevel(4, lineParts[1], contribLevels);
                            break;
                        case 5: // "5"
                            that._extractContribLevel(5, lineParts[1], contribLevels);
                            if (contribLevels !== null) {
                                config.contribLevels = contribLevels;
                            }
                            break;
                        case 6: // "surveyor name field"
                            config.surveyorNameField = lineParts[1].trim();
                            break;
                        case 7: // "best photo field"
                            config.bestPhotoField = lineParts[1].trim();
                            break;
                        }

                        iKeyword += 1;
                        if (iKeyword >= keywordParts.length) {
                            break;
                        }
                    }
                }
            }
            return config;
        },

        //--------------------------------------------------------------------------------------------------------------------//

        /**
         * Converts a contribution description into an object for addition to a list of levels.
         * @param {number} iLevel Level number, which is used to force the first level's minimum contribution to 0
         * @param {string} levelDescrip Descripton of a contribution level and, separated from the description by a '@', the
         * minimum number of contributions necessary to attain the level
         * @param {array} contribLevels List of objects describing a contribution level; each object contains label and
         * minimumSurveysNeeded properties. The object created from this levelDescrip is pushed onto the end of the array.
         */
        _extractContribLevel: function (iLevel, levelDescrip, contribLevels) {
            var levelParts, minimumSurveysNeeded;

            if (contribLevels !== null && levelDescrip !== null) {
                levelParts = levelDescrip.split('@');
                try {
                    minimumSurveysNeeded = iLevel === 0 ? 0 : parseInt(levelParts[1], 10);
                    contribLevels.push({
                        "label": levelParts[0].trim(),
                        "minimumSurveysNeeded": minimumSurveysNeeded
                    });
                } catch (err) {
                    // Flag an unusable set
                    contribLevels = null;
                }
            }
        },

        /**
         * Converts a list of feature service fields into a dictionary of fields with their domains and nullability;
         * skips fields without coded-value domains.
         * @param {array} featureSvcFields List of fields such as the one supplied by a feature service
         * @return {object} Object containing the field names as its properties; each property's value consists of the
         * '|'-separated coded values in the field's domain
         */
        _createSurveyDictionary: function (featureSvcFields) {
            var fieldDomains = {};
            $.each(featureSvcFields, function (idx, field) {
                if (field.domain && field.domain.codedValues) {
                    fieldDomains[field.name] = {
                        domain: $.map(field.domain.codedValues, function (item, index) {
                            return item.code;
                        }).join("|"),
                        important: !field.nullable
                    };
                }
            });
            return fieldDomains;
        },

        /**
         * Extracts the text from an HTML passage.
         * @param {string} original Text which may contain HTML
         * @return {string} Text-only version of original
         */
        _textOnly: function (original) {
            return $("<div>" + original + "</div>").text();
        },

        /**
         * Tests that an item is a string of length greater than zero.
         * @param {string} item Item to test
         * @return {boolean} True if the item is a string with length greater than zero
         */
        _isUsableString: function (item) {
            return typeof item === "string" && item.length > 0;
        },

        /** Normalizes a boolean value to true or false.
         * @param {boolean|string} boolValue A true or false value that is returned directly or a string "true" or "false"
         * (case-insensitive) that is interpreted and returned; if neither a a boolean or a usable string, falls back to
         * defaultValue
         * @param {boolean} [defaultValue] A true or false that is returned if boolValue can't be used; if not defined,
         * true is returned
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
