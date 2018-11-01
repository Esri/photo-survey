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
            h1_title: "Foto Bewertung",
            h2_splash: "Schließen Sie mit Social Media",
            h2_illustration: "Fotogalerie",
            h2_activity: "Umfrage und Profil",
            h2_additionalInfo: "Weitere Informationen"
        },
        tooltips: {
            button_additionalInfo: "Weitere Informationen",
            button_close: "Schließen Sie das zusätzliche Informationstafel",
            flag_important_question: "Bitte beantworten Sie diese Frage",
            button_previous_image: "Vorheriges Bild",
            button_next_image: "Nächstes Bild",
            button_best_image: "Dies ist das beste Foto für die Eigenschaft",
            button_click_if_best_image: "Klicken Sie, wenn dies der beste Foto für die Eigenschaft",
            button_skip: "Überspringen",
            button_submit: "Senden Sie der Fragebogen"
        },
        labels: {
            menuItem_profile: "Dein Profil",
            menuItem_signout: "Abmelden",
            button_close: "Schließen",
            label_surveys_completed: "Fragebögen abgeschlossen",
            label_level: "niveau ${0}",
            label_remaining_surveys: "${0} Fragebögen das nächste Niveau zu erreichen",
            button_returnToSurvey: "&lt; Zurück auf den Fragebogen"
        },
        signin: {
            checkingServer: "Prüfung der Verfügbarkeit des Servers...",
            unsupported: "Diese Version von Internet Explorer wird nicht unterstützt. Bitte verwenden Sie Internet Explorer 10 oder neuer.",
            needProxy: "Diese Version von Internet Explorer wird nicht von unserem Server unterstützt. Bitte verwenden Sie Internet Explorer 10 oder neuer.",
            signinFetching: "Überprüfung der Verfügbarkeit des Anschlussmöglichkeiten...",
            signinLoginPrompt: "Bitte loggen Sie ein, um loszulegen",
            noMoreSurveys: "Es sind keine Umfragen vorhanden zu diesem Zeitpunkt; vielen Dank für Ihre Teilnahme.",
            guestLabel: "Gast"
        },
        messages: {
            error_text: "Frage $ {0} Fehler, der die Frage anzeigt, überprüfen Sie bitte, ob der Feldname aus der Umfrage-Frage-Tabelle mit dem Feature",
            domain_error_text: "Frage $ {0} Fehler beim Anzeigen der Frage. Fragen zu Schaltflächen, Listen und Dropdown-Formaten erfordern, dass das verknüpfte Feld eine Domäne hat."
        }
    })
);
