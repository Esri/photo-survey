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
    var visualsController = {
        _prepareAppConfigInfo: null,
        _dataAccess: null,
        _container: null,
        _iVisiblePhoto: 0,
        _photoSelected: false,
        _iSelectedPhoto: -1,
        _overviewMap: null,
        _overviewMapVisible: false,

        //------------------------------------------------------------------------------------------------------------//

        init: function (prepareAppConfigInfo, dataAccess, container) {
            var visualsControllerReady = $.Deferred();
            visualsController._prepareAppConfigInfo = prepareAppConfigInfo;
            visualsController._dataAccess = dataAccess;
            visualsController._container = container;

            // Instantiate the visualsController template
            container.loadTemplate("js/app/visualsController.html", {
            }, {
                prepend: true,
                complete: function () {

                    // Enable the carousel swipe for mobile
                    $(".carousel").bcSwipe({
                        threshold: 50
                    });

                    // Create overview map if desired
                    if (prepareAppConfigInfo.appParams.includeOverviewMap) {
                        visualsController._createOverviewMap();
                    }

                    // Wire up app
                    $.subscribe("show:newSurvey", visualsController._showNewSurvey);

                    $.subscribe("show:noSurveys", visualsController._hideVisuals);

                    $("#hearts").on("click", function () {
                        visualsController._photoSelected = !visualsController._photoSelected;
                        visualsController._iVisiblePhoto = parseInt($("#carouselSlidesHolder > .item.active")[0].id.substring(1));
                        visualsController._iSelectedPhoto = visualsController._photoSelected
                            ? visualsController._iVisiblePhoto
                            : -1;
                        visualsController._updatePhotoSelectionDisplay();
                    });

                    // Manage group of buttons in a radio style
                    $(".btn-group > .btn").click(function (evt) {
                        $(evt.currentTarget).addClass("active").siblings().removeClass("active");
                    });

                    $("#carousel").on('slide.bs.carousel', function (data) {
                        // Check if we should slide: swipe jumps right into here
                        if ((visualsController._iVisiblePhoto === 0 && data.direction === "right")
                                || (visualsController._iVisiblePhoto ===
                                (visualsController._currentCandidate.numPhotos - 1) && data.direction === "left")) {
                            // Block move
                            data.preventDefault();
                        } else {
                            // Otherwise, hide the heart until the next slide appears
                            $("#hearts")[0].style.display = "none";
                        }
                    });

                    $("#carousel").on("slid.bs.carousel", function () {
                        visualsController._updatePhotoSelectionDisplay();
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
        },

        _createOverviewMap: function () {
            // Prepare overview map and set its initial visibility
            visualsController.overviewMap = L.map('overviewMap', {
                scrollWheelZoom: "center",
                doubleClickZoom: "center"
            });
            L.esri.basemapLayer(visualsController._prepareAppConfigInfo.appParams.overviewMapBasemap)
                .addTo(visualsController.overviewMap);

            visualsController._showOverviewMap(
                visualsController._prepareAppConfigInfo.appParams.overviewMapInitiallyOpen);

            // Show the container for the show & hide icons, which is outside of the overview map's frame,
            // and enable the icons
            $("#showHideOverview").css("visibility", "visible");

            $('#showOverview').on('click', function () {
                visualsController._showOverviewMap(true);
            });

            $('#hideOverview').on('click', function () {
                visualsController._showOverviewMap(false);
            });
        },

        _showOverviewMap: function (show) {
            visualsController._overviewMapVisible = show;
            $("#overviewMap").css("visibility", show ? "visible" : "hidden");
            visualsController._updateIconToggle(show, "hideOverview", "showOverview");
        },

        _updateIconToggle: function (state, onIconId, offIconId) {
            visualsController._showIcon(onIconId, state);
            visualsController._showIcon(offIconId, !state);
        },

        _showIcon: function (iconId, makeVisible) {
            document.getElementById(iconId).style.display = makeVisible
                ? "block"
                : "none";
        },

        _showNewSurvey: function (ignore, candidate) {
            // id:num
            // obj:feature{}
            // numPhotos:num
            // attachments:[{id,url},...]
            visualsController._currentCandidate = candidate;
            visualsController._iSelectedPhoto = -1;

            if (visualsController._prepareAppConfigInfo.appParams.includeOverviewMap) {
                // Jump the overview map to candidate.obj.geometry after transforming to lat/long;
                // we've asked the server to give us the geometry in lat/long (outSR=4326) for Leaflet
                visualsController.overviewMap.setView([candidate.obj.geometry.y, candidate.obj.geometry.x],
                    visualsController._prepareAppConfigInfo.appParams.overviewMapZoom);
            }

            // Gallery
            var carouselSlidesHolder = $("#carouselSlidesHolder")[0];
            $(carouselSlidesHolder).children().remove();  // remove children and their events
            var carouselIndicatorsHolder = $("#carouselIndicatorsHolder")[0];
            $(carouselIndicatorsHolder).children().remove();  // remove children and their events
            var initiallyActiveItem =
                Math.floor((visualsController._currentCandidate.numPhotos + 1) / 2) - 1;  // len=1,2: idx=0; len=3,4; idx=1; etc. (idx 0-based)

            var showThumbnails = (visualsController._prepareAppConfigInfo.appParams.thumbnailLimit < 0) ||
                (candidate.attachments.length <= visualsController._prepareAppConfigInfo.appParams.thumbnailLimit);

            $.each(candidate.attachments, function (indexInArray, attachment) {
                visualsController._addPhoto(carouselSlidesHolder, indexInArray, (initiallyActiveItem === indexInArray), attachment.url);
                if (showThumbnails) {
                    visualsController._addPhotoIndicator(carouselIndicatorsHolder, indexInArray, (initiallyActiveItem === indexInArray),
                        "carousel", attachment.url);
                }
            });
            $("#carousel").trigger("create");

            visualsController._updatePhotoSelectionDisplay();

            // Continue the visual feedback for the switch to a new survey
            visualsController._showVisuals();
        },

        _addPhoto: function (carouselSlidesHolder, indexInArray, isActive, photoUrl) {
            // <div id='carousel0' class='item active'><img src='__test/VIRB0125.JPG' alt='VIRB0125.JPG'></div>
            // var content = "<div id='c" + indexInArray + "' class='item" + (isActive ? " active" : "") +
            //    "'><img src='" + photoUrl + "'></div>";
            // $(carouselSlidesHolder).append(content);

            var content = "<div id='c" + indexInArray + "' class='item" + (isActive
                ? " active"
                : "") + "'><img /></div>";
            $(carouselSlidesHolder).append(content);

            var img = $("#c" + indexInArray + " img")[0];
            img.src = photoUrl;
            $(img).on('error', function () {
                img.src = "images/noPhoto.png";
                $(img).css("margin", "auto");
            });
        },

        _addPhotoIndicator: function (carouselIndicatorsHolder, indexInArray, isActive, carouselId, photoUrl) {
            // <li data-target='"'#myCarousel' data-slide-to='0' class='active'></li>
            var content = "<li id='indicator-" + indexInArray + "' data-target='#" + carouselId + "' data-slide-to='" + indexInArray +
                    "'" + (isActive
                ? " class='active'"
                : "") + "></li>";
            $(carouselIndicatorsHolder).append(content);
            $("#indicator-" + indexInArray).css("background-image", "url(" + photoUrl + ")");
        },

        _updatePhotoSelectionDisplay: function () {
            // After carousel slide
            visualsController._iVisiblePhoto = parseInt($("#carouselSlidesHolder > .item.active")[0].id.substring(1));

            // Update left & right sliders for where we are in the carousel to block wrapping of carousel movement
            $("#leftCarouselCtl").css("display", (visualsController._iVisiblePhoto === 0
                ? "none"
                : "block"));
            $("#rightCarouselCtl").css("display", (visualsController._iVisiblePhoto === (visualsController._currentCandidate.numPhotos - 1)
                ? "none"
                : "block"));

            if (visualsController._prepareAppConfigInfo.appParams.bestPhotoField) {
                // Update selected photo indicator
                visualsController._photoSelected = visualsController._iVisiblePhoto === visualsController._iSelectedPhoto;
                visualsController._updateIconToggle(visualsController._photoSelected, "filledHeart", "emptyHeart");
                $("#hearts").attr("title",
                        (visualsController._photoSelected
                    ? i18n.tooltips.button_best_image
                    : i18n.tooltips.button_click_if_best_image));
                $("#hearts")[0].style.display = "block";
            }
        }

        //------------------------------------------------------------------------------------------------------------//
    };
    return visualsController;
});
