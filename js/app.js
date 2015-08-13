// Main module is in js/app directory, and it refers to third-party libraries in the js/lib directory
requirejs.config({
    baseUrl: "js/app",
    paths: {
        lib: "../lib"
    }
});

// Load the main app module to start the app
requirejs(["main"]);
