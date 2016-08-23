/*global define */
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
define(
    ({
        screenreader: {  // Document structure for screen reader devices
            h1_title: "Évaluation de photos",
            h2_splash: "Connectez-vous dans les médias sociaux",
            h2_illustration: "Galerie de photos",
            h2_activity: "Évaluation de photos et profil de l'utilisateur",
            h2_additionalInfo: "Informations complémentaires"
        },
        tooltips: {
            button_additionalInfo: "Informations complémentaires",
            button_close: "Fermez le panneau de informations complémentaires",
            flag_important_question: "S'il vous plaît répondre à cette question",
            button_previous_image: "Image précédente",
            button_next_image: "Image suivante",
            button_best_image: "Ceci est la meilleure photo pour la propriété",
            button_click_if_best_image: "Cliquez si cela est la meilleure photo pour la propriété",
            button_skip: "Sauter",
            button_submit: "Soumettre le questionnaire"
        },
        labels: {
            menuItem_profile: "Votre profil",
            menuItem_signout: "Se déconnecter",
            button_close: "Fermez",
            label_surveys_completed: "questionnaires remplis",
            label_level: "niveau ${0}",
            label_remaining_surveys: "${0} questionnaires pour atteindre le prochain niveau",
            button_returnToSurvey: "&lt; Retourner au questionnaire"
        },
        signin: {
            checkingServer: "Vérification de la disponibilité du serveur...",
            unsupported: "Cette version d'Internet Explorer ne sont pas pris en charge. S'il vous plaît utiliser Internet Explorer 10 ou plus récent.",
            needProxy: "Cette version d'Internet Explorer ne sont pas pris en charge par notre serveur. S'il vous plaît utiliser Internet Explorer 10 ou plus récent.",
            signinFetching: "Vérification de la disponibilité des possibilités de connexion...",
            signinLoginPrompt: "S'il vous plaît vous connecter pour commencer",
            lookingForSurveys: "À la recherche de des sondages...",
            noMoreSurveys: "Il n'y a pas de sondages disponibles à ce moment. Merci pour votre participation.",
            noSigninsAvailable: "Il n'y a pas les connexions disponibles",
            guestLabel: "Invité"
        }
    })
);
