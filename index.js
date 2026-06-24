// Web Application State
let timetableData = [];
let activeItems = [];
let currentLightboxIndex = -1;

// DOM Elements
const elements = {
    loadingSpinner: document.getElementById('loading-spinner'),
    emptyState: document.getElementById('empty-state'),
    timetableContainer: document.getElementById('timetable-container'),
    resultsCount: document.getElementById('results-count'),
    
    // Filter controls
    filterYear: document.getElementById('filter-year'),
    filterSemester: document.getElementById('filter-semester'),
    filterType: document.getElementById('filter-type'),
    searchInput: document.getElementById('search-input'),
    btnSearchClear: document.getElementById('btn-search-clear'),
    btnResetFilters: document.getElementById('btn-reset-filters'),
    
    // Tabs
    tabBtns: document.querySelectorAll('.tab-btn'),
    
    // Lightbox modal
    lightbox: document.getElementById('lightbox'),
    lightboxImg: document.getElementById('lightbox-img'),
    lightboxTitle: document.getElementById('lightbox-title'),
    lightboxMeta: document.getElementById('lightbox-meta'),
    lightboxClose: document.getElementById('lightbox-close'),
    lightboxPrev: document.getElementById('lightbox-prev'),
    lightboxNext: document.getElementById('lightbox-next'),
    btnToggleOcr: document.getElementById('btn-toggle-ocr'),
    lightboxOcrText: document.getElementById('lightbox-ocr-text')
};

// State Variables
let currentTeacher = "林獻升";
let selectedYear = "all";
let selectedSemester = "all";
let selectedType = "all";
let searchQuery = "";

// 1. Initial Load
window.addEventListener('DOMContentLoaded', () => {
    fetch('data.json')
        .then(response => {
            if (!response.ok) {
                throw new Error("找不到資料檔 (data.json)，請確認背景辨識任務是否已完成。");
            }
            return response.json();
        })
        .then(data => {
            timetableData = data;
            
            // Hide loading spinner
            elements.loadingSpinner.style.display = 'none';
            
            // Initialize App
            initApp();
        })
        .catch(err => {
            console.error(err);
            elements.loadingSpinner.innerHTML = `
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 3rem; color: #ef4444;"></i>
                <p style="margin-top: 1rem; color: #ef4444;">${err.message}</p>
            `;
        });
});

// 2. Initialize Application Components
function initApp() {
    // Populate filters and render
    updateYearDropdown();
    applyFiltersAndRender();
    
    // Bind Tab Click events
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            currentTeacher = btn.getAttribute('data-teacher');
            
            // When switching teachers, reset filters and update year options
            resetFiltersExceptTeacher();
            updateYearDropdown();
            applyFiltersAndRender();
        });
    });
    
    // Bind Filter Change events
    elements.filterYear.addEventListener('change', (e) => {
        selectedYear = e.target.value;
        applyFiltersAndRender();
    });
    elements.filterSemester.addEventListener('change', (e) => {
        selectedSemester = e.target.value;
        applyFiltersAndRender();
    });
    elements.filterType.addEventListener('change', (e) => {
        selectedType = e.target.value;
        applyFiltersAndRender();
    });
    
    // Search input event (debounced or input direct)
    elements.searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim().toLowerCase();
        
        // Show/hide search clear button
        if (searchQuery) {
            elements.btnSearchClear.style.display = 'block';
        } else {
            elements.btnSearchClear.style.display = 'none';
        }
        
        applyFiltersAndRender();
    });
    
    elements.btnSearchClear.addEventListener('click', () => {
        elements.searchInput.value = "";
        searchQuery = "";
        elements.btnSearchClear.style.display = 'none';
        applyFiltersAndRender();
    });
    
    // Reset filters button in Empty State
    elements.btnResetFilters.addEventListener('click', () => {
        resetFiltersExceptTeacher();
        applyFiltersAndRender();
    });
    
    // Lightbox Modal Controls
    elements.lightboxClose.addEventListener('click', closeLightbox);
    elements.lightboxPrev.addEventListener('click', prevLightbox);
    elements.lightboxNext.addEventListener('click', nextLightbox);
    
    // Close lightbox on clicking backdrop
    elements.lightbox.addEventListener('click', (e) => {
        if (e.target === elements.lightbox) {
            closeLightbox();
        }
    });
    
    // Keyboard navigation in lightbox
    document.addEventListener('keydown', (e) => {
        if (elements.lightbox.style.display === 'flex') {
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowLeft') prevLightbox();
            if (e.key === 'ArrowRight') nextLightbox();
        }
    });
    
    // Toggle OCR display
    elements.btnToggleOcr.addEventListener('click', () => {
        const isHidden = elements.lightboxOcrText.style.display === 'none';
        if (isHidden) {
            elements.lightboxOcrText.style.display = 'block';
            elements.btnToggleOcr.innerHTML = '<i class="fa-solid fa-file-lines"></i> 隱藏辨識文字';
        } else {
            elements.lightboxOcrText.style.display = 'none';
            elements.btnToggleOcr.innerHTML = '<i class="fa-solid fa-file-lines"></i> 顯示辨識文字';
        }
    });
}

// 3. Reset filters
function resetFiltersExceptTeacher() {
    elements.filterYear.value = "all";
    elements.filterSemester.value = "all";
    elements.filterType.value = "all";
    elements.searchInput.value = "";
    
    selectedYear = "all";
    selectedSemester = "all";
    selectedType = "all";
    searchQuery = "";
    elements.btnSearchClear.style.display = 'none';
}

// 4. Update Year Dropdown dynamically depending on current active teacher
function updateYearDropdown() {
    // Get unique years for the current teacher(s)
    const teacherData = currentTeacher === "both"
        ? timetableData
        : timetableData.filter(d => d.teacher === currentTeacher);
    const yearsSet = new Set(teacherData.map(d => d.year).filter(Boolean));
    const sortedYears = Array.from(yearsSet).sort((a, b) => b - a); // descending
    
    // Keep the "all" option and repopulate
    elements.filterYear.innerHTML = '<option value="all">所有學年度</option>';
    sortedYears.forEach(y => {
        const option = document.createElement('option');
        option.value = y.toString();
        option.textContent = `${y} 學年度`;
        elements.filterYear.appendChild(option);
    });
}

// 5. Main Filter & Search Pipeline
function applyFiltersAndRender() {
    // Filter data
    activeItems = timetableData.filter(item => {
        // Teacher Filter (show both if 'both' is selected)
        if (currentTeacher !== "both" && item.teacher !== currentTeacher) return false;
        
        // Year Filter
        if (selectedYear !== "all" && item.year?.toString() !== selectedYear) return false;
        
        // Semester Filter
        if (selectedSemester !== "all" && item.semester?.toString() !== selectedSemester) return false;
        
        // Type Filter
        if (selectedType !== "all" && item.type !== selectedType) return false;
        
        // Fulltext Search
        if (searchQuery) {
            const matchYear = item.year?.toString().includes(searchQuery);
            const matchSem = `第${item.semester}學期`.includes(searchQuery) || `學期${item.semester}`.includes(searchQuery);
            const matchType = (item.type === 'teacher' ? '教師課表' : '班級課表導師課表').includes(searchQuery);
            const matchClass = item.className?.toLowerCase().includes(searchQuery);
            const matchOcrText = item.text?.toLowerCase().includes(searchQuery);
            
            if (!matchYear && !matchSem && !matchType && !matchClass && matchOcrText === false) {
                // If text is not null, try matching it
                if (!item.text || !item.text.toLowerCase().includes(searchQuery)) {
                    return false;
                }
            }
        }
        
        return true;
    });
    
    // Sort items: Year DESC, Semester DESC, Teacher DESC (or ASC), Type ASC
    activeItems.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        if (a.semester !== b.semester) return b.semester - a.semester;
        if (a.teacher !== b.teacher) return a.teacher.localeCompare(b.teacher); // keep teacher pages together
        if (a.type !== b.type) return a.type.localeCompare(b.type); // teacher before class
        return a.page - b.page;
    });
    
    // Update count indicator
    elements.resultsCount.textContent = `共篩選出 ${activeItems.length} 張課表`;
    
    // Render Grid
    renderGrid();
}

// 6. Render Grid Grouped by Year
function renderGrid() {
    // Clean up container
    elements.timetableContainer.innerHTML = "";
    
    if (activeItems.length === 0) {
        elements.emptyState.style.display = 'flex';
        elements.timetableContainer.style.display = 'none';
        return;
    }
    
    elements.emptyState.style.display = 'none';
    elements.timetableContainer.style.display = 'block';
    
    // Group activeItems by Year
    const groupedByYear = {};
    activeItems.forEach(item => {
        const y = item.year || "未分类";
        if (!groupedByYear[y]) {
            groupedByYear[y] = [];
        }
        groupedByYear[y].push(item);
    });
    
    // Get years sorted descending
    const sortedYears = Object.keys(groupedByYear).sort((a, b) => {
        if (a === "未分类") return 1;
        if (b === "未分类") return -1;
        return parseInt(b) - parseInt(a);
    });
    
    // Create DOM structure
    sortedYears.forEach(year => {
        const yearSection = document.createElement('div');
        yearSection.className = 'year-group';
        
        // Year Header title
        const title = document.createElement('h2');
        title.className = 'year-title';
        title.textContent = `${year} 學年度`;
        yearSection.appendChild(title);
        
        // Cards Grid
        const grid = document.createElement('div');
        grid.className = 'grid-cards';
        
        groupedByYear[year].forEach(item => {
            const cardIndex = activeItems.indexOf(item);
            const card = createCard(item, cardIndex);
            grid.appendChild(card);
        });
        
        yearSection.appendChild(grid);
        elements.timetableContainer.appendChild(yearSection);
    });
}

// 7. Create Single Card DOM
function createCard(item, index) {
    const card = document.createElement('div');
    card.className = 'card';
    card.addEventListener('click', () => openLightbox(index));
    
    const semText = item.semester ? `第 ${item.semester} 學期` : "未知學期";
    const typeText = item.type === "teacher" ? "教師課表" : `班級課表 (${item.className || '未知班級'}班)`;
    
    const semClass = item.semester === 2 ? 'tag-sem-2' : 'tag-sem-1';
    const typeClass = item.type === 'teacher' ? 'tag-type-teacher' : 'tag-type-class';
    
    card.innerHTML = `
        <div class="card-header-tags">
            <span class="tag ${semClass}">${semText}</span>
            <span class="tag ${typeClass}">${typeText}</span>
        </div>
        <div class="card-preview-area">
            <img src="${item.file}" alt="${item.teacher} - ${item.year}學年度第${item.semester}學期課表" loading="lazy">
            <div class="card-overlay-hover">
                <i class="fa-solid fa-expand"></i>
            </div>
        </div>
        <div class="card-footer-info">
            <h4 class="card-title">${item.teacher} 老師</h4>
            <span class="card-desc">${item.year} 學年度 · ${semText}</span>
        </div>
    `;
    
    return card;
}

// 8. Lightbox Navigation & Open/Close
function openLightbox(index) {
    if (index < 0 || index >= activeItems.length) return;
    currentLightboxIndex = index;
    const item = activeItems[index];
    
    elements.lightboxImg.src = item.file;
    elements.lightboxTitle.textContent = `${item.teacher} 老師 - ${item.year} 學年度`;
    
    const semText = item.semester ? `第 ${item.semester} 學期` : "";
    const typeText = item.type === "teacher" ? "教師課表" : `班級課表 (${item.className || '未知班級'}班)`;
    elements.lightboxMeta.textContent = `${typeText} | ${semText} | 檔案頁碼: ${item.page}`;
    
    // Hide OCR box by default
    elements.lightboxOcrText.style.display = 'none';
    elements.lightboxOcrText.textContent = item.text || "此頁面無辨識文字";
    elements.btnToggleOcr.innerHTML = '<i class="fa-solid fa-file-lines"></i> 顯示辨識文字';
    
    // Toggle prev/next visibility
    elements.lightboxPrev.style.display = index > 0 ? 'flex' : 'none';
    elements.lightboxNext.style.display = index < activeItems.length - 1 ? 'flex' : 'none';
    
    // Show Modal
    elements.lightbox.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Lock background scroll
}

function closeLightbox() {
    elements.lightbox.style.display = 'none';
    document.body.style.overflow = ''; // Unlock background scroll
    elements.lightboxImg.src = ""; // Clear src to avoid flicker on next open
}

function prevLightbox() {
    if (currentLightboxIndex > 0) {
        openLightbox(currentLightboxIndex - 1);
    }
}

function nextLightbox() {
    if (currentLightboxIndex < activeItems.length - 1) {
        openLightbox(currentLightboxIndex + 1);
    }
}
