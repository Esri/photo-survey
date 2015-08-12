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
define(['lib/barcode.min'], function (barcode) {
    var showDiag = false, showTest = false;

    return {

        //--------------------------------------------------------------------------------------------------------------------//

        /**
         * Initializes the module by creating the diagnostic modal display and its trigger button.
         */
        init: function (appParams) {
            var barcodeDir = "h";

            showDiag = appParams.diag !== undefined;
            showTest = appParams.test !== undefined;

            if (showDiag) {
                // Create the display modal box and the button to trigger it
                $("body").append("<button id='diagnosticButton' style='z-index:2000;position:absolute;left:0;top:0;width:32px;"
                    + "height:32px;background-color:transparent' data-toggle='modal' data-target='#diagnosticPanel' class='iconButton'></button>"
                    + "<div id='diagnosticPanel' class='modal fade' role='dialog'>"
                    + "  <div class='modal-dialog'>"
                    + "    <div id='diagnosticLog' class='modal-content' style='padding:8px;word-wrap:break-word;'></div>"
                    + "  </div>"
                    + "</div>");
                $("#diagnosticPanel").modal({show: false});
            }

            if (showTest) {
                if (appParams.test === "v") {
                    barcodeDir = "v";
                }
                // Create the barcode display box
                $("head").append("<link href='js/lib/barcode.min.css' rel='stylesheet'>");
                $("body").append("<span class='barcode128" + barcodeDir + "' id='barcode'></span>");
            }
        },

        /**
         * Appends HTML text to the diagnostic modal display.
         * @param {string} note Text to append; text can contain HTML
         */
        append: function (note) {
            if (showDiag) {
                $("#diagnosticLog").append(note);
            }
        },

        /**
         * Appends HTML text to the diagnostic modal display followed by an HTML &lt;br&gt;.
         * @param {string} note Text to append; text can contain HTML
         */
        appendWithLF: function (note) {
            this.append(note + "<br>");
        },

        /**
         * Appends an HTML &lt;hr&gt; to the diagnostic modal display.
         */
        appendLine: function () {
            this.append("<hr>");
        },

        /**
         * Displays the supplied text as a code-128 barcode.
         * @param {string} text Text to convert and display
         */
        showAsCode: function (text) {
            if (showTest) {
                var codeContainer = $("#barcode");
                codeContainer[0].innerHTML = barcode.code128(text);
                codeContainer.css("display", "block");
            }
        },

        /**
         * Clears and hides the code-128 barcode.
         */
        clearCode: function () {
            if (showTest) {
                var codeContainer = $("#barcode");
                codeContainer[0].innerHTML = "";
                codeContainer.css("display", "none");
            }
        }

    };
});
