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
define(function () {
    "use strict";
    var parseConfigInfo;
    parseConfigInfo = {

        //--------------------------------------------------------------------------------------------------------------------//

        /**
         * Parses HTML text such as appears in an AGOL item's description to extract a set of configuration parameters.
         * @param {string} source Text from source
         * @return {object} Configuration properties contribLevels (an array of objects with properties label and
         * minimumSurveysNeeded), surveyorNameField, bestPhotoField properties
         */
        parseAccessConfig: function (source) {
            // Access information is written as a series of lines in the webmap's description. Each line is de-HTMLed, then
            // each is checked until the text "=== Access and use settings ===" is found; this marks the start of the
            // configuration section to permit free text in the description before the configuration. In the configuration
            // section, each line is checked for the presence of the current tag out of the list ["0", "1", "2", "3", "4", "5",
            // "surveyor", "photo"]; if it matches, the line is split on ':', the content to the right of the colon is
            // considered the  parameter value, and the "current tag" becomes the next one in the list. If the current tag is
            // not found in the line, the line is skipped. By forcing this order, the app doesn't have to check all tags for
            // each line.
            // Here is a sample source:
            //  <div>My City</div><div><br /></div><div>=== Access and use settings ===</div><div><br />
            //  </div><div>contribution star levels:</div><div>0: Getting Started @0</div><div>1: Beginner @5</div><div>2:
            //  Helper @10</div><div>3: Intermediate @15</div><div>4: Advanced @20</div><div>5: Wow! @25</div><div><br />
            //  </div><div>surveyor name field: SRVNAME</div><div>best photo field: BSTPHOTOID</div><div><br /></div>
            var taggedConfigLines, descriptionSplitDiv, configLines, inConfigSection = false,
                    keywordParts, iKeyword, config, contribLevels, lineParts;

            config = {};
            if (!source) {
                return;
            }

            // 1. split on </div> and then <br
            taggedConfigLines = [];
            descriptionSplitDiv = source.split("</div>");
            $.each(descriptionSplitDiv, function (ignore, line) {
                $.merge(taggedConfigLines, line.split("<br />"));
            });

            // 2. remove all html tags (could have <b>, <i>, <u>, <ol>, <ul>, <li>, <a>, <font>, <span>, <br>, <div>,
            // and their closures included or explicit)
            // yields something like:
            //  0: "My City"
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
            $.each(taggedConfigLines, function (ignore, line) {
                var cleanedLine = parseConfigInfo._textOnly(line).trim();
                if (cleanedLine.length > 0) {
                    configLines.push(cleanedLine);
                }
            });

            // 3. find the start of the configuration section, then step thru lines seeking keywords
            keywordParts = ["0", "1", "2", "3", "4", "5", "surveyor", "photo"];
            iKeyword = 0;
            contribLevels = [];

            $.each(configLines, function (ignore, line) {
                if (!inConfigSection) {
                    inConfigSection = line.indexOf("=== Access and use settings ===") >= 0;
                } else {
                    lineParts = line.split(":");
                    if (lineParts[0].toLowerCase().indexOf(keywordParts[iKeyword]) >= 0) {
                        switch (iKeyword) {
                        case 0: // "0"
                            parseConfigInfo._extractContribLevel(0, lineParts[1], contribLevels);
                            break;
                        case 1: // "1"
                            parseConfigInfo._extractContribLevel(1, lineParts[1], contribLevels);
                            break;
                        case 2: // "2"
                            parseConfigInfo._extractContribLevel(2, lineParts[1], contribLevels);
                            break;
                        case 3: // "3"
                            parseConfigInfo._extractContribLevel(3, lineParts[1], contribLevels);
                            break;
                        case 4: // "4"
                            parseConfigInfo._extractContribLevel(4, lineParts[1], contribLevels);
                            break;
                        case 5: // "5"
                            parseConfigInfo._extractContribLevel(5, lineParts[1], contribLevels);
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
                            return false;
                        }
                    }
                }
            });
            return config;
        },

        /**
         * Tests that an item is a string of length greater than zero.
         * @param {string} item Item to test
         * @return {boolean} True if the item is a string with length greater than zero
         * @private
         */
        isUsableString: function (item) {
            return typeof item === "string" && item.length > 0;
        },

        //--------------------------------------------------------------------------------------------------------------------//

        /**
         * Converts a contribution description into an object for addition to a list of levels.
         * @param {number} iLevel Level number, which is used to force the first level's minimum contribution to 0
         * @param {string} levelDescrip Descripton of a contribution level and, separated from the description by a '@', the
         * minimum number of contributions necessary to attain the level
         * @param {array} contribLevels List of objects describing a contribution level; each object contains label and
         * minimumSurveysNeeded properties. The object created from this levelDescrip is pushed onto the end of the array.
         * @private
         */
        _extractContribLevel: function (iLevel, levelDescrip, contribLevels) {
            var levelParts, minimumSurveysNeeded;

            if (contribLevels !== null && levelDescrip !== null) {
                levelParts = levelDescrip.split("@");
                try {
                    minimumSurveysNeeded = iLevel === 0
                        ? 0
                        : parseInt(levelParts[1], 10);
                    contribLevels.push({
                        label: levelParts[0].trim(),
                        minimumSurveysNeeded: minimumSurveysNeeded
                    });
                } catch (ignore) {
                    // Flag an unusable set
                    contribLevels = null;
                }
            }
        },

        /**
         * Extracts the text from an HTML passage.
         * @param {string} original Text which may contain HTML
         * @return {string} Text-only version of original
         * @private
         */
        _textOnly: function (original) {
            return $("<div>" + original + "</div>").text();
        }

    };
    return parseConfigInfo;
});
