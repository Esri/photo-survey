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
define(["lib/i18n.min!nls/resources.js", "esri/WebScene", "esri/views/SceneView", "app/diag"],
    function (i18n, WebScene, SceneView, diag) {
    "use strict";
    var visualsController = {
        _prepareAppConfigInfo: null,
        _dataAccess: null,
        _container: null,

        //------------------------------------------------------------------------------------------------------------//

        init: function (prepareAppConfigInfo, dataAccess, container) {
            var visualsControllerReady = $.Deferred();
            visualsController._prepareAppConfigInfo = prepareAppConfigInfo;
            visualsController._dataAccess = dataAccess;
            visualsController._container = container;

            // Instantiate the visualsController template
            container.loadTemplate("js/app/visualsController3d.html", {
            }, {
                prepend: true,
                complete: function () {

                    var scene = new WebScene({
                        portalItem: {
                            id: "3e510d9f52404e1f9ef3827952c22ccf"
                        }
                    });

                    $("#viewDiv").addClass("viewDivMinHeight");
                    var view = new SceneView({
                        map: scene,
                        container: "viewDiv"
                    });

                    view.then(function (response) {
                        // Loads once visuals panel becomes visible



                    });

                    // Done with setup
                    visualsControllerReady.resolve();
                }
            });

            return visualsControllerReady;
        },

        //------------------------------------------------------------------------------------------------------------//

        _hideVisuals: function () {
            $(visualsController._container).fadeTo(100, 0.0);
        },

        _showVisuals: function () {
            $(visualsController._container).fadeTo(1000, 1.0);
        }

        //------------------------------------------------------------------------------------------------------------//
    };
    return visualsController;
});
