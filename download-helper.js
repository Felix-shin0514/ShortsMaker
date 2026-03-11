/**
 * Download Helper Component
 * Floating button with popup for external video download sites
 */

(function() {
    // Create download helper component
    function createDownloadHelper() {
        // Check if already exists
        if (document.getElementById('download-helper-wrapper')) return;

        const wrapper = document.createElement('div');
        wrapper.id = 'download-helper-wrapper';
        wrapper.innerHTML = `
            <button id="download-helper-btn" class="download-helper-btn" title="영상 다운로드 도우미">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
            </button>
            <div id="download-helper-popup" class="download-helper-popup hidden">
                <div class="download-helper-header">
                    <h3>영상 다운로드 도우미</h3>
                    <button class="download-helper-close" onclick="closeDownloadHelper()">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <div class="download-helper-body">
                    <p class="download-helper-desc">
                        틱톡, 쇼츠, 인스타 영상을 무료로<br>다운로드할 수 있는 사이트들이에요
                    </p>
                    <div class="download-helper-list">
                        <a href="https://snaptik.app" target="_blank" class="download-helper-item">
                            <div class="download-helper-item-icon" style="background: linear-gradient(135deg, #00f2ea, #ff0050);">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                                </svg>
                            </div>
                            <div class="download-helper-item-info">
                                <div class="download-helper-item-name">TikTok</div>
                                <div class="download-helper-item-url">snaptik.app</div>
                            </div>
                            <svg class="download-helper-item-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M7 17L17 7M17 7H7M17 7V17"/>
                            </svg>
                        </a>
                        <a href="https://ssyoutube.com" target="_blank" class="download-helper-item">
                            <div class="download-helper-item-icon" style="background: #ff0000;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                </svg>
                            </div>
                            <div class="download-helper-item-info">
                                <div class="download-helper-item-name">YouTube</div>
                                <div class="download-helper-item-url">ssyoutube.com</div>
                            </div>
                            <svg class="download-helper-item-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M7 17L17 7M17 7H7M17 7V17"/>
                            </svg>
                        </a>
                        <a href="https://snapinsta.app" target="_blank" class="download-helper-item">
                            <div class="download-helper-item-icon" style="background: linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                                </svg>
                            </div>
                            <div class="download-helper-item-info">
                                <div class="download-helper-item-name">Instagram</div>
                                <div class="download-helper-item-url">snapinsta.app</div>
                            </div>
                            <svg class="download-helper-item-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M7 17L17 7M17 7H7M17 7V17"/>
                            </svg>
                        </a>
                    </div>
                    <p class="download-helper-note">
                        * 외부 사이트이며 ShortsCraft와 관련 없습니다
                    </p>
                </div>
            </div>
        `;

        document.body.appendChild(wrapper);

        // Add event listeners
        const btn = document.getElementById('download-helper-btn');
        btn.addEventListener('click', toggleDownloadHelper);

        // Close on outside click
        document.addEventListener('click', function(e) {
            const wrapper = document.getElementById('download-helper-wrapper');
            const popup = document.getElementById('download-helper-popup');
            if (wrapper && popup && !wrapper.contains(e.target)) {
                popup.classList.add('hidden');
            }
        });
    }

    function toggleDownloadHelper() {
        const popup = document.getElementById('download-helper-popup');
        if (popup) {
            popup.classList.toggle('hidden');
        }
    }

    function closeDownloadHelper() {
        const popup = document.getElementById('download-helper-popup');
        if (popup) {
            popup.classList.add('hidden');
        }
    }

    // Expose to global scope
    window.closeDownloadHelper = closeDownloadHelper;

    // Add CSS styles
    function addStyles() {
        if (document.getElementById('download-helper-styles')) return;

        const style = document.createElement('style');
        style.id = 'download-helper-styles';
        style.textContent = `
            #download-helper-wrapper {
                position: fixed;
                bottom: 24px;
                right: 24px;
                z-index: 9999;
            }

            .download-helper-btn {
                width: 48px;
                height: 48px;
                border-radius: 50%;
                background: linear-gradient(135deg, #333, #222);
                border: 1px solid #444;
                color: #888;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            }

            .download-helper-btn:hover {
                background: linear-gradient(135deg, #ff6b00, #ff8500);
                border-color: #ff6b00;
                color: #fff;
                transform: scale(1.1);
            }

            .download-helper-popup {
                position: absolute;
                bottom: 60px;
                right: 0;
                width: 300px;
                background: #1a1a1a;
                border: 1px solid #333;
                border-radius: 16px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
                overflow: hidden;
                animation: slideUp 0.3s ease;
            }

            .download-helper-popup.hidden {
                display: none;
            }

            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .download-helper-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px 20px;
                border-bottom: 1px solid #333;
            }

            .download-helper-header h3 {
                font-size: 15px;
                font-weight: 600;
                color: #fff;
                margin: 0;
            }

            .download-helper-close {
                background: none;
                border: none;
                color: #666;
                cursor: pointer;
                padding: 4px;
                transition: color 0.2s;
            }

            .download-helper-close:hover {
                color: #fff;
            }

            .download-helper-body {
                padding: 16px 20px;
            }

            .download-helper-desc {
                font-size: 13px;
                color: #888;
                line-height: 1.5;
                margin-bottom: 16px;
                text-align: center;
            }

            .download-helper-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .download-helper-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                background: #222;
                border-radius: 10px;
                text-decoration: none;
                transition: all 0.2s ease;
            }

            .download-helper-item:hover {
                background: #2a2a2a;
                transform: translateX(4px);
            }

            .download-helper-item-icon {
                width: 36px;
                height: 36px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }

            .download-helper-item-info {
                flex: 1;
            }

            .download-helper-item-name {
                font-size: 14px;
                font-weight: 500;
                color: #fff;
            }

            .download-helper-item-url {
                font-size: 12px;
                color: #666;
            }

            .download-helper-item-arrow {
                color: #666;
                transition: color 0.2s;
            }

            .download-helper-item:hover .download-helper-item-arrow {
                color: #ff6b00;
            }

            .download-helper-note {
                font-size: 11px;
                color: #555;
                text-align: center;
                margin-top: 16px;
            }

            @media (max-width: 480px) {
                #download-helper-wrapper {
                    bottom: 16px;
                    right: 16px;
                }

                .download-helper-popup {
                    width: calc(100vw - 32px);
                    right: -8px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            addStyles();
            createDownloadHelper();
        });
    } else {
        addStyles();
        createDownloadHelper();
    }
})();
