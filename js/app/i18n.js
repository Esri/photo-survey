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
    var deferred, lang, languages, i, url;

    deferred = $.Deferred();

    // Get the language to use
    lang = (window.navigator.languages ? window.navigator.languages[0] : null)  // Firefox, Chrome
        || window.navigator.language  // Safari, IE 11, IE Spartan
        || window.navigator.browserLanguage;  // IE 9, 10

    if (lang) {
        // Check that the language is in the supported list
        languages = [
            "ar",
            "cs",
            "da",
            "de",
            "el",
            "en",
            "es",
            "et",
            "fi",
            "fr",
            "he",
            "it",
            "ja",
            "ko",
            "lt",
            "lv",
            "nb",
            "nl",
            "pl",
            "pt-br",
            "pt-pt",
            "ro",
            "ru",
            "sv",
            "th",
            "tr",
            "vi",
            "zh-cn",
            "zh-hk",
            "zh-tw"
        ];

        if ($.inArray(lang.toLowerCase(), languages) < 0) {
            // If not found, try once more using the language part without the region suffix
            i = lang.indexOf("-");
            if (i > 0) {
                lang = lang.substr(0, i);
                if ($.inArray(lang.toLowerCase(), languages) < 0) {
                    lang = null;
                }
            } else {
                lang = null;
            }
        }
    }

    // Get the phrase file for the language, falling back to the root version in the directory
    // that contains the language-specific folders
    url = "js/nls/" + (lang ? lang + "/" : "") + "resources.json";
    $.getJSON(url, function (data) {
        data.lang = lang;


data.note =
    "window.navigator.userAgent: " + window.navigator.userAgent + "<br>" +
    "language test:" + "<br>" +
    "  1. window.navigator.languages[0]: " + (window.navigator.languages ? window.navigator.languages[0] : null) + "<br>" +
    "  2. window.navigator.language: " + window.navigator.language + "<br>" +
    "  3. window.navigator.browserLanguage: " + window.navigator.browserLanguage + "<br>" +
    "  4. window.navigator.userLanguage: " + window.navigator.userLanguage + "<br>";


        deferred.resolve(data);
    });

    return deferred;
});
