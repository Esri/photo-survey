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
    var proxy = {
        //------------------------------------------------------------------------------------------------------------//

        test: function (prepareAppConfigInfo) {
            var proxyReady = $.Deferred(), unsupported = false, needProxy = false;

            // Check for obsolete IE
            if ($("body").hasClass("unsupportedIE")) {
                unsupported = true;
            } else if ($("body").hasClass("IE9")) {
                needProxy = true;
            }

            // If a proxy is needed, launch the test for a usable proxy
            if (unsupported) {
                proxyReady.reject("Unsupported browser");
            } else if (needProxy) {
                $.getJSON(prepareAppConfigInfo.appParams.proxyProgram + "?ping", function () {
                    proxyReady.resolve();
                }).fail(function (error) {
                    proxyReady.reject(error);
                });
            } else {
                prepareAppConfigInfo.appParams.proxyProgram = null;
                proxyReady.resolve();
            }

            return proxyReady;
        }

        //------------------------------------------------------------------------------------------------------------//
    };
    return proxy;
});
