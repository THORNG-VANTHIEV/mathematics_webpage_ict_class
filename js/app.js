    /**
     * Interactive Learning Platform Application (HTML/CSS/JS)
     * Computer for Office Application - Office 2021
     * Regional Polytechnic Institute Techo Sen Siem Reap
     */

    (function () {
      'use strict';

      // State Management
      const state = {
        currentLessonId: 'lesson-01',
        currentView: 'lesson', // 'lesson', 'home', 'preface', 'intro', 'references'
        completedLessons: new Set(),
        theme: 'light',
        fontScale: 1, // 0.92, 1, 1.15
        searchQuery: '',
        lightboxImg: null,
        lightboxZoom: 1,
        mobileSidebarOpen: false,
        sidebarCollapsed: false
      };

      // DOM Elements cache
      const el = {};

      // Khmer numerals for lesson / page / count labels (product names like "2021" stay as-is)
      const KH_DIGITS = '០១២៣៤៥៦៧៨៩';
      function kh(value) {
        return String(value).replace(/[0-9]/g, d => KH_DIGITS[d]);
      }

      // Reading-time estimate from the lesson's page range in the printed book
      const MINUTES_PER_PAGE = 5;
      function studyTimeLabel(lesson) {
        const pages = Math.max(1, (lesson.pageEnd || 0) - (lesson.pageStart || 0) + 1);
        const minutes = Math.max(15, Math.round(pages * MINUTES_PER_PAGE / 5) * 5);
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        if (h === 0) return `~${kh(m)} នាទី`;
        return m ? `~${kh(h)} ម៉ោង ${kh(m)} នាទី` : `~${kh(h)} ម៉ោង`;
      }

      // Table cells are strings, or {text, colspan} for merged cells in the book
      function cellText(c) {
        return typeof c === 'string' ? c : (c && c.text) || '';
      }
      function tableCell(tag, c) {
        const span = c && typeof c === 'object' && c.colspan > 1 ? ` colspan="${c.colspan}"` : '';
        return `<${tag}${span}>${formatInlineContent(cellText(c))}</${tag}>`;
      }

      function completeButtonInner(isDone) {
        return isDone
          ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> បានរៀនរួច`
          : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg> សម្គាល់ថាបានរៀន`;
      }

      // Scroll the sidebar (not the page) so the active item is visible
      function scrollSidebarToActive() {
        const active = el.sidebar && el.sidebar.querySelector('.lesson-nav-btn.active, .nav-item-link.active');
        if (!active) return;
        let box = active.parentElement;
        while (box && box !== document.body) {
          const oy = getComputedStyle(box).overflowY;
          if ((oy === 'auto' || oy === 'scroll') && box.scrollHeight > box.clientHeight) break;
          box = box.parentElement;
        }
        if (!box || box === document.body) return;
        const a = active.getBoundingClientRect();
        const b = box.getBoundingClientRect();
        box.scrollTop += (a.top - b.top) - (b.height / 2) + (a.height / 2);
      }

      function applyPlatformShortcutHint() {
        const isApple = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
        const key = document.getElementById('searchShortcutModKey');
        if (key && isApple) key.textContent = '⌘';
      }

      function init() {
        cacheDom();
        applyPlatformShortcutHint();
        loadPreferences();
        bindEvents();
        renderSidebar();
        handleRoute();
        updateProgressTracker();
        registerServiceWorker();
      }

      function registerServiceWorker() {
        if ('serviceWorker' in navigator && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
          window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').then((reg) => {
              console.log('Office 2021 ServiceWorker active for offline study:', reg.scope);
            }).catch((err) => {
              console.log('ServiceWorker note:', err);
            });
          });
        }
      }

      function cacheDom() {
        el.html = document.documentElement;
        el.themeToggleBtn = document.getElementById('themeToggleBtn');
        el.themeIcon = document.getElementById('themeIcon');
        el.btnFontDec = document.getElementById('btnFontDec');
        el.btnFontReset = document.getElementById('btnFontReset');
        el.btnFontInc = document.getElementById('btnFontInc');
        el.mobileSearchBtn = document.getElementById('mobileSearchBtn');
        el.sidebar = document.getElementById('sidebar');
        el.sidebarToggleBtn = document.getElementById('sidebarToggleBtn') || document.getElementById('mobileMenuBtn');
        el.sidebarMinimizeBtn = document.getElementById('sidebarMinimizeBtn');
        el.floatingSidebarBtn = document.getElementById('floatingSidebarBtn');
        el.appContainer = document.querySelector('.app-container');
        el.mainContent = document.getElementById('mainContent');
        el.searchTriggerBtn = document.getElementById('searchTriggerBtn');
        el.searchModal = document.getElementById('searchModal');
        el.searchInput = document.getElementById('searchInput');
        el.searchResults = document.getElementById('searchResults');
        el.closeSearchBtn = document.getElementById('closeSearchBtn');
        el.lightboxModal = document.getElementById('lightboxModal');
        el.lightboxImage = document.getElementById('lightboxImage');
        el.lightboxCaption = document.getElementById('lightboxCaption');
        el.closeLightboxBtn = document.getElementById('closeLightboxBtn');
        el.tableModal = document.getElementById('tableModal');
        el.tableModalTitle = document.getElementById('tableModalTitle');
        el.tableModalBody = document.getElementById('tableModalBody');
        el.closeTableModalBtn = document.getElementById('closeTableModalBtn');
        el.tableModalBackdrop = document.getElementById('tableModalBackdrop');
        el.progressFill = document.getElementById('progressFill');
        el.progressText = document.getElementById('progressText');
        el.toastContainer = document.getElementById('toastContainer');
        el.sidebarBackdrop = document.getElementById('sidebarBackdrop');
        el.mbarMenuBtn = document.getElementById('mbarMenuBtn');
        el.mbarPrevBtn = document.getElementById('mbarPrevBtn');
        el.mbarNextBtn = document.getElementById('mbarNextBtn');
        el.mbarSearchBtn = document.getElementById('mbarSearchBtn');
        el.mbarTopBtn = document.getElementById('mbarTopBtn');
      }

      function loadPreferences() {
        // Theme
        const savedTheme = localStorage.getItem('rpitssr_theme');
        if (savedTheme) {
          state.theme = savedTheme;
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          state.theme = 'dark';
        } else {
          state.theme = 'light';
        }
        applyTheme(state.theme);

        // Sidebar Collapsed Preference (Desktop)
        const savedCollapsed = localStorage.getItem('rpitssr_sidebar_collapsed');
        if (savedCollapsed === 'true' && window.innerWidth > 768) {
          setSidebarCollapsed(true, false);
        }

        // Font Scale (Khmer OS Siemreap readability)
        const savedScale = localStorage.getItem('rpitssr_font_scale');
        if (savedScale) {
          applyFontScale(parseFloat(savedScale));
        } else {
          applyFontScale(1);
        }

        // Completed Lessons
        try {
          const savedCompleted = JSON.parse(localStorage.getItem('rpitssr_completed_lessons') || '[]');
          state.completedLessons = new Set(savedCompleted);
        } catch (e) {
          state.completedLessons = new Set();
        }
      }

      function applyFontScale(scale) {
        state.fontScale = scale;
        el.html.style.setProperty('--font-scale', scale);
        localStorage.setItem('rpitssr_font_scale', scale);
        if (el.btnFontDec && el.btnFontReset && el.btnFontInc) {
          el.btnFontDec.classList.toggle('active', scale < 0.98);
          el.btnFontReset.classList.toggle('active', Math.abs(scale - 1) < 0.05);
          el.btnFontInc.classList.toggle('active', scale > 1.05);
        }

        // Update mobile reader popover buttons & badge
        const mDec = document.getElementById('mBtnFontDec');
        const mReset = document.getElementById('mBtnFontReset');
        const mInc = document.getElementById('mBtnFontInc');
        const mBadge = document.getElementById('readerFontBadge');

        if (mDec && mReset && mInc) {
          mDec.classList.toggle('active', scale < 0.98);
          mReset.classList.toggle('active', Math.abs(scale - 1) < 0.05);
          mInc.classList.toggle('active', scale > 1.05);
        }
        if (mBadge) {
          mBadge.textContent = scale < 0.98 ? '៩២%' : (scale > 1.05 ? '១១៥%' : '១០០%');
        }

        setTimeout(autoScaleTables, 60);
      }

      function applyTheme(theme) {
        state.theme = theme;
        el.html.setAttribute('data-theme', theme);
        localStorage.setItem('rpitssr_theme', theme);
        if (el.themeIcon) {
          if (theme === 'dark') {
            el.themeIcon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
          } else {
            el.themeIcon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
          }
        }
      }

      function toggleTheme() {
        applyTheme(state.theme === 'dark' ? 'light' : 'dark');
      }

      function bindEvents() {
        // Theme toggle
        if (el.themeToggleBtn) {
          el.themeToggleBtn.addEventListener('click', toggleTheme);
        }

        // Font scale buttons (Desktop)
        if (el.btnFontDec) {
          el.btnFontDec.addEventListener('click', () => applyFontScale(0.92));
        }
        if (el.btnFontReset) {
          el.btnFontReset.addEventListener('click', () => applyFontScale(1));
        }
        if (el.btnFontInc) {
          el.btnFontInc.addEventListener('click', () => applyFontScale(1.15));
        }

        // Font scale buttons (Mobile Reader Popover)
        const mDec = document.getElementById('mBtnFontDec');
        const mReset = document.getElementById('mBtnFontReset');
        const mInc = document.getElementById('mBtnFontInc');
        if (mDec) mDec.addEventListener('click', () => applyFontScale(0.92));
        if (mReset) mReset.addEventListener('click', () => applyFontScale(1));
        if (mInc) mInc.addEventListener('click', () => applyFontScale(1.15));

        // Mobile Reader popover toggle
        const mobReaderBtn = document.getElementById('mobileReaderBtn');
        const readerPopover = document.getElementById('readerPopover');
        if (mobReaderBtn && readerPopover) {
          mobReaderBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = readerPopover.classList.contains('active');
            readerPopover.classList.toggle('active', !isOpen);
            mobReaderBtn.classList.toggle('active', !isOpen);
          });
        }

        // Sidebar Drawer (Mobile) & Collapse / Minimize (Desktop)
        function setMobileSidebar(open) {
          state.mobileSidebarOpen = open;
          if (el.sidebar) el.sidebar.classList.toggle('mobile-open', open);
          if (el.sidebarBackdrop) el.sidebarBackdrop.classList.toggle('active', open);
          document.body.style.overflow = (open && window.innerWidth <= 768) ? 'hidden' : '';
          if (open) requestAnimationFrame(scrollSidebarToActive);
        }

        function setSidebarCollapsed(collapsed, save = true) {
          state.sidebarCollapsed = collapsed;
          if (el.appContainer) {
            el.appContainer.classList.toggle('sidebar-collapsed', collapsed);
          }
          if (el.sidebarToggleBtn) {
            el.sidebarToggleBtn.classList.toggle('collapsed', collapsed);
            el.sidebarToggleBtn.setAttribute('title', collapsed ? 'ពង្រីកផ្ទាំងមាតិកា (Expand Sidebar)' : 'បង្រួញផ្ទាំងមាតិកា (Minimize Sidebar)');
          }
          if (el.floatingSidebarBtn) {
            el.floatingSidebarBtn.style.display = (collapsed && window.innerWidth > 768) ? 'inline-flex' : 'none';
          }
          if (save) {
            localStorage.setItem('rpitssr_sidebar_collapsed', collapsed ? 'true' : 'false');
          }
        }

        function toggleSidebar() {
          if (window.innerWidth <= 768) {
            setMobileSidebar(!state.mobileSidebarOpen);
          } else {
            setSidebarCollapsed(!state.sidebarCollapsed);
          }
        }

        if (el.sidebarToggleBtn) {
          el.sidebarToggleBtn.addEventListener('click', toggleSidebar);
        }
        if (el.floatingSidebarBtn) {
          el.floatingSidebarBtn.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
              setMobileSidebar(true);
            } else {
              setSidebarCollapsed(false);
            }
          });
        }
        if (el.sidebarBackdrop) {
          el.sidebarBackdrop.addEventListener('click', () => setMobileSidebar(false));
        }

        // Delegated clicks for minimize button and mobile links
        document.addEventListener('click', (e) => {
          if (e.target.closest('#sidebarMinimizeBtn')) {
            if (window.innerWidth <= 768) {
              setMobileSidebar(false);
            } else {
              setSidebarCollapsed(true);
            }
          }
          if (e.target.closest('#sidebarMobileCloseBtn') || (e.target.closest('#sidebar a') && window.innerWidth <= 768)) {
            setMobileSidebar(false);
          }
        });

        // Mobile Bottom Action Bar Controls
        if (el.mbarMenuBtn) {
          el.mbarMenuBtn.addEventListener('click', () => setMobileSidebar(true));
        }
        if (el.mbarSearchBtn) {
          el.mbarSearchBtn.addEventListener('click', openSearchModal);
        }
        if (el.mbarTopBtn) {
          el.mbarTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
        }
        if (el.mbarPrevBtn) {
          el.mbarPrevBtn.addEventListener('click', navigatePrevLesson);
        }
        if (el.mbarNextBtn) {
          el.mbarNextBtn.addEventListener('click', navigateNextLesson);
        }

        // Hash change router
        window.addEventListener('hashchange', handleRoute);

        // Search modal trigger
        if (el.searchTriggerBtn) {
          el.searchTriggerBtn.addEventListener('click', openSearchModal);
        }
        if (el.mobileSearchBtn) {
          el.mobileSearchBtn.addEventListener('click', openSearchModal);
        }
        if (el.closeSearchBtn) {
          el.closeSearchBtn.addEventListener('click', closeSearchModal);
        }
        if (el.searchModal) {
          el.searchModal.addEventListener('click', (e) => {
            if (e.target === el.searchModal) closeSearchModal();
          });
        }
        if (el.searchInput) {
          el.searchInput.addEventListener('input', (e) => {
            performSearch(e.target.value.trim());
          });
        }

        // Keyboard shortcuts: Ctrl+K or / to search, Esc to close
        document.addEventListener('keydown', (e) => {
          if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && document.activeElement !== el.searchInput)) {
            e.preventDefault();
            openSearchModal();
          } else if (e.key === 'Escape') {
            closeSearchModal();
            closeLightbox();
            window.closeTableModal();
            const popover = document.getElementById('readerPopover');
            const btn = document.getElementById('mobileReaderBtn');
            if (popover) popover.classList.remove('active');
            if (btn) btn.classList.remove('active');
          }
        });

        // Close reader popover on outside click
        document.addEventListener('click', (e) => {
          const popover = document.getElementById('readerPopover');
          const btn = document.getElementById('mobileReaderBtn');
          if (popover && popover.classList.contains('active')) {
            if (!popover.contains(e.target) && !btn?.contains(e.target)) {
              popover.classList.remove('active');
              if (btn) btn.classList.remove('active');
            }
          }
        });

        // Lightbox close
        if (el.closeLightboxBtn) {
          el.closeLightboxBtn.addEventListener('click', closeLightbox);
        }
        if (el.lightboxModal) {
          el.lightboxModal.addEventListener('click', (e) => {
            if (e.target === el.lightboxModal) closeLightbox();
          });
        }

        // Table modal close
        if (el.closeTableModalBtn) {
          el.closeTableModalBtn.addEventListener('click', window.closeTableModal);
        }
        if (el.tableModalBackdrop) {
          el.tableModalBackdrop.addEventListener('click', window.closeTableModal);
        }

        // Auto-scale tables on window resize
        let tableResizeTimer = null;
        window.addEventListener('resize', () => {
          clearTimeout(tableResizeTimer);
          tableResizeTimer = setTimeout(autoScaleTables, 120);
        });
      }

      function navigatePrevLesson() {
        const data = window.COURSE_DATA;
        if (!data || !data.lessons) return;
        const currentId = window.location.hash.replace('#', '') || 'home';
        if (currentId === 'references') {
          window.location.hash = `#${data.lessons[data.lessons.length - 1].id}`;
          return;
        }
        const idx = data.lessons.findIndex(l => l.id === currentId);
        if (idx > 0) {
          window.location.hash = `#${data.lessons[idx - 1].id}`;
        } else if (idx === 0) {
          window.location.hash = '#intro';
        } else if (currentId === 'intro') {
          window.location.hash = '#preface';
        } else if (currentId === 'preface') {
          window.location.hash = '#home';
        }
      }

      function navigateNextLesson() {
        const data = window.COURSE_DATA;
        if (!data || !data.lessons) return;
        const currentId = window.location.hash.replace('#', '') || 'home';
        if (currentId === 'home') {
          window.location.hash = '#preface';
        } else if (currentId === 'preface') {
          window.location.hash = '#intro';
        } else if (currentId === 'intro') {
          window.location.hash = `#${data.lessons[0].id}`;
        } else {
          const idx = data.lessons.findIndex(l => l.id === currentId);
          if (idx !== -1) {
            if (idx < data.lessons.length - 1) {
              window.location.hash = `#${data.lessons[idx + 1].id}`;
            } else if (idx === data.lessons.length - 1) {
              window.location.hash = '#references';
            }
          }
        }
      }

      function handleRoute() {
        const hash = window.location.hash.replace('#', '') || 'home';

        // Close mobile drawer if open
        state.mobileSidebarOpen = false;
        if (el.sidebar) el.sidebar.classList.remove('mobile-open');
        if (el.sidebarBackdrop) el.sidebarBackdrop.classList.remove('active');
        document.body.style.overflow = '';

        if (hash === 'home') {
          state.currentView = 'home';
          renderHomeView();
        } else if (hash === 'preface') {
          state.currentView = 'preface';
          renderPrefaceView();
        } else if (hash === 'intro') {
          state.currentView = 'intro';
          renderIntroView();
        } else if (hash === 'references') {
          state.currentView = 'references';
          renderReferencesView();
        } else if (hash.startsWith('lesson-') || hash.startsWith('solution-')) {
          state.currentView = 'lesson';
          state.currentLessonId = hash;
          renderLessonView(hash);
        } else {
          state.currentView = 'home';
          renderHomeView();
        }

        updateActiveSidebarItem();
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }

      // Sidebar Rendering
      function renderSidebar() {
        const data = window.COURSE_DATA;
        if (!data) return;

        let html = `
      <div class="sidebar-mobile-header">
        <div class="sidebar-mobile-title">
          <img src="images/logo.webp" alt="Logo" style="width:24px; height:24px; object-fit:contain;">
          <span>មាតិកាមេរៀន (${kh(data.lessons.length)} មេរៀន)</span>
        </div>
        <button class="sidebar-mobile-close-btn" id="sidebarMobileCloseBtn" aria-label="បិទមាតិកា">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <div class="sidebar-content">
        <div>
          <div class="sidebar-header-row">
            <div class="sidebar-section-title">ព័ត៌មានទូទៅ</div>
            <button class="sidebar-minimize-btn" id="sidebarMinimizeBtn" title="បង្រួញផ្ទាំងមាតិកា (Minimize Sidebar)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="11 19 4 12 11 5"></polyline><polyline points="18 19 11 12 18 5"></polyline></svg>
            </button>
          </div>
          <a href="#home" class="nav-item-link" id="nav-home">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            ទំព័រដើម & ក្របសៀវភៅ
          </a>
          <a href="#preface" class="nav-item-link" id="nav-preface">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            អារម្ភកថា (Preface)
          </a>
          <a href="#intro" class="nav-item-link" id="nav-intro">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            សេចក្តីផ្តើមនៃមុខវិជ្ជា
          </a>
        </div>

        <div>
          <div class="sidebar-section-title">មាតិកាមេរៀន (Chapters & Lessons)</div>
    `;

        data.chapters.forEach((chap, idx) => {
          const badgeClass = chap.id === 'chapter-solutions' ? 'chap-sol' : `chap-${idx + 1}`;
          const isOpen = idx === 0 ? 'open' : ''; // Open first chapter by default
          const chapLessons = data.lessons.filter(l => l.chapterId === chap.id);
          const countLabel = chap.id === 'chapter-solutions' ? `${kh(chapLessons.length)} កំណែ` : `${kh(chapLessons.length)} មេរៀន`;

          html += `
        <div class="chapter-accordion ${isOpen}" id="accordion-${chap.id}">
          <button class="chapter-header" onclick="window.toggleChapter('${chap.id}')">
            <div class="chapter-header-content">
              <div class="chapter-meta-row">
                <span class="chapter-badge ${badgeClass}">${chap.number}</span>
                <span class="chapter-count-text">${countLabel}</span>
              </div>
              <div class="chapter-title-text">${chap.title}</div>
            </div>
            <svg class="chapter-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <ul class="chapter-lessons-list">
      `;

          chapLessons.forEach(les => {
            const isDone = state.completedLessons.has(les.id);
            const isSol = les.id.startsWith('solution-');
            const pillLabel = isSol ? `គ.${kh(les.number)}` : kh(String(les.number).padStart(2, '0'));
            html += `
          <li>
            <div class="lesson-nav-btn" id="nav-${les.id}">
              <a href="#${les.id}" class="lesson-nav-left" style="text-decoration:none; color:inherit;">
                <span class="lesson-pill-num" style="${isSol ? 'background-color:rgba(13,148,136,0.15); color:#0d9488;' : ''}">${pillLabel}</span>
                <span class="lesson-nav-title">${les.title}</span>
              </a>
              <div class="lesson-status-check ${isDone ? 'completed' : ''}" 
                   onclick="window.toggleLessonComplete('${les.id}', event)"
                   title="${isDone ? 'បានរៀនរួច' : 'ចុចដើម្បីសម្គាល់ថារៀនរួច'}">
                ${isDone ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
              </div>
            </div>
          </li>
        `;
          });

          html += `
          </ul>
        </div>
      `;
        });

        html += `
        </div>

        <div>
          <div class="sidebar-section-title">ឯកសារ & ឥណទាន</div>
          <a href="#references" class="nav-item-link" id="nav-references">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            ឯកសារយោង & ឥណទាន
          </a>
        </div>
      </div>
    `;

        el.sidebar.innerHTML = html;
      }

      window.toggleChapter = function (chapterId) {
        const acc = document.getElementById(`accordion-${chapterId}`);
        if (acc) {
          acc.classList.toggle('open');
        }
      };

      window.toggleLessonComplete = function (lessonId, e) {
        if (e) e.stopPropagation();
        const isNowDone = !state.completedLessons.has(lessonId);
        if (isNowDone) {
          state.completedLessons.add(lessonId);
          showToast('អបអរសាទរ! បានសម្គាល់ថារៀនចប់មេរៀននេះ');
        } else {
          state.completedLessons.delete(lessonId);
          showToast('បានដកចេញពីបញ្ជីរៀនរួច');
        }
        localStorage.setItem('rpitssr_completed_lessons', JSON.stringify(Array.from(state.completedLessons)));

        // Update sidebar check icon in place to preserve scroll position
        const navBtn = document.getElementById(`nav-${lessonId}`);
        if (navBtn) {
          const check = navBtn.querySelector('.lesson-status-check');
          if (check) {
            check.classList.toggle('completed', isNowDone);
            check.setAttribute('title', isNowDone ? 'បានរៀនរួច' : 'ចុចដើម្បីសម្គាល់ថារៀនរួច');
            check.innerHTML = isNowDone ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '';
          }
        }

        updateActiveSidebarItem();
        updateProgressTracker();

        // If currently on this lesson, update the top and bottom complete buttons
        if (state.currentLessonId === lessonId) {
          ['btnHeaderComplete', 'btnFooterComplete'].forEach(id => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.classList.toggle('completed', isNowDone);
            btn.innerHTML = completeButtonInner(isNowDone);
          });
        }
      };

      function updateActiveSidebarItem() {
        // Clear active
        document.querySelectorAll('.nav-item-link, .lesson-nav-btn').forEach(btn => btn.classList.remove('active'));

        if (state.currentView === 'home') {
          const b = document.getElementById('nav-home');
          if (b) b.classList.add('active');
        } else if (state.currentView === 'preface') {
          const b = document.getElementById('nav-preface');
          if (b) b.classList.add('active');
        } else if (state.currentView === 'intro') {
          const b = document.getElementById('nav-intro');
          if (b) b.classList.add('active');
        } else if (state.currentView === 'references') {
          const b = document.getElementById('nav-references');
          if (b) b.classList.add('active');
        } else if (state.currentView === 'lesson') {
          const b = document.getElementById(`nav-${state.currentLessonId}`);
          if (b) b.classList.add('active');
          // Ensure chapter accordion is open
          const data = window.COURSE_DATA;
          const curLesson = data?.lessons?.find(l => l.id === state.currentLessonId);
          if (curLesson) {
            // Keep only the current lesson's chapter expanded
            document.querySelectorAll('.chapter-accordion').forEach(acc => {
              acc.classList.toggle('open', acc.id === `accordion-${curLesson.chapterId}`);
            });
          }
        }
        requestAnimationFrame(scrollSidebarToActive);
      }

      function updateProgressTracker() {
        const lessons = (window.COURSE_DATA && window.COURSE_DATA.lessons) || [];
        const total = lessons.length || 1;
        const completed = lessons.filter(l => state.completedLessons.has(l.id)).length;
        const percent = Math.round((completed / total) * 100);

        if (el.progressFill) {
          el.progressFill.style.width = `${percent}%`;
        }
        if (el.progressText) {
          el.progressText.textContent = `${kh(completed)}/${kh(total)} (${kh(percent)}%)`;
        }
      }

      // Render Lesson View
      function renderLessonView(lessonId) {
        const data = window.COURSE_DATA;
        if (!data) return;

        const lesson = data.lessons.find(l => l.id === lessonId);
        if (!lesson) {
          el.mainContent.innerHTML = `<div class="empty-state-card">រកមិនឃើញមេរៀននេះទេ</div>`;
          return;
        }

        const chap = data.chapters.find(c => c.id === lesson.chapterId);
        const isCompleted = state.completedLessons.has(lesson.id);

        // Find Prev and Next Lessons
        const currentIndex = data.lessons.findIndex(l => l.id === lessonId);
        const prevLesson = currentIndex > 0 ? data.lessons[currentIndex - 1] : null;
        const nextLesson = currentIndex < data.lessons.length - 1 ? data.lessons[currentIndex + 1] : null;

        const isSol = lesson.id.startsWith('solution-');
        const breadcrumbLabel = isSol ? `អត្រាកំណែមេរៀនទី${kh(lesson.number)}` : `មេរៀនទី${kh(lesson.number)}`;
        const pageHeaderTitle = isSol ? `${lesson.title}` : `មេរៀនទី${kh(lesson.number)}៖ ${lesson.title}`;

        let html = `
      <!-- Breadcrumb -->
      <nav class="breadcrumb-bar">
        <a href="#home" class="breadcrumb-item">ទំព័រដើម</a>
        <span class="breadcrumb-separator">/</span>
        <span class="breadcrumb-item">${chap ? chap.title : ''}</span>
        <span class="breadcrumb-separator">/</span>
        <span class="breadcrumb-item" style="color:var(--text-main); font-weight:600;">${breadcrumbLabel}</span>
      </nav>

      <!-- Lesson Header Card -->
      <header class="lesson-header-card">
        <div class="lesson-header-top">
          <div class="lesson-meta-tags">
            <span class="tag-badge" style="color:var(--primary); font-weight:700;">
              ${lesson.chapterTitle}
            </span>
            <span class="tag-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              ទំព័រ ${kh(lesson.pageStart)} ដល់ ${kh(lesson.pageEnd)}
            </span>
          </div>

          <button class="btn-complete-toggle ${isCompleted ? 'completed' : ''}" id="btnHeaderComplete" onclick="window.toggleLessonComplete('${lesson.id}')">
            ${completeButtonInner(isCompleted)}
          </button>
        </div>

        <h1 class="lesson-header-title">${pageHeaderTitle}</h1>

        <div class="lesson-action-bar">
          <span style="font-size:0.85rem; color:var(--text-muted); display:flex; align-items:center; gap:0.4rem;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            រយៈពេលសិក្សា៖ ${studyTimeLabel(lesson)}
          </span>
        </div>
      </header>
    `;

        // Objectives Box if present
        if (lesson.objectives && lesson.objectives.length > 0) {
          html += `
        <div class="objectives-card">
          <div class="objectives-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
            គោលបំណងនៃមេរៀន (Learning Objectives)
          </div>
          <ul class="objectives-list">
      `;
          lesson.objectives.forEach(obj => {
            html += `
          <li class="objective-item">
            <svg class="objective-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>${obj}</span>
          </li>
        `;
          });
          html += `
          </ul>
        </div>
      `;
        }

        // Sections
        lesson.sections.forEach((sec, sIdx) => {
          html += `
        <article class="section-card" id="section-${sIdx}">
          <h2 class="section-heading">
            <span>${sec.title}</span>
            <a href="#section-${sIdx}" style="color:var(--text-subtle); text-decoration:none; font-size:1rem;" title="ចម្លងតំណភ្ជាប់">#</a>
          </h2>
          <div class="section-content">
      `;

          sec.items.forEach(item => {
            if (item.type === 'subsection') {
              html += `<h3 class="subsection-heading">${formatInlineContent(item.title)}</h3>`;
            } else if (item.type === 'subtopic') {
              html += `<h4 class="subtopic-heading">${formatInlineContent(item.title)}</h4>`;
            } else if (item.type === 'table') {
              const tableTitle = item.title ? formatInlineContent(item.title) : '';
              html += `
            <div class="table-container">
              <div class="table-header-bar">
                ${tableTitle ? `<div class="table-header-title">${tableTitle}</div>` : '<div class="table-header-spacer"></div>'}
                <button class="table-zoom-btn" type="button" title="ពង្រីកតារាងពេញអេក្រង់ (Fullscreen Table)" onclick="window.openTableModal(this)">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <polyline points="15 3 21 3 21 9"/>
                    <polyline points="9 21 3 21 3 15"/>
                    <line x1="21" y1="3" x2="14" y2="10"/>
                    <line x1="3" y1="21" x2="10" y2="14"/>
                  </svg>
                  <span class="table-zoom-text">ពង្រីក</span>
                </button>
              </div>
              <div class="table-responsive-wrapper">
                <table class="data-table">
                  ${item.headers && item.headers.length ? `<thead><tr>${item.headers.map(h => tableCell('th', h)).join('')}</tr></thead>` : ''}
                  <tbody>
                    ${item.rows.map(r => `<tr>${r.map(c => tableCell('td', c)).join('')}</tr>`).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `;
            } else if (item.type === 'paragraph') {
              html += `<p class="prose-text">${formatInlineContent(item.text)}</p>`;
            } else if (item.type === 'steps') {
              const validSteps = (item.steps || []).filter(st => {
                if (!st) return false;
                const cleaned = st.replace(/^(?:\d+\.|\-|\▪|\✓|\•|\*|\–|\s|\u200b|\u00a0)+/, '').trim();
                return cleaned.length > 0;
              });
              if (validSteps.length > 0) {
                html += `<div class="steps-container">`;
                validSteps.forEach((st, stepIdx) => {
                  // Extract original step number from string if present (e.g. "1. ", "10. ")
                  // "1. text" or a sub-step "a. text"
                  const numMatch = st.match(/^(\d+|[a-zA-Z])\.\s*([\s\S]*)$/);
                  const stepNumber = numMatch ? numMatch[1] : (stepIdx + 1);
                  const cleanStep = numMatch ? numMatch[2] : st.replace(/^(?:\d+\.|\-|\▪|\✓|\•|\*|\–)\s*/, '');
                  const trimmed = cleanStep.trim();
                  if (trimmed.length > 0) {
                    html += `
                  <div class="step-row">
                    <span class="step-number-pill">${kh(stepNumber)}</span>
                    <div>${formatInlineContent(trimmed)}</div>
                  </div>
                `;
                  }
                });
                html += `</div>`;
              }
            } else if (item.type === 'bullets') {
              const validBullets = (item.items || []).filter(it => {
                if (!it) return false;
                const cleaned = it.replace(/^[\-\▪\✓\•\*\–\s\u200b\u00a0]+/, '').trim();
                return cleaned.length > 0;
              });
              if (validBullets.length > 0) {
                html += `<ul class="bullets-container">`;
                validBullets.forEach(it => {
                  const cleanBullet = it.replace(/^[\-\▪\✓\•\*\–\s\u200b\u00a0]+/, '').trim();
                  if (cleanBullet.length > 0) {
                    html += `
                  <li class="bullet-row">
                    <span class="bullet-dot">•</span>
                    <div>${formatInlineContent(cleanBullet)}</div>
                  </li>
                `;
                  }
                });
                html += `</ul>`;
              }
            } else if (item.type === 'callout') {
              const kind = item.kind || 'note';
              let text = (item.text || '').replace(/^[\s\uFE0F]*[💡📘📌⚠️ℹ️🔔]\s*/u, '');
              
              if (!text.startsWith('**') && /^(សម្គាល់|ចំណាំ)\s*[:៖]\s*/u.test(text)) {
                text = text.replace(/^(សម្គាល់|ចំណាំ)\s*[:៖]\s*/u, '**$1៖** ');
              }

              let icon;
              if (kind === 'tip') {
                icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`;
              } else if (kind === 'warning') {
                icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
              } else {
                icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
              }

              html += `
            <div class="callout-box ${kind}">
              <div class="callout-icon-box" aria-hidden="true">${icon}</div>
              <div class="callout-content">
                ${formatInlineContent(text)}
              </div>
            </div>
          `;
            } else if (item.type === 'shortcuts') {
              html += `<div class="shortcuts-grid">`;
              item.items.forEach(sc => {
                const keyBadge = sc.key ? `<kbd class="kbd-badge">${sc.key}</kbd>` : '';
                html += `
              <div class="shortcut-item-card">
                <div class="shortcut-desc">${formatInlineContent(sc.desc)}</div>
                ${keyBadge}
              </div>
            `;
              });
              html += `</div>`;
            } else if (item.type === 'formula') {
              html += `
            <div class="formula-container">
              <div class="formula-math-render">$$${escapeHtml(item.text)}$$</div>
              <button class="btn-copy-formula" onclick="window.copyFormula('${escapeForJs(item.text)}')">
                ចម្លងរូបមន្ត (Copy)
              </button>
            </div>
          `;
            } else if (item.type === 'image') {
              html += `
            <figure class="image-card">
              <div class="image-wrapper" onclick="window.openLightbox('${item.src}', '${escapeForJs(item.caption || '')}')">
                <img class="content-screenshot" src="${item.src}" alt="${escapeHtml(item.caption || '')}" loading="lazy" />
                <div class="zoom-overlay-hint">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                  ចុចពង្រីក (Zoom)
                </div>
              </div>
              ${item.caption ? `<figcaption class="image-caption">${item.caption}</figcaption>` : ''}
            </figure>
          `;
            }
          });

          html += `
          </div>
        </article>
      `;
        });

        // Previous & Next Lesson Navigation
        const prevTitle = prevLesson
          ? (prevLesson.id.startsWith('solution-') ? prevLesson.title : 'មេរៀនទី' + kh(prevLesson.number) + '៖ ' + prevLesson.title)
          : 'សេចក្តីផ្តើមនៃមុខវិជ្ជា';
        const nextTitle = nextLesson
          ? (nextLesson.id.startsWith('solution-') ? nextLesson.title : 'មេរៀនទី' + kh(nextLesson.number) + '៖ ' + nextLesson.title)
          : 'ឯកសារយោង & ឥណទាន';

        const prevNav = prevLesson ? {
          url: '#' + prevLesson.id,
          title: prevTitle,
          badge: prevLesson.id.startsWith('solution-') ? 'កំណែមុន' : 'មុន'
        } : {
          url: '#intro',
          title: 'សេចក្តីផ្តើមនៃមុខវិជ្ជា',
          badge: 'មុន'
        };

        const nextNav = nextLesson ? {
          url: '#' + nextLesson.id,
          title: nextTitle,
          badge: nextLesson.id.startsWith('solution-') ? 'កំណែបន្ទាប់' : 'បន្ទាប់'
        } : {
          url: '#references',
          title: 'ឯកសារយោង & ឥណទាន',
          badge: 'បន្ទាប់'
        };

        // End-of-lesson completion prompt (mirrors the header button)
        const completePrompt = isSol
          ? `ពិនិត្យចប់អត្រាកំណែមេរៀនទី${kh(lesson.number)} ហើយឬនៅ?`
          : `អានចប់មេរៀនទី${kh(lesson.number)} ហើយឬនៅ?`;

        html += `
        <div class="lesson-complete-card">
          <span class="lesson-complete-text">${completePrompt}</span>
          <button class="btn-complete-toggle ${isCompleted ? 'completed' : ''}" id="btnFooterComplete" onclick="window.toggleLessonComplete('${lesson.id}')">
            ${completeButtonInner(isCompleted)}
          </button>
        </div>
      `;

        html += renderNavigationFooter(prevNav, nextNav);
        el.mainContent.innerHTML = html;
        renderMath(el.mainContent);
        autoScaleTables();
      }

      // Home / Cover View
      function renderHomeView() {
        const data = window.COURSE_DATA;
        if (!data) return;

        let html = `
      <div class="document-container">
        
        <!-- Hero Card -->
        <div class="home-hero-card">
          <div class="home-hero-content">
            <div style="display:inline-flex; align-items:center; gap:0.5rem; padding:0.35rem 0.85rem; background-color:var(--bg-surface); border:1px solid var(--border-color); border-radius:9999px; font-size:0.8rem; font-weight:700; color:var(--primary); margin-bottom:1rem;">
              <span style="width:8px; height:8px; border-radius:50%; background-color:#10b981;"></span>
              កាលវិភាគសិក្សា៖ ឆ្នាំទី១ ឆមាសទី១ (៤៥ ម៉ោង)
            </div>

            <h1 style="font-size:clamp(1.6rem, 1.3rem + 1vw, 2.2rem); font-weight:800; line-height:1.45; color:var(--text-main); margin-bottom:0.75rem;">
              ${data.meta.titleKh}
            </h1>
            <p style="font-size:1.1rem; font-weight:600; color:var(--text-muted); margin-bottom:1.25rem;">
              ${data.meta.titleEn}
            </p>

            <div style="display:flex; flex-direction:column; gap:0.4rem; font-size:0.95rem; color:var(--text-muted); margin-bottom:1.75rem;">
              <div><strong>គ្រឹះស្ថាន៖</strong> ${data.meta.institutionKh}</div>
              <div><strong>រៀបចំដោយ៖</strong> ${data.meta.author}</div>
              <div><strong>ឆ្នាំបោះពុម្ព៖</strong> ឆ្នាំ${data.meta.year}</div>
            </div>

            <div style="display:flex; align-items:center; gap:1rem; flex-wrap:wrap;">
              <a href="#lesson-01" class="btn-complete-toggle" style="background-color:var(--primary); color:#ffffff; border-color:var(--primary); padding:0.75rem 1.5rem; font-size:1rem; text-decoration:none;">
                ចាប់ផ្តើមរៀនមេរៀនទី១
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </a>
              <a href="#preface" class="btn-complete-toggle" style="padding:0.75rem 1.25rem; font-size:1rem; text-decoration:none;">
                អានអារម្ភកថា
              </a>
            </div>
          </div>

          <div class="home-hero-logo">
            <img src="${data.meta.logoImage}" alt="RPITSSR Emblem" />
          </div>
        </div>

        <!-- Chapters Highlights -->
        <div>
          <h2 style="font-size:1.45rem; font-weight:700; margin-bottom:1.25rem;">${kh(data.chapters.length)} ជំពូក និងផ្នែកសំខាន់ៗនៃមុខវិជ្ជា</h2>
          <div class="home-chapters-grid">
    `;

        const colors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#0d9488'];
        data.chapters.forEach((c, idx) => {
          const color = colors[idx % colors.length];
          const lessonsCount = data.lessons.filter(l => l.chapterId === c.id).length;
          const countLabel = c.id === 'chapter-solutions' ? `${kh(lessonsCount)} ដំណោះស្រាយ` : `${kh(lessonsCount)} មេរៀន`;
          const btnLabel = c.id === 'chapter-solutions' ? 'ចូលទៅកាន់អត្រាកំណែ' : 'ចូលទៅកាន់មេរៀន';
          html += `
        <div class="home-chapter-card">
          <div>
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.75rem;">
              <span style="font-size:0.8rem; font-weight:700; color:#fff; background-color:${color}; padding:0.2rem 0.6rem; border-radius:9999px;">
                ${c.number}
              </span>
              <span style="font-size:0.8rem; font-weight:600; color:var(--text-muted);">${countLabel}</span>
            </div>
            <h3 style="font-size:1.2rem; font-weight:700; margin-bottom:0.5rem; color:var(--text-main);">${c.title}</h3>
            <p style="font-size:0.9rem; color:var(--text-muted); line-height:1.7;">${c.description}</p>
          </div>
          <div style="margin-top:1.5rem; padding-top:1rem; border-top:1px solid var(--border-color);">
            <a href="#${c.lessons[0]}" style="color:${color}; font-weight:600; font-size:0.9rem; text-decoration:none; display:inline-flex; align-items:center; gap:0.35rem;">
              ${btnLabel}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </a>
          </div>
        </div>
      `;
        });

        html += `
          </div>
        </div>

        <!-- Mobile Study & PWA Installation Guide -->
        <div class="install-guide-card" style="background-color:var(--bg-card); border:1px solid var(--border-color); border-radius:16px; padding:1.75rem; box-shadow:var(--shadow-sm);">
          <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:1rem;">
            <div style="width:40px; height:40px; border-radius:10px; background-color:rgba(37,99,235,0.12); display:flex; align-items:center; justify-content:center; color:var(--primary);">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
            </div>
            <div>
              <h3 style="font-size:1.15rem; font-weight:700; color:var(--text-main); margin:0;">របៀបបើក និងរៀនលើទូរស័ព្ទដៃ (iOS & Android)</h3>
              <p style="font-size:0.85rem; color:var(--text-muted); margin:0;">អាចរៀនបានគ្រប់ទីកន្លែង ទោះបីគ្មានអ៊ីនធឺណិត (Offline Mode)</p>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:1rem; margin-top:1.25rem;">
            <!-- iOS -->
            <div style="padding:1rem; background-color:var(--bg-subtle); border-radius:10px; border:1px solid var(--border-color);">
              <div style="font-weight:700; font-size:0.95rem; color:var(--text-main); margin-bottom:0.5rem; display:flex; align-items:center; gap:0.4rem;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--primary);"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                សម្រាប់ iPhone / iPad (iOS)
              </div>
              <ol style="margin:0; padding-left:1.25rem; font-size:0.88rem; color:var(--text-body); line-height:1.7;">
                <li>បើកតាមកម្មវិធី <strong>Safari</strong></li>
                <li>ចុចប៊ូតុង <strong>Share</strong> (សញ្ញាព្រួញឡើងលើ <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>)</li>
                <li>រំកិលចុះក្រោម រួចជ្រើសយក <strong>«Add to Home Screen»</strong> (បន្ថែមទៅអេក្រង់ដើម)</li>
                <li>វានឹងក្លាយជា App មួយនៅលើទូរស័ព្ទ ងាយស្រួលបើករៀនគ្រប់ពេល</li>
              </ol>
            </div>

            <!-- Android -->
            <div style="padding:1rem; background-color:var(--bg-subtle); border-radius:10px; border:1px solid var(--border-color);">
              <div style="font-weight:700; font-size:0.95rem; color:var(--text-main); margin-bottom:0.5rem; display:flex; align-items:center; gap:0.4rem;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--excel-accent);"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                សម្រាប់ទូរស័ព្ទ Android
              </div>
              <ol style="margin:0; padding-left:1.25rem; font-size:0.88rem; color:var(--text-body); line-height:1.7;">
                <li>បើកតាមកម្មវិធី <strong>Google Chrome</strong></li>
                <li>ចុចសញ្ញាចុចបី <strong>(⋮)</strong> នៅជ្រុងខាងស្តាំលើ</li>
                <li>ជ្រើសយក <strong>«Install app»</strong> ឬ <strong>«Add to Home screen»</strong> (ដំឡើងកម្មវិធី)</li>
                <li>កម្មវិធីនឹងដំឡើងចូលក្នុងទូរស័ព្ទ និងដំណើរការបានពេញលេញ</li>
              </ol>
            </div>
          </div>
        </div>

      </div>
    `;

        el.mainContent.innerHTML = html;
        renderMath(el.mainContent);
      }

      // Preface View
      // Bottom Navigation Footer Helper
      function cleanNavTitle(title) {
        if (!title) return '';
        let t = title.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
        t = t.replace(/\(([^)]+)\)/g, (m, inner) => '(' + inner.replace(/\s+/g, '\u00A0') + ')');
        return t;
      }

      function renderNavigationFooter(prev, next) {
        let prevHtml = '';
        if (prev) {
          prevHtml = `
          <a href="${prev.url}" class="nav-lesson-btn nav-prev" aria-label="${escapeHtml(prev.label || prev.title)}">
            <div class="nav-meta-pill">
              <svg class="nav-arrow-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              <span>${prev.badge || 'មុន'}</span>
            </div>
            <div class="nav-btn-title">${cleanNavTitle(prev.title)}</div>
          </a>
          `;
        } else {
          prevHtml = '<div class="nav-lesson-empty"></div>';
        }

        let nextHtml = '';
        if (next) {
          nextHtml = `
          <a href="${next.url}" class="nav-lesson-btn nav-next" aria-label="${escapeHtml(next.label || next.title)}">
            <div class="nav-meta-pill">
              <span>${next.badge || 'បន្ទាប់'}</span>
              <svg class="nav-arrow-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </div>
            <div class="nav-btn-title">${cleanNavTitle(next.title)}</div>
          </a>
          `;
        } else {
          nextHtml = '<div class="nav-lesson-empty"></div>';
        }

        return `
        <footer class="lesson-navigation-footer">
          ${prevHtml}
          ${nextHtml}
        </footer>
        `;
      }

      // Preface View
      function renderPrefaceView() {
        const data = window.COURSE_DATA;
        if (!data || !data.preface) return;

        let html = `
      <article class="section-card document-article">
        <h1 style="font-size:2rem; font-weight:800; color:var(--text-main); margin-bottom:1.5rem; padding-bottom:1rem; border-bottom:2px solid var(--border-color);">
          ${data.preface.title}
        </h1>
        <div style="display:flex; flex-direction:column; gap:1.25rem; font-size:1.025rem; line-height:1.85; text-align:justify;">
          ${data.preface.content.split('\n\n').map(p => `<p class="prose-text">${formatInlineContent(p)}</p>`).join('')}
        </div>

        <div style="margin-top:2.5rem; padding-top:1.5rem; border-top:1px solid var(--border-color); text-align:right;">
          <div style="font-size:0.95rem; color:var(--text-muted);">${data.preface.signOff.location}, ${data.preface.signOff.date}</div>
          ${data.preface.signOff.role ? `<div style="font-size:0.95rem; color:var(--text-muted); margin-top:0.35rem;">${data.preface.signOff.role}</div>` : ''}
          <div style="font-size:1.1rem; font-weight:700; color:var(--text-main); margin-top:0.35rem;">
            ${data.preface.signOff.author}
          </div>
        </div>
      </article>
    `;

        html += renderNavigationFooter(
          { url: '#home', title: 'ទំព័រដើម & ក្របសៀវភៅ', badge: 'មុន' },
          { url: '#intro', title: data.courseIntro ? data.courseIntro.title : 'សេចក្តីផ្តើមនៃមុខវិជ្ជា', badge: 'បន្ទាប់' }
        );

        el.mainContent.innerHTML = html;
        renderMath(el.mainContent);
      }

      // Intro View
      function renderIntroView() {
        const data = window.COURSE_DATA;
        if (!data || !data.courseIntro) return;

        let html = `
      <article class="section-card document-article">
        <h1 style="font-size:2rem; font-weight:800; color:var(--text-main); margin-bottom:1.5rem; padding-bottom:1rem; border-bottom:2px solid var(--border-color);">
          ${data.courseIntro.title}
        </h1>
        <div style="display:flex; flex-direction:column; gap:1.25rem; font-size:1.025rem; line-height:1.85; text-align:justify;">
          ${data.courseIntro.content.split('\n\n').map(p => p.startsWith('## ')
            ? `<h2 class="subsection-heading" style="margin-top:0.5rem;">${formatInlineContent(p.slice(3))}</h2>`
            : `<p class="prose-text">${formatInlineContent(p)}</p>`).join('')}
        </div>
      </article>
    `;

        const firstLesson = data.lessons && data.lessons.length > 0 ? data.lessons[0] : null;
        html += renderNavigationFooter(
          { url: '#preface', title: 'អារម្ភកថា (Preface)', badge: 'មុន' },
          firstLesson ? { url: `#${firstLesson.id}`, title: `មេរៀនទី${kh(firstLesson.number)}៖ ${firstLesson.title}`, badge: 'មេរៀនបន្ទាប់' } : null
        );

        el.mainContent.innerHTML = html;
        renderMath(el.mainContent);
      }

      // References View
      function renderReferencesView() {
        const data = window.COURSE_DATA;
        if (!data) return;

        let html = `
      <article class="section-card document-article">
        <h1 style="font-size:2rem; font-weight:800; color:var(--text-main); margin-bottom:1.5rem; padding-bottom:1rem; border-bottom:2px solid var(--border-color);">
          ឯកសារយោង & ឥណទាន (References & Credits)
        </h1>

        <div style="margin-bottom:2rem;">
          <h2 style="font-size:1.25rem; font-weight:700; margin-bottom:1rem; color:var(--primary);">
            ឯកសារពិគ្រោះ និងយោង (Reference Books)
          </h2>
          <div style="display:flex; flex-direction:column; gap:0.75rem;">
    `;

        data.references.forEach((ref, idx) => {
          html += `
        <div style="padding:1rem 1.25rem; background-color:var(--bg-subtle); border:1px solid var(--border-color); border-radius:10px;">
          <div style="font-weight:700; color:var(--text-main); font-size:1rem;">${kh(idx + 1)}. "${ref.title}" (${ref.year})</div>
          <div style="font-size:0.875rem; color:var(--text-muted); margin-top:0.25rem;">
            អ្នកនិពន្ធ៖ ${ref.author} | បោះពុម្ពផ្សាយដោយ៖ ${ref.publisher}
          </div>
        </div>
      `;
        });

        html += `
          </div>
        </div>

        <div style="margin-top:2.5rem; padding-top:1.5rem; border-top:1px solid var(--border-color);">
          <h2 style="font-size:1.25rem; font-weight:700; margin-bottom:1rem; color:var(--text-main);">
            គណៈកម្មការរៀបចំ និងកែសម្រួល
          </h2>
          <p class="prose-text" style="margin-bottom:1rem;">
            ឯកសារបង្រៀន និងវេទិកាសិក្សាឌីជីថលនេះ ត្រូវបានរៀបចំឡើង និងចងក្រងសម្រាប់មុខវិជ្ជា គណិតវិទ្យាសម្រាប់កុំព្យូទ័រ (Mathematics for Computing) ដោយ៖
          </p>
          <div style="padding:1.25rem; background-color:var(--primary-light); border:1px solid var(--primary-border); border-radius:12px; font-size:1.1rem; font-weight:700; color:var(--primary);">
            ${data.meta.author}
            <div style="font-size:0.95rem; font-weight:500; color:var(--text-muted); margin-top:0.35rem;">
              ${data.meta.institutionKh} (${data.meta.institutionEn})
            </div>
          </div>
        </div>
      </article>
    `;

        const lastLesson = data.lessons && data.lessons.length > 0 ? data.lessons[data.lessons.length - 1] : null;
        html += renderNavigationFooter(
          lastLesson ? { url: `#${lastLesson.id}`, title: lastLesson.id.startsWith('solution-') ? lastLesson.title : `មេរៀនទី${kh(lastLesson.number)}៖ ${lastLesson.title}`, badge: 'មេរៀនមុន' } : null,
          { url: '#home', title: 'ទំព័រដើម & ក្របសៀវភៅ', badge: 'ត្រឡប់ទៅដើម' }
        );

        el.mainContent.innerHTML = html;
        renderMath(el.mainContent);
      }

      // Mathematical formula rendering with KaTeX
      function renderMath(container) {
        if (typeof renderMathInElement === 'function') {
          renderMathInElement(container || el.mainContent || document.body, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '$', right: '$', display: false },
              { left: '\\(', right: '\\)', display: false },
              { left: '\\[', right: '\\]', display: true }
            ],
            throwOnError: false
          });
        }
      }

      // Formatting Helpers
      function formatInlineContent(str) {
        if (!str) return '';

        // First preserve allowed formatting tags: <strong>, </strong>, <b>, </b>, <em>, </i>, <a>
        const allowed = [];
        let clean = str.replace(/<\/?(?:strong|b|em|i|a)[^>]*>/gi, function (match) {
          allowed.push(match);
          return '___SAFE_TAG_' + (allowed.length - 1) + '___';
        });

        // Strip raw <kbd> wrappers if present to prevent leaking escaped tags
        clean = clean.replace(/<kbd[^>]*>(.*?)<\/kbd>/gi, '');
        clean = clean.replace(/<([A-Za-z0-9\+\s]+)>/g, '');
        let res = escapeHtml(clean);

        // Restore preserved tags
        allowed.forEach(function (tag, idx) {
          res = res.replace('___SAFE_TAG_' + idx + '___', tag);
        });

        // Format markdown bold **text**
        res = res.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        // Format markdown link [text](url)
        res = res.replace(/\[([^\]]+)\]\((#[^)]+)\)/g, '<a href="$2" class="solution-link">$1</a>');

        // Format Ctrl + Shift + X / Ctrl + X / Alt + X / F1-F12 keys into <kbd> badges without double nesting
        const kbdTokens = [];
        res = res.replace(/\b(Ctrl|Alt|Shift|Windows)\s*\+\s*(?:(Ctrl|Alt|Shift)\s*\+\s*)?([A-Za-z0-9\+]+)\b/gi, function (match) {
          kbdTokens.push(match.trim());
          return '___KBD_TAG_' + (kbdTokens.length - 1) + '___';
        });
        // Single keys. Skip words that are really Ribbon tabs / UI names ("File Tab", "Home Tab",
        // "End of Section") and cell references inside formulas ("=IF(F3<=4"). No regex
        // lookbehind here: older iOS Safari can't parse it.
        res = res.replace(/\b(F[1-9]|F1[0-2]|Enter|Esc|Tab|Delete|Backspace|Home|End|Page Up|Page Down)\b/g, function (match, _k, offset, full) {
          const before = full.slice(0, offset);
          const after = full.slice(offset + match.length);
          if (match === 'Tab') return match;
          if (/^F\d/.test(match) && (/[(,=:$]$/.test(before) || /^[&,):]/.test(after))) return match;
          const afterKeyWord = /\bkey\s*$/i.test(before); // "Key Delete" still means the key
          if ((!afterKeyWord && /[A-Za-z]\s*$/.test(before)) || /^\s+(?!key\b)[A-Za-z]/i.test(after)) return match;
          kbdTokens.push(match.trim());
          return '___KBD_TAG_' + (kbdTokens.length - 1) + '___';
        });
        kbdTokens.forEach(function (token, idx) {
          res = res.replace('___KBD_TAG_' + idx + '___', '<kbd class="kbd-badge">' + token + '</kbd>');
        });

        // Format bullet points within lines
        res = res.replace(/\n\s*[\-\▪\✓\•]\s*/g, '<br/>• ');
        // Keep the book's own line breaks (e.g. multi-line table cells and notes)
        res = res.replace(/\n/g, '<br/>');
        return res;
      }

      function escapeHtml(str) {
        return str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      }

      function escapeForJs(str) {
        return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
      }

      // Search Engine
      function openSearchModal() {
        el.searchModal.classList.add('active');
        el.searchInput.value = '';
        el.searchInput.focus();
        performSearch('');
      }

      function closeSearchModal() {
        el.searchModal.classList.remove('active');
      }

      // Search index built from the lesson text itself, so every word in the book is searchable.
      // Zero-width spaces (Khmer word breaks from the Word file) are removed for matching.
      let searchIndexCache = null;
      function toPlainText(str) {
        return String(str || '').replace(/<[^>]+>/g, '').replace(/[​‌‍﻿]/g, '');
      }
      function buildSearchIndex(data) {
        const index = [];
        data.lessons.forEach(lesson => {
          const lessonTitle = lesson.id.startsWith('solution-')
            ? toPlainText(lesson.title)
            : `មេរៀនទី${kh(lesson.number)}៖ ${toPlainText(lesson.title)}`;
          index.push({
            lessonId: lesson.id, sectionIdx: null, title: lessonTitle,
            text: toPlainText([lesson.title, ...(lesson.objectives || [])].join(' '))
          });
          lesson.sections.forEach((sec, sIdx) => {
            const parts = [sec.title];
            sec.items.forEach(it => {
              if (it.title) parts.push(it.title);
              if (it.text) parts.push(it.text);
              if (it.steps) parts.push(...it.steps);
              if (it.items) parts.push(...it.items);
              if (it.headers) parts.push(...it.headers.map(cellText));
              if (it.rows) it.rows.forEach(r => parts.push(...r.map(cellText)));
              if (it.caption) parts.push(it.caption);
            });
            index.push({
              lessonId: lesson.id, sectionIdx: sIdx, title: toPlainText(sec.title),
              text: toPlainText(parts.join(' ')).replace(/\s+/g, ' ')
            });
          });
        });
        return index;
      }
      function snippetAround(text, q) {
        const i = text.toLowerCase().indexOf(q);
        if (i < 0) return text.slice(0, 140);
        const start = Math.max(0, i - 50);
        return (start > 0 ? '… ' : '') + text.slice(start, i + q.length + 90) + (i + q.length + 90 < text.length ? ' …' : '');
      }

      function performSearch(query) {
        const data = window.COURSE_DATA;
        if (!data || !data.lessons) return;
        if (!searchIndexCache) searchIndexCache = buildSearchIndex(data);
        query = toPlainText(query).trim();

        if (!query) {
          // Show sample suggested lessons
          let html = `<div style="padding:0.75rem 1rem; font-size:0.8rem; font-weight:700; color:var(--text-subtle); text-transform:uppercase;">មេរៀនណែនាំ</div>`;
          data.lessons.slice(0, 6).forEach(l => {
            const label = l.id.startsWith('solution-') ? l.title : `មេរៀនទី${kh(l.number)}៖ ${l.title}`;
            html += `
          <li class="search-result-item" onclick="window.jumpToResult('${l.id}')">
            <div class="result-title">${label}</div>
            <div class="result-snippet">${l.chapterTitle}</div>
          </li>
        `;
          });
          el.searchResults.innerHTML = html;
          renderMath(el.searchResults);
          return;
        }

        const q = query.toLowerCase();
        const matches = searchIndexCache.filter(item => {
          return item.title.toLowerCase().includes(q) || item.text.toLowerCase().includes(q);
        }).slice(0, 30);

        if (matches.length === 0) {
          el.searchResults.innerHTML = `<li style="padding:2rem; text-align:center; color:var(--text-muted); font-size:0.95rem;">មិនមានលទ្ធផលស្វែងរកសម្រាប់ "${escapeHtml(query)}"</li>`;
          return;
        }

        let html = '';
        matches.forEach(item => {
          const owner = data.lessons.find(l => l.id === item.lessonId);
          const isOwnerSol = owner && owner.id.startsWith('solution-');
          const ownerTitle = owner ? (isOwnerSol ? owner.title : `មេរៀនទី${kh(owner.number)}៖ ${escapeHtml(toPlainText(owner.title))}`) : '';
          const ownerLabel = owner && item.sectionIdx !== null
            ? `<div class="result-lesson-label">${ownerTitle}</div>`
            : '';
          html += `
        <li class="search-result-item" onclick="window.jumpToResult('${item.lessonId}', ${item.sectionIdx === null ? 'null' : item.sectionIdx})">
          ${ownerLabel}
          <div class="result-title">${highlightQuery(item.title, q)}</div>
          <div class="result-snippet">${highlightQuery(snippetAround(item.text, q), q)}</div>
        </li>
      `;
        });
        el.searchResults.innerHTML = html;
        renderMath(el.searchResults);
      }

      function highlightQuery(text, query) {
        if (!query) return escapeHtml(text);
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return escapeHtml(text).replace(regex, '<mark style="background-color:rgba(250, 204, 21, 0.4); border-radius:2px; padding:0 2px;">$1</mark>');
      }

      // Open the lesson and scroll to the matching section
      window.jumpToResult = function (lessonId, sectionIdx) {
        closeSearchModal();
        const scrollToSection = () => {
          if (sectionIdx === null || sectionIdx === undefined) return;
          const target = document.getElementById(`section-${sectionIdx}`);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        if (window.location.hash === `#${lessonId}`) {
          scrollToSection();
        } else {
          window.location.hash = `#${lessonId}`;
          setTimeout(scrollToSection, 60);
        }
      };

      // Lightbox Modal
      window.openLightbox = function (src, caption) {
        state.lightboxZoom = 1;
        el.lightboxImage.src = src;
        el.lightboxImage.style.transform = `scale(${state.lightboxZoom})`;
        el.lightboxCaption.textContent = caption || '';
        el.lightboxModal.classList.add('active');
      };

      function closeLightbox() {
        el.lightboxModal.classList.remove('active');
      }

      // Auto-scale tables on mobile view so the entire table fits into screen without horizontal scrollbars
      function autoScaleTables() {
        const isMobile = window.innerWidth <= 768;
        const wrappers = document.querySelectorAll('.table-responsive-wrapper');

        wrappers.forEach(wrap => {
          const table = wrap.querySelector('.data-table');
          if (!table) return;

          // Clear previous scale & height to measure unscaled dimensions
          table.style.zoom = '';
          table.style.transform = '';
          table.style.transformOrigin = '';
          wrap.style.height = '';
          wrap.style.overflowX = isMobile ? 'hidden' : 'auto';

          if (!isMobile) return;

          // Measure container and content widths
          const containerWidth = wrap.clientWidth;
          const tableWidth = table.scrollWidth;

          if (containerWidth > 0 && tableWidth > containerWidth) {
            const ratio = (containerWidth / tableWidth);
            if (ratio < 0.99) {
              if ('zoom' in table.style) {
                table.style.zoom = ratio;
              } else {
                table.style.transform = `scale(${ratio})`;
                table.style.transformOrigin = 'top left';
                wrap.style.height = `${Math.ceil(table.offsetHeight * ratio)}px`;
              }
            }
          }
        });
      }

      // Fullscreen Table View Modal
      window.openTableModal = function (btn) {
        const container = btn.closest('.table-container');
        if (!container || !el.tableModal) return;
        const table = container.querySelector('.data-table');
        const titleEl = container.querySelector('.table-header-title');
        if (!table) return;

        el.tableModalTitle.textContent = titleEl ? titleEl.textContent.trim() : 'តារាងទិន្នន័យ (Table View)';
        el.tableModalBody.innerHTML = '';
        const cloned = table.cloneNode(true);
        // Clear mobile zoom/scale so modal displays table at 100% full crisp size
        cloned.style.zoom = '';
        cloned.style.transform = '';
        el.tableModalBody.appendChild(cloned);
        el.tableModal.classList.add('active');
        document.body.style.overflow = 'hidden';
      };

      window.closeTableModal = function () {
        if (!el.tableModal) return;
        el.tableModal.classList.remove('active');
        document.body.style.overflow = '';
      };

      window.copyFormula = function (formula) {
        navigator.clipboard.writeText(formula).then(() => {
          showToast('បានចម្លងរូបមន្តដោយជោគជ័យ!');
        }).catch(() => {
          showToast('មិនអាចចម្លងបាន');
        });
      };

      // Toast System
      function showToast(msg) {
        if (!el.toastContainer) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = msg;
        el.toastContainer.appendChild(toast);
        setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.transform = 'translateY(10px)';
          toast.style.transition = 'all 0.25s ease';
          setTimeout(() => toast.remove(), 250);
        }, 2500);
      }

      // Initialize when DOM ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        init();
      }
    })();
