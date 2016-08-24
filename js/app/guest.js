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
    var user = {
        //------------------------------------------------------------------------------------------------------------//

        launch: function (prepareAppConfigInfo, splash, actionButtonContainer) {
            $("<div id='guestSignin' class='splashInfoActionButton guestOfficialColor'><span class='socialMediaIcon sprites guest-user_29'></span>"
                    + i18n.signin.guestLabel + "</div>").appendTo(actionButtonContainer);
            $("#guestSignin").on("click", function () {
                $.publish("signedIn:user", {
                    name: i18n.signin.guestLabel,
                    id: "",
                    canSubmit: prepareAppConfigInfo.appParams.allowGuestSubmissions
                });
            });
            splash.replacePrompt(i18n.signin.signinLoginPrompt, splash.showActions);
        },

        signout: function () {
            $.publish("signedOut:user");
        },

        //------------------------------------------------------------------------------------------------------------//
    };
    return user;
});
