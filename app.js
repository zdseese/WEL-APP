// Clear all old scorecard data from localStorage
(function(){
  const currentUser = window.currentUser;
  if(currentUser){
    localStorage.removeItem('scorecard:metrics:v1');
    localStorage.removeItem(`scorecard:metrics:v1:${currentUser}`);
    localStorage.removeItem('scorecard:builder:v1');
    localStorage.removeItem(`scorecard:builder:v1:${currentUser}`);
  }
  // Also clear non-user-specific keys
  localStorage.removeItem('scorecard:metrics:v1');
  localStorage.removeItem('scorecard:builder:v1');
  
  // Debug: show registered users
  const users = JSON.parse(localStorage.getItem('scorecard:users') || '{}');
  console.log('Registered users:', Object.keys(users));
  console.log('Current user:', window.currentUser);
})();

// Scorecard welcome and category selection
document.addEventListener('DOMContentLoaded', function(){
  console.log('DOM loaded, initializing scorecard...');
  
  const welcomeMsg = document.getElementById('welcomeMessage');
  if(welcomeMsg){
    const displayName = window.currentUserDisplayName || window.currentUser || 'User';
    welcomeMsg.textContent = `Welcome, ${displayName}!`;
  }
  
  const welcomeSection = document.getElementById('welcomeSection');
  const categorySection = document.getElementById('categorySection');
  const buildBtn = document.getElementById('buildScorecardBtn');
  const backBtn = document.getElementById('backToWelcomeBtn');
  const continueBtn = document.getElementById('continueBtn');
  const addCustomBtn = document.getElementById('addCustomBtn');
  const customInput = document.getElementById('customCategoryInput');
  const customList = document.getElementById('customCategoriesList');
  
  console.log('Build button found:', buildBtn);
  console.log('Welcome section found:', welcomeSection);
  console.log('Category section found:', categorySection);
  
  let customCategories = [];
  
  // Check if user has existing scorecard and update button
  const currentUser = window.currentUser;
  if(currentUser) {
    const savedData = localStorage.getItem(`scorecard:data:${currentUser}`);
    if(savedData) {
      const data = JSON.parse(savedData);
      if(data.categories && data.categories.length > 0) {
        buildBtn.textContent = 'View My Scorecard';
      }
    }
  }
  
  // Check if we should show history graph from URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  if(urlParams.get('showHistory') === 'true' && currentUser) {
    const savedData = localStorage.getItem(`scorecard:data:${currentUser}`);
    if(savedData) {
      const data = JSON.parse(savedData);
      if(data.categories && data.categories.length > 0) {
        selectedCategories = data.categories;
        categoryDetails = data.details;
        welcomeSection.style.display = 'none';
        // Wait a moment for page to fully load, then show history
        setTimeout(() => showHistoryGraph(), 100);
      }
    }
  }
  
  // Update checkbox count and enforce limits
  function updateCategoryCount(){
    const checkboxes = document.querySelectorAll('.category-item input[type="checkbox"]');
    const checkedCount = document.querySelectorAll('.category-item input[type="checkbox"]:checked').length;
    
    // Disable unchecked boxes if 5 are selected
    checkboxes.forEach(cb => {
      if(!cb.checked && checkedCount >= 5){
        cb.disabled = true;
        cb.parentElement.style.opacity = '0.5';
        cb.parentElement.style.cursor = 'not-allowed';
      } else {
        cb.disabled = false;
        cb.parentElement.style.opacity = '1';
        cb.parentElement.style.cursor = 'pointer';
      }
    });
    
    // Update continue button
    if(continueBtn){
      if(checkedCount < 3){
        continueBtn.style.opacity = '0.6';
        continueBtn.style.cursor = 'not-allowed';
      } else {
        continueBtn.style.opacity = '1';
        continueBtn.style.cursor = 'pointer';
      }
    }
  }
  
  // Add change listeners to all checkboxes
  document.addEventListener('change', function(e){
    if(e.target.type === 'checkbox' && e.target.closest('.category-item')){
      updateCategoryCount();
    }
  });
  
  // Show category selection or existing scorecard
  if(buildBtn){
    buildBtn.addEventListener('click', function(){
      console.log('Build button clicked!');
      
      // Check if user has existing scorecard
      const currentUser = window.currentUser;
      if(currentUser) {
        const savedData = localStorage.getItem(`scorecard:data:${currentUser}`);
        if(savedData) {
          const data = JSON.parse(savedData);
          if(data.categories && data.categories.length > 0) {
            // Load existing scorecard
            selectedCategories = data.categories;
            categoryDetails = data.details;
            welcomeSection.style.display = 'none';
            showScorecardView();
            return;
          }
        }
      }
      
      // No existing scorecard, show category selection
      welcomeSection.style.display = 'none';
      categorySection.style.display = 'block';
    });
  } else {
    console.error('Build button not found!');
  }
  
  // Back to welcome
  if(backBtn){
    backBtn.addEventListener('click', function(){
      categorySection.style.display = 'none';
      welcomeSection.style.display = 'flex';
    });
  }
  
  // Add custom category
  if(addCustomBtn){
    addCustomBtn.addEventListener('click', function(){
      const categoryName = customInput.value.trim();
      if(categoryName){
        customCategories.push(categoryName);
        
        const div = document.createElement('div');
        div.className = 'category-item custom';
        div.innerHTML = `
          <input type="checkbox" id="custom${customCategories.length}" value="${categoryName}" checked>
          <label for="custom${customCategories.length}">${categoryName}</label>
          <button class="remove-custom-btn" data-category="${categoryName}">×</button>
        `;
        
        customList.appendChild(div);
        customInput.value = '';
        
        // Add remove handler
        const removeBtn = div.querySelector('.remove-custom-btn');
        removeBtn.addEventListener('click', function(){
          customCategories = customCategories.filter(c => c !== categoryName);
          div.remove();
          updateCategoryCount();
        });
        
        // Update count after adding
        updateCategoryCount();
      }
    });
  }
  
  // Allow Enter key to add custom category
  if(customInput){
    customInput.addEventListener('keypress', function(e){
      if(e.key === 'Enter'){
        addCustomBtn.click();
      }
    });
  }
  
  // Category details management
  let selectedCategories = [];
  let currentCategoryIndex = 0;
  let categoryDetails = {};
  
  const categoryDetailsSection = document.getElementById('categoryDetailsSection');
  const categoryProgress = document.getElementById('categoryProgress');
  const currentCategoryName = document.getElementById('currentCategoryName');
  const goalsInput = document.getElementById('goalsInput');
  const baselineInput = document.getElementById('baselineInput');
  const obstaclesInput = document.getElementById('obstaclesInput');
  const stepsInput = document.getElementById('stepsInput');
  const prevCategoryBtn = document.getElementById('prevCategoryBtn');
  const nextCategoryBtn = document.getElementById('nextCategoryBtn');
  const finishBtn = document.getElementById('finishBtn');
  const backToCategoriesBtn = document.getElementById('backToCategoriesBtn');
  
  function loadCategoryDetails(index) {
    const category = selectedCategories[index];
    currentCategoryName.textContent = category;
    categoryProgress.textContent = `Category ${index + 1} of ${selectedCategories.length}`;
    
    // Load saved details if they exist
    const details = categoryDetails[category] || { goals: '', baseline: '', obstacles: '', steps: '' };
    goalsInput.value = details.goals;
    baselineInput.value = details.baseline;
    obstaclesInput.value = details.obstacles;
    stepsInput.value = details.steps;
    
    // Show/hide navigation buttons
    prevCategoryBtn.style.display = index > 0 ? 'inline-block' : 'none';
    
    if(index === selectedCategories.length - 1) {
      nextCategoryBtn.style.display = 'none';
      finishBtn.style.display = 'inline-block';
    } else {
      nextCategoryBtn.style.display = 'inline-block';
      finishBtn.style.display = 'none';
    }
  }
  
  function validateCurrentCategory() {
    const goals = goalsInput.value.trim();
    const baseline = baselineInput.value.trim();
    const obstacles = obstaclesInput.value.trim();
    const steps = stepsInput.value.trim();
    
    if(!goals || !baseline || !obstacles || !steps) {
      alert('Please fill in all fields before continuing.');
      return false;
    }
    return true;
  }
  
  function saveCategoryDetails() {
    const category = selectedCategories[currentCategoryIndex];
    categoryDetails[category] = {
      goals: goalsInput.value.trim(),
      baseline: baselineInput.value.trim(),
      obstacles: obstaclesInput.value.trim(),
      steps: stepsInput.value.trim()
    };
  }
  
  // Continue with selected categories
  if(continueBtn){
    continueBtn.addEventListener('click', function(){
      const selected = [];
      document.querySelectorAll('.category-item input[type="checkbox"]:checked').forEach(cb => {
        selected.push(cb.value);
      });
      
      if(selected.length < 3){
        alert('Please select at least 3 categories');
        return;
      }
      
      if(selected.length > 5){
        alert('Please select no more than 5 categories');
        return;
      }
      
      // Save selected categories and show details page
      selectedCategories = selected;
      currentCategoryIndex = 0;
      categoryDetails = {};
      
      categorySection.style.display = 'none';
      categoryDetailsSection.style.display = 'block';
      loadCategoryDetails(0);
    });
  }
  
  // Back to categories
  if(backToCategoriesBtn){
    backToCategoriesBtn.addEventListener('click', function(){
      categoryDetailsSection.style.display = 'none';
      categorySection.style.display = 'block';
    });
  }
  
  // Previous category
  if(prevCategoryBtn){
    prevCategoryBtn.addEventListener('click', function(){
      saveCategoryDetails();
      currentCategoryIndex--;
      loadCategoryDetails(currentCategoryIndex);
    });
  }
  
  // Next category
  if(nextCategoryBtn){
    nextCategoryBtn.addEventListener('click', function(){
      if(!validateCurrentCategory()) {
        return;
      }
      saveCategoryDetails();
      currentCategoryIndex++;
      loadCategoryDetails(currentCategoryIndex);
    });
  }
  
  // Finish and save
  if(finishBtn){
    finishBtn.addEventListener('click', function(){
      if(!validateCurrentCategory()) {
        return;
      }
      saveCategoryDetails();
      
      // Save to localStorage
      const currentUser = window.currentUser;
      if(currentUser){
        const scorecardData = {
          categories: selectedCategories,
          details: categoryDetails,
          createdAt: new Date().toISOString()
        };
        localStorage.setItem(`scorecard:data:${currentUser}`, JSON.stringify(scorecardData));
      }
      
      console.log('Scorecard saved:', { categories: selectedCategories, details: categoryDetails });
      
      // Show success page
      categoryDetailsSection.style.display = 'none';
      showSuccessPage();
    });
  }
  
  // Success page management
  const successPageSection = document.getElementById('successPageSection');
  const viewScorecardBtn = document.getElementById('viewScorecardBtn');
  
  function showSuccessPage() {
    successPageSection.style.display = 'block';
  }
  
  // View My Scorecard button
  if(viewScorecardBtn) {
    viewScorecardBtn.addEventListener('click', function() {
      successPageSection.style.display = 'none';
      showScorecardView();
    });
  }
  
  // Scorecard view management
  const scorecardViewSection = document.getElementById('scorecardViewSection');
  const scorecardCategories = document.getElementById('scorecardCategories');
  const submitScorecard = document.getElementById('submitScorecard');
  const scorecardResultsSection = document.getElementById('scorecardResultsSection');
  let categoryRatings = {};
  
  function showScorecardView() {
    scorecardCategories.innerHTML = '';
    categoryRatings = {};
    
    selectedCategories.forEach((category, index) => {
      const details = categoryDetails[category];
      const card = document.createElement('div');
      card.className = 'scorecard-category-card';
      card.innerHTML = `
        <div class="category-card-header">
          <h3>${category}</h3>
          <button class="edit-category-btn" data-category="${category}" data-index="${index}">View/Edit Details</button>
        </div>
        <div class="category-goal-text">
          <strong>Goal:</strong> ${details.goals || 'No goal set'}
        </div>
        <div class="category-slider-container">
          <label class="category-slider-label">Progress:</label>
          <input type="range" class="category-slider" min="0" max="5" step="0.5" value="0" data-category="${category}">
          <span class="category-slider-value">0</span>
        </div>
      `;
      
      scorecardCategories.appendChild(card);
      categoryRatings[category] = 0;
      
      // Add slider event listener
      const slider = card.querySelector('.category-slider');
      const valueDisplay = card.querySelector('.category-slider-value');
      slider.addEventListener('input', function() {
        const value = parseFloat(this.value);
        valueDisplay.textContent = value;
        categoryRatings[category] = value;
      });
      
      // Add edit button listener
      const editBtn = card.querySelector('.edit-category-btn');
      editBtn.addEventListener('click', function() {
        const categoryIndex = parseInt(this.dataset.index);
        currentCategoryIndex = categoryIndex;
        scorecardViewSection.style.display = 'none';
        categoryDetailsSection.style.display = 'block';
        loadCategoryDetails(categoryIndex);
      });
    });
    
    scorecardViewSection.style.display = 'block';
  }
  
  // Submit scorecard and show results
  if(submitScorecard) {
    submitScorecard.addEventListener('click', function() {
      // Calculate average
      const values = Object.values(categoryRatings);
      const average = values.reduce((a, b) => a + b, 0) / values.length;
      
      // Save ratings to localStorage with history
      const currentUser = window.currentUser;
      if(currentUser){
        const existingData = JSON.parse(localStorage.getItem(`scorecard:data:${currentUser}`) || '{}');
        
        // Initialize history array if it doesn't exist
        if(!existingData.history) {
          existingData.history = [];
        }
        
        // Add current result to history
        existingData.history.push({
          ratings: categoryRatings,
          average: average,
          timestamp: new Date().toISOString(),
          date: new Date().toLocaleDateString()
        });
        
        // Keep current ratings and average at top level for quick access
        existingData.ratings = categoryRatings;
        existingData.average = average;
        existingData.submittedAt = new Date().toISOString();
        
        localStorage.setItem(`scorecard:data:${currentUser}`, JSON.stringify(existingData));
      }
      
      showResults(average);
    });
  }
  
  function showResults(average) {
    const averageScore = document.getElementById('averageScore');
    const categoryScoresList = document.getElementById('categoryScoresList');
    
    averageScore.textContent = average.toFixed(1);
    
    categoryScoresList.innerHTML = '';
    Object.entries(categoryRatings).forEach(([category, rating]) => {
      const item = document.createElement('div');
      item.className = 'category-score-item';
      item.innerHTML = `
        <div class="category-score-name">${category}</div>
        <div class="category-score-value">${rating}</div>
        <div class="category-score-max">out of 5</div>
      `;
      categoryScoresList.appendChild(item);
    });
    
    scorecardViewSection.style.display = 'none';
    scorecardResultsSection.style.display = 'block';
  }
  
  // Back to scorecard from results
  const backToScorecardBtn = document.getElementById('backToScorecardBtn');
  if(backToScorecardBtn) {
    backToScorecardBtn.addEventListener('click', function() {
      scorecardResultsSection.style.display = 'none';
      scorecardViewSection.style.display = 'block';
    });
  }
  
  // Done - back to welcome
  const backToWelcomeFromResults = document.getElementById('backToWelcomeFromResults');
  if(backToWelcomeFromResults) {
    backToWelcomeFromResults.addEventListener('click', function() {
      scorecardResultsSection.style.display = 'none';
      welcomeSection.style.display = 'flex';
    });
  }
  
  // History graph management
  const historyGraphSection = document.getElementById('historyGraphSection');
  const viewHistoryBtn = document.getElementById('viewHistoryBtn');
  const backToResultsBtn = document.getElementById('backToResultsBtn');
  const historyCanvas = document.getElementById('historyCanvas');
  const historyList = document.getElementById('historyList');
  const viewHistoryFromScorecardBtn = document.getElementById('viewHistoryFromScorecardBtn');
  const backToScorecardFromHistoryBtn = document.getElementById('backToScorecardFromHistoryBtn');
  
  if(viewHistoryBtn) {
    viewHistoryBtn.addEventListener('click', function() {
      showHistoryGraph();
    });
  }
  
  if(viewHistoryFromScorecardBtn) {
    viewHistoryFromScorecardBtn.addEventListener('click', function() {
      scorecardViewSection.style.display = 'none';
      showHistoryGraph();
    });
  }
  
  if(backToResultsBtn) {
    backToResultsBtn.addEventListener('click', function() {
      historyGraphSection.style.display = 'none';
      scorecardResultsSection.style.display = 'block';
    });
  }
  
  if(backToScorecardFromHistoryBtn) {
    backToScorecardFromHistoryBtn.addEventListener('click', function() {
      historyGraphSection.style.display = 'none';
      scorecardViewSection.style.display = 'block';
    });
  }
  
  function showHistoryGraph() {
    const currentUser = window.currentUser;
    if(!currentUser) return;
    
    const savedData = localStorage.getItem(`scorecard:data:${currentUser}`);
    if(!savedData) return;
    
    const data = JSON.parse(savedData);
    const history = data.history || [];
    
    if(history.length === 0) {
      historyList.innerHTML = '<p style="text-align:center;color:#666;">No history yet. Submit your scorecard to start tracking progress!</p>';
      scorecardResultsSection.style.display = 'none';
      historyGraphSection.style.display = 'block';
      return;
    }
    
    // Display history list
    historyList.innerHTML = '';
    history.forEach((entry, index) => {
      const div = document.createElement('div');
      div.className = 'history-entry';
      div.innerHTML = `
        <div>
          <div class="history-entry-date">${entry.date}</div>
          <div class="history-entry-label">Submission ${index + 1}</div>
        </div>
        <div style="text-align:right;">
          <div class="history-entry-score">${entry.average.toFixed(1)}</div>
          <div class="history-entry-label">out of 5.0</div>
        </div>
      `;
      historyList.appendChild(div);
    });
    
    // Draw simple graph
    drawHistoryGraph(history);
    
    scorecardResultsSection.style.display = 'none';
    historyGraphSection.style.display = 'block';
  }
  
  function drawHistoryGraph(history) {
    const canvas = historyCanvas;
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = 400;
    
    const padding = 50;
    const graphWidth = canvas.width - padding * 2;
    const graphHeight = canvas.height - padding * 2;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(padding, padding, graphWidth, graphHeight);
    
    // Draw grid lines
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for(let i = 0; i <= 5; i++) {
      const y = padding + graphHeight - (i / 5) * graphHeight;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + graphWidth, y);
      ctx.stroke();
      
      // Y-axis labels
      ctx.fillStyle = '#666';
      ctx.font = '12px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(i.toString(), padding - 10, y + 4);
    }
    
    if(history.length === 0) return;
    
    // Draw line graph
    ctx.strokeStyle = '#c78f57';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    history.forEach((entry, index) => {
      const x = padding + (index / (history.length - 1 || 1)) * graphWidth;
      const y = padding + graphHeight - (entry.average / 5) * graphHeight;
      
      if(index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      
      // Draw point
      ctx.fillStyle = '#c78f57';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    });
    
    ctx.stroke();
    
    // X-axis labels
    ctx.fillStyle = '#666';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    history.forEach((entry, index) => {
      const x = padding + (index / (history.length - 1 || 1)) * graphWidth;
      const shortDate = entry.date.split('/').slice(0, 2).join('/');
      ctx.fillText(shortDate, x, canvas.height - 20);
    });
    
    // Axis labels
    ctx.fillStyle = '#333';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Progress Over Time', canvas.width / 2, 25);
    
    ctx.save();
    ctx.translate(15, canvas.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Average Score', 0, 0);
    ctx.restore();
  }
  
  // Initialize count on page load
  updateCategoryCount();
});
