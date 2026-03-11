// Visit tracking script
// Automatically tracks page visits for analytics

(function() {
    'use strict';

    // Track visit on page load
    function trackVisit() {
        try {
            const pageUrl = window.location.href;

            // Send tracking request
            fetch('/api/track-visit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    page: pageUrl
                })
            }).catch(err => {
                // Silent fail - don't disrupt user experience
                console.debug('Visit tracking failed:', err);
            });
        } catch (error) {
            // Silent fail
            console.debug('Visit tracking error:', error);
        }
    }

    // Track visit when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', trackVisit);
    } else {
        trackVisit();
    }
})();
