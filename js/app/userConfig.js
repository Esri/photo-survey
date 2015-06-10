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
    return {

        name: "",
        avatar: null,
        completions: 0,  //??? source?


        init: function () {
            var deferred = $.Deferred();
            setTimeout(function () {  //??? TODO: init social media
                deferred.resolve();
            }, 1000);

            return deferred;
        },

        signIn: function () {
            var deferred, self = this;

            deferred = $.Deferred();
            setTimeout(function () {
                var iUser = Math.floor(Math.random() * self._users.length);  //??? testing only
                self.name = self._users[iUser].name;
                self.avatar = self._users[iUser].avatar;
                self.completions = self._users[iUser].completions;
                deferred.resolve();
            }, 200);

            return deferred;
        },

        signOut: function () {
            name = "";
            avatar = null;
            completions = 0;
        },




        // Username and avatar from social media; completions from ?query on feature service's 'surveryor' field?
        _users: [{  //??? testing only
            name: "Cyd Charisse",
            completions: 164,
            avatar: null
        }, {
            name: "Debbie Reynolds",
            completions: 1774,
            avatar: null
        }, {
            name: "Deborah Kerr",
            completions: 845,
            avatar: null
        }, {
            name: "Donald O'Connor",
            completions: 800,
            avatar: null
        }, {
            name: "Fayard Nicholas",
            completions: 400,
            avatar: null
        }, {
            name: "Frank Morgan",
            completions: 641,
            avatar: null
        }, {
            name: "Fred Astaire",
            completions: 1355,
            avatar: null
        }, {
            name: "Gene Kelly",
            completions: 398,
            avatar: null
        }, {
            name: "Ginger Rogers",
            completions: 612,
            avatar: null
        }, {
            name: "Harold Nicholas",
            completions: 29,
            avatar: null
        }, {
            name: "Marni Nixon",
            completions: 1191,
            avatar: null
        }]

    };
});
