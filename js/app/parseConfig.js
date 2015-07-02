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

        init: function () {
            that = this;
        },

        //--------------------------------------------------------------------------------------------------------------------//

        _parseSurvey: function (source, fieldDomains) {
            // e.g., <p>Is there a Structure on the Property? <b>{<font color='#0000ff'>Structure</font>} </b><b>{<span
            //  style='background-color:rgb(255, 0, 0);'>button</span>}</b></p><p><ul><li>Is the lot overgrown? <b>{Lot}
            //  </b><b>{button}</b><br /></li><li>Foundation type: <b>{<font color='#ffff00' style='background-color:
            //  rgb(255, 69, 0);'>FoundationType</font>} </b><b>{radio}</b><br /></li></ul></p><p><b><br /></b></p><p>Is
            //  there roof damage? <b>{RoofDamage} </b><b>{button}</b></p><p>Is the exterior damaged? <b>{ExteriorDamage}
            //  </b><b>{button}</b></p><p></p><ol><li>Is there graffiti? <b>{Graffiti} </b><b>{button}</b><br /></li><li>
            //  Are there boarded windows/doors? <b>{Boarded} </b><b>{button}</b><br /></li></ol>
            var survey = [], taggedSurveyLines, descriptionSplitP, surveyLines;

            // 1. split on </p> and then </li> (lists are enclosed in <p></p> sets)
            taggedSurveyLines = [];
            descriptionSplitP = source.split("</p>");
            $.each(descriptionSplitP, function (idx, line) {
                $.merge(taggedSurveyLines, line.split("</li>"));
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

        _parseAccessConfig: function (source) {
            // e.g., <div>Copyright 2015 My City</div><div><br /></div><div>=== Access and use settings ===</div><div><br />
            //  </div><div>contribution star levels:</div><div>0: Getting Started @0</div><div>1: Beginner @5</div><div>2:
            //  Helper @10</div><div>3: Intermediate @15</div><div>4: Advanced @20</div><div>5: Wow! @25</div><div><br />
            //  </div><div>Facebook app id: 101991193476073</div><div>Google+ client id:
            //  884148190980-mrcnakr5q14ura5snpcbgp85ovq7s7ea.apps.googleusercontent.com</div><div>show Twitter: true</div>
            //  <div><br /></div><div>surveyor name field: SRVNAME</div><div>best photo field: BSTPHOTOID</div><div><br /></div>
            var taggedConfigLines, descriptionSplitDiv, configLines,
                keywordParts, iLine, iKeyword, config, contribLevels, lineParts;

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

            // 3. step thru lines seeking keywords
            keywordParts = ["=== access and use settings ===",
                "contribution star levels", "0", "1", "2", "3", "4", "5",
                "surveyor", "photo"];
            iKeyword = 0;
            config = {};
            contribLevels = [];

            for (iLine = 0; iLine < configLines.length; iLine += 1) {
                lineParts = configLines[iLine].split(':');
                if (lineParts[0].toLowerCase().indexOf(keywordParts[iKeyword]) >= 0) {
                    switch (iKeyword) {
                    case 0: // "=== Access and use settings ==="
                        break;
                    case 1: // "contribution star levels"
                        break;
                    case 2: // "0"
                        that._extractContribLevel(0, lineParts[1], contribLevels);
                        break;
                    case 3: // "1"
                        that._extractContribLevel(1, lineParts[1], contribLevels);
                        break;
                    case 4: // "2"
                        that._extractContribLevel(2, lineParts[1], contribLevels);
                        break;
                    case 5: // "3"
                        that._extractContribLevel(3, lineParts[1], contribLevels);
                        break;
                    case 6: // "4"
                        that._extractContribLevel(4, lineParts[1], contribLevels);
                        break;
                    case 7: // "5"
                        that._extractContribLevel(5, lineParts[1], contribLevels);
                        if (contribLevels !== null) {
                            config.contribLevels = contribLevels;
                        }
                        break;
                    case 8: // "surveyor name field"
                        config.surveyorNameField = lineParts[1].trim();
                        break;
                    case 9: // "best photo field"
                        config.bestPhotoField = lineParts[1].trim();
                        break;
                    }

                    iKeyword += 1;
                    if (iKeyword >= keywordParts.length) {
                        break;
                    }
                }
            }
            return config;
        },

        //--------------------------------------------------------------------------------------------------------------------//

        _extractContribLevel: function (iLevel, levelDescrip, contribLevels) {
            var levelParts, minimumSurveysNeeded;

            if (contribLevels !== null && levelDescrip !== null) {
                levelParts = levelDescrip.split('@');
                try {
                    minimumSurveysNeeded = iLevel === 0 ? 0 : parseInt(levelParts[1]);
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

        _createSurveyDictionary: function (featureSvcFields) {
            // Create dictionary of fields with their domains and nullability; skip fields without domains
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

        _textOnly: function (original) {
            return $("<div>" + original + "</div>").text();
            // By Simon Boudrias, http://stackoverflow.com/a/13140100
            //var container = document.createElement('div');
            //container.innerHTML = dirtyString;
            //return container.textContent || container.innerText;
        },

        _isUsableString: function (item) {
            return typeof item === "string" && item.length > 0;
        },

        /** Normalizes a boolean value to true or false.
         * @param {boolean|string} boolValue A true or false
         *        value that is returned directly or a string
         *        "true" or "false" (case-insensitive) that
         *        is checked and returned; if neither a
         *        a boolean or a usable string, falls back to
         *        defaultValue
         * @param {boolean} [defaultValue] A true or false
         *        that is returned if boolValue can't be
         *        used; if not defined, true is returned
         * @memberOf js.LGObject#
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
