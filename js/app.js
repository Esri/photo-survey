// Source:  https://github.com/requirejs/example-jquery-cdn/blob/master/www/js/app.js
// Place third party dependencies in the lib folder
//
// Configure loading modules from the lib directory,
// except 'app' ones,
requirejs.config({
    "baseUrl": "js/lib",
    "paths": {
        "app": "../app",
        "nls": "../nls"
    }
});

// Load the main app module to start the app
requirejs(["app/main"]);
