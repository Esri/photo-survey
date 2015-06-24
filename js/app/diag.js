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
    var ignore = true;

    return {

        //--------------------------------------------------------------------------------------------------------------------//

        init: function () {
            if (ignore) {
                // Create the display modal box and the button to trigger it
                $("body").append("<span id='diagnosticButton' style='z-index:2000;position:absolute;left:0;top:0;width:20px;"
                    + "height:20px;background-color:transparent' data-toggle='modal' data-target='#diagnosticPanel'></span>"
                    + "<div id='diagnosticPanel' class='modal fade' role='dialog'>"
                    + "  <div class='modal-dialog'>"
                    + "    <div id='diagnosticLog' class='modal-content' style='padding:8px;word-wrap:break-word;'></div>"
                    + "  </div>"
                    + "</div>");
                ignore = false;
            }
        },

        append: function (note) {
            if (!ignore) {
                $("#diagnosticLog").append(note);
            }
        },

        appendWithLF: function (note) {
            this.append(note + "<br>");
        },

        appendLine: function (note) {
            this.append("<hr>");
        }

    };
});
