/**
 * DiscoCinema Discord Activity App Logic
 * Optimized for Iframe Stability, Event Delegation, and Scale Management
 */

const CONFIG = {
    INVITE: "https://discord.gg/SJcdkaJXcf",
    TOS: "https://sites.google.com/view/discocinema/terms",
    PRIVACY: "https://sites.google.com/view/discocinema/privacy",
    DMCA: "https://sites.google.com/view/discocinema/dmca"
};

/**
 * Handle View Switching (Main Navigation)
 */
function handleViewSwitch(viewId, triggerEl) {
    if (!viewId || !triggerEl) return;

    // Update Nav UI
    document.querySelectorAll('.navbar .nav-tab').forEach(btn => btn.classList.remove('active'));
    triggerEl.classList.add('active');

    // Update View UI
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.add('active');
        // Reset scroll position when switching views
        const container = target.querySelector('.glass-container');
        if (container) container.scrollTo(0, 0);
    }
}

/**
 * Handle Legal Sub-tab Switching
 */
function handleLegalSwitch(legalId, triggerEl) {
    if (!legalId || !triggerEl) return;

    // Update sub-tab buttons within the legal view
    document.querySelectorAll('.legal-subtab').forEach(btn => btn.classList.remove('active'));
    triggerEl.classList.add('active');

    // Update displayed legal content sections
    document.querySelectorAll('.legal-section').forEach(sec => sec.classList.remove('active'));
    const target = document.getElementById(legalId);
    if (target) {
        target.classList.add('active');
    }
}

/**
 * Enhanced Clipboard Functionality
 * Uses modern API with a robust fallback for iframe environments
 */
async function copyToClipboard(text, statusId) {
    const statusEl = document.getElementById(statusId);
    
    const fallbackCopy = (str) => {
        const el = document.createElement('textarea');
        el.value = str;
        el.setAttribute('readonly', '');
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        const success = document.execCommand('copy');
        document.body.removeChild(el);
        return success;
    };

    try {
        let successful = false;
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            successful = true;
        } else {
            successful = fallbackCopy(text);
        }
        
        if (successful && statusEl) {
            const originalText = statusEl.textContent;
            statusEl.textContent = "COPIED!";
            statusEl.style.color = "var(--success)";
            
            setTimeout(() => {
                statusEl.textContent = originalText;
                statusEl.style.color = "";
            }, 1500);
        }
    } catch (err) {
        console.error('Clipboard error:', err);
    }
}

/**
 * Global Event Delegation
 * Centralized handling for better performance in the Discord Activity environment
 * This replaces all inline 'onclick' attributes from the HTML.
 */
document.addEventListener('click', (e) => {
    // 1. Legal Section Sub-tabs (Handle FIRST and stop propagation)
    const legalBtn = e.target.closest('.legal-subtab');
    if (legalBtn && legalBtn.dataset.legal) {
        e.preventDefault();
        e.stopPropagation(); // Prevents this click from reaching main nav logic
        handleLegalSwitch(legalBtn.dataset.legal, legalBtn);
        return;
    }

    // 2. Main Navigation Tabs (Home / Legal)
    const navBtn = e.target.closest('.nav-tab:not(.legal-subtab)');
    if (navBtn && navBtn.dataset.view) {
        e.preventDefault();
        handleViewSwitch(navBtn.dataset.view, navBtn);
        return;
    }

    // 3. Link Copying (Discord Invite and Legal URLs)
    const copyBox = e.target.closest('.copy-box');
    if (copyBox) {
        e.preventDefault();
        const id = copyBox.id;
        const statusEl = copyBox.querySelector('.copy-status');
        const statusId = statusEl ? statusEl.id : null;
        
        if (!statusId) return;

        switch(id) {
            case 'discord-copy': copyToClipboard(CONFIG.INVITE, statusId); break;
            case 'tos-copy':     copyToClipboard(CONFIG.TOS, statusId); break;
            case 'privacy-copy': copyToClipboard(CONFIG.PRIVACY, statusId); break;
            case 'dmca-copy':    copyToClipboard(CONFIG.DMCA, statusId); break;
        }
    }
});

/**
 * Window Resize/Scaling Helper
 */
function onResize() {
    // Ensure the body maintains focus for keyboard accessibility
    if (document.activeElement === document.body || document.activeElement === null) {
        document.body.focus();
    }
}

/**
 * App Initialization
 */
function initApp() {
    console.log("DiscoCinema App Logic V1.0.4 Initialized");
    window.addEventListener('resize', onResize);
    
    // Set initial focus
    document.body.tabIndex = -1;
    document.body.focus();
}

// Ensure init runs after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
