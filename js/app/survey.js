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

        _i18n: null,

        //--------------------------------------------------------------------------------------------------------------------//

        create: function (surveyContainer, surveyDefinition, isReadOnly) {
            // Remove children and their events
            $(surveyContainer).children().remove();

            // Create the questions
            $.each(surveyDefinition, function (indexInArray, questionInfo) {
                survey._addQuestion(surveyContainer, indexInArray, questionInfo, isReadOnly);
            });

            // Render any radiobutton groups
            $(".btn-group").trigger('create');
        },

        validate: function (surveyContainer, surveyDefinition, objAttributes) {
            var iQuestionResult, firstMissing;

            $.each(surveyDefinition, function (iQuestion, questionInfo) {
                if (questionInfo.style === "button") {
                    iQuestionResult = $('#q' + iQuestion + ' .active', surveyContainer).val();
                } else {
                    iQuestionResult = $('input[name=q' + iQuestion + ']:checked', surveyContainer).val();
                }
                if (iQuestionResult) {
                    objAttributes[questionInfo.field] = questionInfo.domain.split("|")[iQuestionResult];
                }

                // Flag missing importants
                if (questionInfo.important) {
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

        //--------------------------------------------------------------------------------------------------------------------//

        _addQuestion: function (surveyContainer, iQuestion, questionInfo, isReadOnly) {
            var question = survey._startQuestion(surveyContainer, iQuestion, questionInfo);
            if (questionInfo.style === "button") {
                question += survey._createButtonChoice(surveyContainer, iQuestion, questionInfo, isReadOnly);
            } else {
                question += survey._createListChoice(surveyContainer, iQuestion, questionInfo, isReadOnly);
            }
            question += survey._wrapupQuestion(surveyContainer, iQuestion, questionInfo);
            $(surveyContainer).append(question);

            // Fix radio-button toggling
            if (questionInfo.style === "button") {
                $('#q' + iQuestion + ' button').click(function (evt) {
                    $(evt.currentTarget).addClass('active').siblings().removeClass('active');
                });
            }
        },

        _startQuestion: function (ignore, iQuestion, questionInfo) {
            // <div class='form-group'>
            //   <label for='q1'>Is there a structure on the property? <span class='glyphicon glyphicon-star'></span></label><br>
            var start =
                "<div id='qg" + iQuestion + "' class='form-group'>"
                + "<label for='q" + iQuestion + "'>" + survey._sanitizeHTML(questionInfo.question)
                + (questionInfo.important
                ? "&nbsp;<div class='importantQuestion sprites star' title=\""
                + survey._i18n.tooltips.flag_important_question + "\"></div>"
                : "")
                    + "</label><br>";
            return start;
        },

        _createButtonChoice: function (ignore, iQuestion, questionInfo, isReadOnly) {
            // <div id='q1' class='btn-group'>
            //   <button type='button' class='btn'>Yes</button>
            //   <button type='button' class='btn'>No</button>
            //   <button type='button' class='btn'>Not sure</button>
            // </div>
            var buttons = "<div id='q" + iQuestion + "' class='btn-group'>";
            var domain = questionInfo.domain.split('|');
            $.each(domain, function (i, choice) {
                buttons += "<button type='button' class='btn' value='" + i + "' " + (isReadOnly
                    ? "disabled"
                    : "") + ">" + choice + "</button>";
            });
            buttons += "</div>";
            return buttons;
        },

        _createListChoice: function (ignore, iQuestion, questionInfo, isReadOnly) {
            // <div class='radio'><label><input type='radio' name='q1' id='optionFound1' value='0'>Crawlspace</label></div>
            // <div class='radio'><label><input type='radio' name='q1' id='optionFound2' value='1'>Raised</label></div>
            // <div class='radio'><label><input type='radio' name='q1' id='optionFound3' value='2'>Elevated</label></div>
            // <div class='radio'><label><input type='radio' name='q1' id='optionFound4' value='3'>Slab on grade</label></div>
            // <div class='radio'><label><input type='radio' name='q1' id='optionFound0' value='4'>Not sure</label></div>
            var list = "";
            var domain = questionInfo.domain.split('|');
            $.each(domain, function (i, choice) {
                list += "<div class='radio'><label><input type='radio' name='q" + iQuestion + "' value='" + i
                    + "' " + (isReadOnly
                    ? "disabled"
                    : "") + ">" + choice + "</label></div>";
            });
            return list;
        },

        _wrapupQuestion: function () {
            // </div>
            // <div class='clearfix'></div>
            var wrap = "</div><div class='clearfix'></div>";
            return wrap;
        },

        _sanitizeHTML: function (html) {
            return $('<div/>').text(html).html();
        }

    };
    return survey;
});
