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
define([], function () {
    'use strict';
    var survey;
    survey = {

        flag_important_question: "Please answer this question",
        error_text: "Error displaying question, please check that field name from survey question table matches the photo points feature service",

        //--------------------------------------------------------------------------------------------------------------------//

        /**
         * Parses HTML text such as appears in a webmap's feature layer's popup to generate a set of survey questions.
         * @param {string} source Text from source
         * @param {array} featureSvcFields List of fields such as the one supplied by a feature service
         * @return {array} List of survey question objects, each of which contains question, field, style, domain, important
         * properties
         */
        createSurvey: function (surveyDescription, featureSvcFields) {
            // Patch older browsers
            survey._installPolyfills();

            // Create dictionary of domains
            var dictionary = survey._createSurveyDictionary(featureSvcFields);

            // Parse survey
            return survey._parseSurvey(surveyDescription, dictionary);
        },

        /**
         * Creates a survey form in the specified element.
         * @param {div} surveyContainer Element to receive survey form; its contents are completely replaced by the
         * new survey
         * @param {array} surveyDefinition List of survey question objects, each of which contains question, field,
         * style, domain, important
         * @param {boolean} isReadOnly Indicates if survey form elements are read-only
         */
        createNewForm: function (surveyContainer, surveyDefinition, isReadOnly) {
            // Remove children and their events
            $(surveyContainer).children().remove();

            // Create the questions
            $.each(surveyDefinition, function (indexInArray, questionInfo) {
                survey._addQuestion(surveyContainer, indexInArray, questionInfo, isReadOnly);
            });

            // Render any radiobutton groups
            $(".btn-group").trigger('create');
        },

        /**
         * Validates a survey form in the specified element.
         * @param {div} surveyContainer Element containing survey form
         * @param {array} surveyDefinition List of survey question objects, each of which contains question, field,
         * style, domain, important
         * @param {object} objAttributes Attributes of item being surveyed; attributes are updated with the values
         * in the form
         */
        validateForm: function (surveyContainer, surveyDefinition, objAttributes) {
            var iQuestionResult, firstMissing;

            $.each(surveyDefinition, function (iQuestion, questionInfo) {
                // Extract the value from the item
                if (questionInfo.style === "button") {
                    iQuestionResult = $('#q' + iQuestion + ' .active', surveyContainer).val();
                } else if (questionInfo.style === "list") {
                    iQuestionResult = $('input[name=q' + iQuestion + ']:checked', surveyContainer).val();
                } else if (questionInfo.style === "dropdown") {
                    iQuestionResult = $('#q' + iQuestion, surveyContainer).val();
                } else if (questionInfo.style === "number") {
                    iQuestionResult = $('#q' + iQuestion, surveyContainer).val();
                } else if (questionInfo.style === "text") {
                    iQuestionResult = $('#q' + iQuestion, surveyContainer).val();
                }

                if (iQuestionResult) {
                    if (questionInfo.style === "number") {
                        objAttributes[questionInfo.field] = parseFloat(iQuestionResult);
                    } else if (questionInfo.style === "text" || questionInfo.style === "dropdown") {
                        objAttributes[questionInfo.field] = iQuestionResult;
                    } else {  // "button" or "list"
                        objAttributes[questionInfo.field] = questionInfo.values[iQuestionResult];
                    }
                }

                // Flag missing importants and only enforce questions that are visible
                if (questionInfo.important && $("#qg" + iQuestion).is(':visible')) {
                    if (iQuestionResult) {
                        $("#qg" + iQuestion).removeClass("flag-error");
                    } else {
                        $("#qg" + iQuestion).addClass("flag-error");
                        if (firstMissing === undefined) {
                            firstMissing = $("#qg" + iQuestion)[0];
                        }
                    }
                }
            });

            // Return the first missing important (if any)
            return firstMissing;
        },

        /**
         * Updates the survey question visibility based on display conditions being met
         * Only "Parent" questions have the ability to run this function
         * @param {string} answer Current value of survey answer
         * @param {integer} questionID ID from the "data-id" attribute of the question clicked
         * @param {array} surveyDefinition List of survey question objects, each of which contains question, field,
         * style, domain, important
         */
        updateForm: function(answer, questionID, surveyDefinition){
            var surveyGroup = [];
            var descendants = [];
            //Creating group of question to be updated, with Parent at first position and Children thereafter
            $.each (surveyDefinition, function(iQuestion, questionInfo){
                // Put child questions at the back of question group when found
                if (questionInfo.parent === questionID){
                    surveyGroup.push(questionInfo);
                }
                // Put parent at front of question group when found
                else if (questionInfo.id === questionID){
                    surveyGroup.unshift(questionInfo);
                }
                // If question is outside of question group check to see if it is a descendant
                else{
                    if(survey._findAncestor(questionID, questionInfo, surveyDefinition)){
                        descendants.push(questionInfo)
                    }
                }
            })
            var clearCount = 0;
            $.each(surveyGroup, function(index, questionInfo){
                if (index > 0){
                    if (surveyGroup[0].style === "dropdown" || surveyGroup[0].style === "text" || surveyGroup[0].style === "number"){
                        if (questionInfo.conditions.toLowerCase().indexOf(answer.toLowerCase()) !== -1){
                            $("#qg" + questionInfo.origorder).show("fast");
                        }
                        else{
                            survey._clearQuestions([questionInfo]);
                            clearCount++
                        }
                    }
                    else{
                        if (questionInfo.conditions.toLowerCase().indexOf(surveyGroup[0].values[answer].toLowerCase()) !== -1){
                            $("#qg" + questionInfo.origorder).show("fast");
                        }
                        else{
                            survey._clearQuestions([questionInfo]);
                            clearCount++;    
                        }
                    }
                }
            })
            //If any questions are not to be displayed then clear descendants as well
            if (clearCount > 0 && descendants && descendants.length > 0){
                survey._clearQuestions(descendants);
            }
        },

        //--------------------------------------------------------------------------------------------------------------------//

        _installPolyfills: function () {
            // source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith
            if (!String.prototype.startsWith) {
                String.prototype.startsWith = function(searchString, position){
                    position = position || 0;
                    return this.substr(position, searchString.length) === searchString;
                };
            }
        },

        /**
         * Converts a list of feature service fields into a dictionary of fields with their domains and nullability;
         * skips fields without coded-value domains.
         * @param {array} featureSvcFields List of fields such as the one supplied by a feature service
         * @return {object} Object containing the field names as its properties; each property's value consists of the
         * '|'-separated coded values in the field's domain and a flag indicating if the field is flagged as important;
         * if field is not coded, then its length is returned
         * @private
         */
        _createSurveyDictionary: function (featureSvcFields) {
            var fieldDomains = {};

            $.each(featureSvcFields, function (ignore, field) {
                var domain = null, value = null;
                if (field.domain && field.domain.codedValues) {
                    domain = $.map(field.domain.codedValues, function (item) {
                        return item.name;
                    }).join("|");
                    value = $.map(field.domain.codedValues, function (item) {
                        return item.code;
                    });
                } else if (field.length) {
                    domain = field.length;
                }

                fieldDomains[field.name] = {
                    domain: domain,
                    values: value,
                    important: !field.nullable
                };
            });

            return fieldDomains;
        },
        /**
         * Checks to see if a specific question has an ancestor up question
         * tree with the matching ancestorID
         * @param {integer} ancestorID ID of the ancestor to check for relationship
         * @param {object} questionInfo Question object to compare against for ancestors
         * @param {array} array of survey questions objects
         * @return {boolean} Boolean (Is question related to provided ancestorID?)
         */
        _findAncestor: function(ancestorID, questionInfo, surveyDefinition){
            if(questionInfo.parent){
                if (questionInfo.parent == ancestorID){
                    return true;
                }
                //Go up the survey tree recursively until parent is null or ancestor match is found
                else{
                    return survey._findAncestor(ancestorID, survey._questionByID(questionInfo.parent, surveyDefinition), surveyDefinition);
                }
            }
            else{
                return false;
            }
        },
        /**
         * Finds a specific question based on its ID from survey questions
         * @param {integer} id ID of question to be found 
         * @param {array} surveyDefinition array of survey questions objects
         * @return {object} The found question object
         */
        _questionByID: function(id, surveyDefinition){
            var foundQuestion = {}
            $.each(surveyDefinition, function(index, questionInfo){
                if (questionInfo.id === id){
                    foundQuestion = questionInfo;
                    return false;
                }
            });
            return foundQuestion;
        },
        /**
         * Clears question responses and hides them based on type of question
         * @param {array} questionList List of questions
         */
        _clearQuestions: function (questionList){
            $.each(questionList, function(index, questionInfo){
                $("#qg" + questionInfo.origorder).hide("fast");
                if (questionInfo.style === "button"){
                    $('#q' + questionInfo.origorder + " .active").removeClass("active");
                } else if (questionInfo.style === "list"){
                    $('input[name=q' + questionInfo.origorder + ']:checked').prop('checked', false);
                } else if (questionInfo.style === "number" || questionInfo.style === "text"){
                    $('#q' + questionInfo.origorder).val("");
                } else if (questionInfo.style === "dropdown"){
                    $("#q" + questionInfo.origorder).each(function (indexInArray, input) {
                        input.selectedIndex = -1;
                    });
                }
            })
        },
        /**
         * Parses incoming survey parameters from the SurveyQuestions table in the service.
         * @param {object} formUI Results of Query to the Form UI table in the feature service. Contains survey UI information.
         * @param {object} fieldDomains List of field domains and field required/optional state as created by function
         * createSurveyDictionary using the 'fields' property of a feature service
         * @return {array} List of survey question objects, each of which contains question, field, style, domain, important
         * properties
         * @private
         */
        _parseSurvey: function (formUI, fieldDomains) {
            var surveyQuestions = []
            $.each(formUI.features, function(index, feature){
                var fieldName, surveyQuestion;
                fieldName = feature.attributes.FIELDNAME;
                //Check to see that the field exists in feature class
                if(fieldDomains[fieldName]){
                    surveyQuestion = {
                        id: feature.attributes.OBJECTID,
                        question: feature.attributes.QTEXT,
                        questionType: feature.attributes.QTYPE,
                        field: fieldName,
                        domain: fieldDomains[fieldName].domain,
                        values: fieldDomains[fieldName].values,
                        important: feature.attributes.REQUIRED == "Yes" ? true : false,
                        style: feature.attributes.INPUTTYPE,
                        image: feature.attributes.IMG_URL,
                        imagepos: feature.attributes.IMG_POS,
                        conditions: feature.attributes.DISPCOND,
                        order: feature.attributes.QORDER - 1,
                        origorder: index,
                        parent: feature.attributes.PARENTID
                    };
                }
                surveyQuestions.push(surveyQuestion);
            })
            return surveyQuestions;
        },

        /**
         * Creates a survey form in the specified element.
         * @param {div} surveyContainer Element containing survey form
         * @param {number} iQuestion Zero-based question number
         * @param {object} questionInfo Survey question, which contains question, field, style, domain, important
         * @param {boolean} isReadOnly Indicates if survey form elements are read-only
         * @private
         */
        _addQuestion: function (surveyContainer, iQuestion, questionInfo, isReadOnly) {
            var question = survey._startQuestion(iQuestion, questionInfo);
            //Question Object Needs to exist in order for HTML element to be created
            if (questionInfo){
                //Create parent flags if question type is parent (domain value 0)
                var primeQFlag = questionInfo.questionType === 0 ? "prime" : " contingent";
                primeQFlag = questionInfo.style === "dropdown" ? "primeD" : primeQFlag;
                if (questionInfo.style === "button") {
                    question += survey._createButtonChoice(iQuestion, questionInfo, isReadOnly, primeQFlag);
                } else if (questionInfo.style === "list") {
                    question += survey._createListChoice(iQuestion, questionInfo, isReadOnly, primeQFlag);
                } else if (questionInfo.style === "dropdown") {
                    question += survey._createDropdownChoice(iQuestion, questionInfo, isReadOnly, primeQFlag);
                } else if (questionInfo.style === "number") {
                    question += survey._createNumberInput(iQuestion, questionInfo, isReadOnly, primeQFlag);
                } else if (questionInfo.style === "text") {
                    question += survey._createTextLineInput(iQuestion, questionInfo, isReadOnly, primeQFlag);
                }
                question += survey._wrapupQuestion(iQuestion, questionInfo, isReadOnly);
            }

            $(surveyContainer).append(question);
            //Question Object Needs to exist in order for HTML element to be created
            if(questionInfo){
            // Fix radio-button toggling
                if (questionInfo.style === "button") {
                    $('#q' + iQuestion + ' button').click(function (evt) {
                        $(evt.currentTarget).addClass('active').siblings().removeClass('active');
                        $("#qg" + iQuestion).removeClass("flag-error");
                    });

                } else if (questionInfo.style === "list") {
                    $("[name=q" + iQuestion + "]").click(function (evt) {
                        $("#qg" + iQuestion).removeClass("flag-error");
                    });

                } else {
                    // Start with nothing selected in dropdown
                    if (questionInfo.style === "dropdown") {
                        $("#q" + iQuestion).each(function (indexInArray, input) {
                            input.selectedIndex = -1;
                        });
                    }

                    $('#q' + iQuestion).change(function (evt) {
                        $("#qg" + iQuestion).removeClass("flag-error");
                    });
                }
            }
        },

        /**
         * Starts the HTML for a survey question with its label.
         * @param {number} iQuestion Zero-based question number
         * @param {object} questionInfo Survey question, which contains question, field, style, domain, important
         * @return {string} HTML for question's label and the start of its div
         * @private
         */
        _startQuestion: function (iQuestion, questionInfo) {
            // <div class='form-group'>
            //   <label for='q1'>Is there a structure on the property? <span class='glyphicon glyphicon-star'></span></label><br>

            //Check for question info object
            if (questionInfo){
                // Determine whether to show question on first load. Applies to questions with no parents
                var initDisplay = !questionInfo.parent ? "" : " style='display: none;'";
                var start =
                    "<div id='qg" + iQuestion + "' class='form-group'" + initDisplay + ">"
                    + "<label for='q" + iQuestion + "'>" + questionInfo.question + (questionInfo.important
                    ? "&nbsp;<div class='importantQuestion sprites star' title=\""
                    + survey.flag_important_question + "\"></div>"
                    : "")
                        + "</label><br>";
                if (questionInfo.image && questionInfo.image.length > 0 && questionInfo.imagepos === "Before") {
                    start += "<img src='" + questionInfo.image + "' class='image-before'/><br>";
                }
            }
            //If object is not defined or null then display it with error text
            else{
                var start = "<div id = 'qg" + iQuestion + "' class='form-group' style='color: red'>" +
                "Question " + iQuestion + " " + survey.error_text + "<br></div>"
            }
            return start;
        },

        /**
         * Creates a survey question's response item's HTML: a set of button-style radio buttons.
         * @param {number} iQuestion Zero-based question number
         * @param {object} questionInfo Survey question, which contains question, field, style, domain, important
         * @param {boolean} isReadOnly Indicates if survey form elements are read-only
         * @return {string} HTML for radio buttons
         * @private
         */
        _createButtonChoice: function (iQuestion, questionInfo, isReadOnly, primeQFlag) {
            // <div id='q1' class='btn-group'>
            //   <button type='button' class='btn'>Yes</button>
            //   <button type='button' class='btn'>No</button>
            //   <button type='button' class='btn'>Not sure</button>
            // </div>
            var buttons = "<div id='q" + iQuestion + "' class='btn-group'>";
            var domain = questionInfo.domain.split('|');
            $.each(domain, function (i, choice) {
                buttons += "<button data-id=" + questionInfo.id + " type='button' class='btn "+ primeQFlag +"' value='" + i + "' " + (isReadOnly
                    ? "disabled"
                    : "") + ">" + choice + "</button>";
            });
            buttons += "</div>";
            return buttons;
        },

        /**
         * Creates a survey question's response response item's HTML: a set of list-style radio buttons.
         * @param {number} iQuestion Zero-based question number
         * @param {object} questionInfo Survey question, which contains question, field, style, domain, important
         * @param {boolean} isReadOnly Indicates if survey form elements are read-only
         * @return {string} HTML for radio buttons
         * @private
         */
        _createListChoice: function (iQuestion, questionInfo, isReadOnly, primeQFlag) {
            // <div class='radio'><label><input type='radio' name='q1' id='optionFound1' value='0'>Crawlspace</label></div>
            // <div class='radio'><label><input type='radio' name='q1' id='optionFound2' value='1'>Raised</label></div>
            // <div class='radio'><label><input type='radio' name='q1' id='optionFound3' value='2'>Elevated</label></div>
            // <div class='radio'><label><input type='radio' name='q1' id='optionFound4' value='3'>Slab on grade</label></div>
            // <div class='radio'><label><input type='radio' name='q1' id='optionFound0' value='4'>Not sure</label></div>
            var list = "";
            var domain = questionInfo.domain.split('|');
            $.each(domain, function (i, choice) {
                list += "<div class='radio'><label><input data-id=" + questionInfo.id + " type='radio' class='"+ primeQFlag +"' name='q" + iQuestion + "' value='" + i
                    + "' " + (isReadOnly
                    ? "disabled"
                    : "") + ">" + choice + "</label></div>";
            });
            return list;
        },

        /**
         * Creates a survey question's response response item's HTML: a dropdown list of options.
         * @param {number} iQuestion Zero-based question number
         * @param {object} questionInfo Survey question, which contains question, field, style, domain, important
         * @param {boolean} isReadOnly Indicates if survey form elements are read-only
         * @return {object} HTML for radio buttons
         * @private
         */
        _createDropdownChoice: function (iQuestion, questionInfo, isReadOnly, primeQFlag) {
            // <select id='q1' class='dropdown-group'>
            //   <option value='Yes'>Yes</option>
            //   <option value='No'>No</option>
            //   <option value='Notsure'>Not sure</option>
            // </select>
            var list = "<select data-id=" + questionInfo.id + " id='q" + iQuestion + "' class='dropdown-group " + primeQFlag + "'>";
            var domain = questionInfo.domain.split('|');
            $.each(domain, function (i, choice) {
                list += "<option value='" + questionInfo.values[i] + "'" + (isReadOnly
                    ? " disabled"
                    : "") + ">" + choice + "</option>";
            });
            list += "</select>";
            return list;
        },

        /**
         * Creates a survey question's response response item's HTML: a number input field.
         * @param {number} iQuestion Zero-based question number
         * @param {object} questionInfo Survey question, which contains question, field, style, domain, important
         * @param {boolean} isReadOnly Indicates if survey form elements are read-only
         * @return {object} HTML for radio buttons
         * @private
         */
        _createNumberInput: function (iQuestion, questionInfo, isReadOnly, primeQFlag) {
            // <input id='q1' type='number' class='number-input'>
            //var primeQFlag = questionInfo.contingent ? " answer" : "";
            var list = "<input data-id=" + questionInfo.id + " id='q" + iQuestion + "' type='number' class='number-input " + primeQFlag + "'>";
            return list;
        },

        /**
         * Creates a survey question's response response item's HTML: a single-line text input field.
         * @param {number} iQuestion Zero-based question number
         * @param {object} questionInfo Survey question, which contains question, field, style, domain, important
         * @param {boolean} isReadOnly Indicates if survey form elements are read-only
         * @return {object} HTML for radio buttons
         * @private
         */
        _createTextLineInput: function (iQuestion, questionInfo, isReadOnly, primeQFlag) {
            // <input id='q1' type='text' class='text-input'>
            var list = "<input data-id=" + questionInfo.id + " id='q" + iQuestion + "' type='text' class='text-input " + primeQFlag + "'>";
            return list;
        },

        /**
         * Completes the HTML for a survey question.
         * @param {number} iQuestion Zero-based question number
         * @param {object} questionInfo Survey question, which contains question, field, style, domain, important
         * @param {boolean} isReadOnly Indicates if survey form elements are read-only
         * @return {string} HTML for the end of its div
         * @private
         */
        _wrapupQuestion: function (iQuestion, questionInfo, isReadOnly) {
            // </div>
            // <div class='clearfix'></div>
            var wrap = "";
            if (questionInfo.image && questionInfo.image.length > 0 && questionInfo.imagepos === "After") {
                wrap += "<img src='" + questionInfo.image + "' class='image-after'/><br>";
            }
            wrap += "</div><div class='clearfix'></div>";
            return wrap;
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
    return survey;
});
