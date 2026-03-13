/**
 * CinemaSync SDK Proxy Loader
 * This script attempts to load the Discord SDK dynamically.
 */
(function() {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@discord/embedded-app-sdk@1.1.0/dist/index.js';
    script.async = true;
    script.onload = () => {
        console.log("Discord SDK Proxy: Loaded successfully.");
    };
    script.onerror = () => {
        console.error("Discord SDK Proxy: Failed to load from CDN.");
    };
    document.head.appendChild(script);
})();
