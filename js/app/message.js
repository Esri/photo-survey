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
//====================================================================================================================//
define(["lib/i18n.min!nls/resources.js", "app/diag"],
    function (i18n, diag) {
    "use strict";
    var message = {
        //------------------------------------------------------------------------------------------------------------//

        init: function () {
            var messagePanelReady = $.Deferred();

            // When the DOM is ready, we can start adjusting the UI
            $().ready(function () {
                // Instantiate the message template
                $("body").loadTemplate("js/app/message.html", {
                }, {
                    prepend: true,
                    complete: function () {
                        // i18n-ize content
                        $("#modalCloseBtn1")[0].title = i18n.tooltips.button_close;
                        $("#modalCloseBtn2")[0].title = i18n.tooltips.button_close;
                        $("#modalCloseBtn2")[0].innerHTML = i18n.labels.button_close;

                        messagePanelReady.resolve();
                    }
                });
            });

            return messagePanelReady;
        },

        showMessage: function (body, title) {
            $("#messageTitle")[0].innerHTML = title || "";
            $("#messageBody")[0].innerHTML = body;
            $("#messagePanel").modal("show");
        }

        //------------------------------------------------------------------------------------------------------------//
    };
    return message;
});
