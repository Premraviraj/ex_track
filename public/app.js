// Add this at the top of the file
let serverPort = 5000; // Default port

// Function to detect server port
async function detectServerPort() {
    const ports = [5000, 5001, 5002, 5003, 5004];
    for (const port of ports) {
        try {
            const response = await fetch(`http://localhost:${port}/api/health`);
            if (response.ok) {
                serverPort = port;
                console.log(`Server detected on port ${port}`);
                return port;
            }
        } catch (error) {
            continue;
        }
    }
    throw new Error('Could not detect server port');
}

// Fetch data from the server
async function fetchData() {
    try {
        const response = await fetch(`http://localhost:${serverPort}/api/transactions`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}

// Fetch goals from the server
async function fetchGoals() {
    try {
        const response = await fetch(`http://localhost:${serverPort}/api/goals`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const goals = await response.json();
        return goals;
    } catch (error) {
        console.error('Error fetching goals:', error);
        return [];
    }
}

// Calculate totals
function calculateTotals(data) {
    if (!data || !data.upiTransactions || !data.cashTransactions) {
        console.error('Invalid data structure received');
        document.getElementById('totalUpiExpenses').textContent = '₹0.00';
        document.getElementById('totalCashExpenses').textContent = '₹0.00';
        return;
    }

    const totalUpi = data.upiTransactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const totalCash = data.cashTransactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    document.getElementById('totalUpiExpenses').textContent = `₹${totalUpi.toFixed(2)}`;
    document.getElementById('totalCashExpenses').textContent = `₹${totalCash.toFixed(2)}`;
}

// Helper function to get category icon
function getCategoryIcon(category) {
    if (!category) return 'star'; // Default icon for undefined category
    
    const categoryIcons = {
        'savings': 'piggy-bank',
        'investment': 'chart-line',
        'purchase': 'shopping-cart',
        'food': 'utensils',
        'transport': 'car',
        'shopping': 'shopping-cart',
        'bills': 'file-invoice-dollar',
        'entertainment': 'film',
        'health': 'heartbeat',
        'education': 'graduation-cap',
        'other': 'star'
    };

    return categoryIcons[category.toLowerCase()] || 'star';
}

// Display goals in the goals list
function displayGoals(goals) {
    const goalsList = document.getElementById('goalsList');
    if (!goalsList) return;

    if (!Array.isArray(goals) || goals.length === 0) {
        goalsList.innerHTML = `
            <div class="empty-goals">
                <i class="fas fa-bullseye"></i>
                <p>No goals set yet. Click the + button to add a goal!</p>
            </div>
        `;
        return;
    }

    goalsList.innerHTML = goals.map(goal => {
        // Map the correct property names from the database
        const name = goal.name || 'Unnamed Goal';
        const category = goal.category || 'other';
        const type = goal.type || 'flexible';
        const targetAmount = parseFloat(goal.targetAmount) || 0;
        const currentAmount = parseFloat(goal.currentAmount) || 0;
        const deadline = goal.deadline ? new Date(goal.deadline).toLocaleDateString() : 'No deadline';
        
        // Calculate progress percentage safely
        let progress = 0;
        if (targetAmount > 0) {
            progress = Math.round((currentAmount / targetAmount) * 100);
            // Ensure progress is between 0 and 100
            progress = Math.min(Math.max(progress, 0), 100);
        }
        
        // Calculate remaining amount
        const remainingAmount = Math.max(targetAmount - currentAmount, 0);

        return `
            <div class="goal-item" data-goal-id="${goal._id}" onclick="showGoalDetails('${goal._id}')">
                <div class="goal-header">
                    <div class="goal-icon">
                        <i class="fas fa-${getCategoryIcon(category)}"></i>
                    </div>
                    <div class="goal-title-section">
                        <h5 class="goal-title">${name}</h5>
                        <div class="goal-badges">
                            <span class="goal-badge badge-${type}">
                                <i class="fas fa-${type === 'rigid' ? 'lock' : 'unlock'}"></i>
                                ${type}
                            </span>
                            <span class="goal-badge badge-category">
                                <i class="fas fa-${getCategoryIcon(category)}"></i>
                                ${category}
                            </span>
                        </div>
                    </div>
                </div>
                <div class="goal-progress">
                    <div class="progress-label">
                        <span>Progress</span>
                        <span class="progress-percentage">${progress}%</span>
                    </div>
                    <div class="progress">
                        <div class="progress-bar" role="progressbar" 
                             style="width: ${progress}%" 
                             aria-valuenow="${progress}"
                             aria-valuemin="0" 
                             aria-valuemax="100">
                        </div>
                    </div>
                </div>
                <div class="goal-details">
                    <div class="detail-item">
                        <span class="detail-label">
                            <i class="fas fa-rupee-sign"></i>
                            Current Amount
                        </span>
                        <span class="detail-value detail-amount">
                            <i class="fas fa-rupee-sign"></i>
                            ${currentAmount.toFixed(2)}
                        </span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">
                            <i class="fas fa-bullseye"></i>
                            Target Amount
                        </span>
                        <span class="detail-value detail-amount">
                            <i class="fas fa-rupee-sign"></i>
                            ${targetAmount.toFixed(2)}
                        </span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">
                            <i class="far fa-calendar-alt"></i>
                            Target Date
                        </span>
                        <span class="detail-value">
                            ${deadline}
                        </span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">
                            <i class="fas fa-chart-line"></i>
                            Remaining
                        </span>
                        <span class="detail-value detail-amount">
                            <i class="fas fa-rupee-sign"></i>
                            ${remainingAmount.toFixed(2)}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Initialize the application
async function init() {
    try {
        await detectServerPort();
        // Load goals from server
        const response = await fetch(`http://localhost:${serverPort}/api/goals`);
        if (!response.ok) {
            throw new Error('Failed to fetch goals');
        }
        const goals = await response.json();
        displayGoals(goals);

        // Update goals count
        const goalsCount = document.getElementById('goalsCount');
        if (goalsCount) {
            goalsCount.textContent = Array.isArray(goals) ? goals.length : 0;
        }

        // Load and display expenses
        await loadExpenses();
    } catch (error) {
        console.error('Error initializing app:', error);
        const goalsList = document.getElementById('goalsList');
        if (goalsList) {
            goalsList.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle me-2"></i>
                    Error loading data. Please try again later.
                </div>
            `;
        }
    }
}

// Function to load and display expenses
async function loadExpenses() {
    try {
        const response = await fetch(`http://localhost:${serverPort}/api/transactions`);
        if (!response.ok) {
            throw new Error('Failed to fetch expenses');
        }
        const data = await response.json();
        calculateTotals(data);
    } catch (error) {
        console.error('Error loading expenses:', error);
        // Set default values if fetch fails
        document.getElementById('totalUpiExpenses').textContent = '₹0.00';
        document.getElementById('totalCashExpenses').textContent = '₹0.00';
    }
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Financial Goals Modal
function showFinancialGoalsModal() {
    // Remove any existing modal before adding a new one
    const existingModal = document.getElementById('financialGoalsModal');
    if (existingModal) {
        existingModal.remove();
    }
    const modalHtml = `
        <div class="modal fade" id="financialGoalsModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Set Financial Goal</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="financialGoalForm">
                            <div class="mb-3">
                                <label for="goalName" class="form-label">Goal Name</label>
                                <input type="text" class="form-control" id="goalName" required>
                            </div>
                            <div class="mb-3">
                                <label for="goalCategory" class="form-label">Category</label>
                                <select class="form-control" id="goalCategory" required>
                                    <option value="">Select a category</option>
                                    <option value="savings">Savings</option>
                                    <option value="investment">Investment</option>
                                    <option value="purchase">Purchase</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label for="goalType" class="form-label">Goal Type</label>
                                <div class="d-flex gap-2">
                                    <div class="form-check">
                                        <input class="form-check-input" type="radio" name="goalType" id="rigidGoal" value="rigid" required>
                                        <label class="form-check-label text-danger" for="rigidGoal">
                                            Rigid
                                        </label>
                                    </div>
                                    <div class="form-check">
                                        <input class="form-check-input" type="radio" name="goalType" id="flexibleGoal" value="flexible" required>
                                        <label class="form-check-label text-success" for="flexibleGoal">
                                            Flexible
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label for="targetAmount" class="form-label">Target Amount (₹)</label>
                                <input type="number" class="form-control" id="targetAmount" required min="0" step="0.01">
                            </div>
                            <div class="mb-3">
                                <label for="currentAmount" class="form-label">
                                    <i class="fas fa-rupee-sign me-2"></i>
                                    Current Amount (₹)
                                </label>
                                <input type="number" class="form-control" id="currentAmount" required min="0" step="0.01" placeholder="Enter your current amount">
                            </div>
                            <div class="mb-3">
                                <label for="targetDate" class="form-label">
                                    <i class="far fa-calendar-alt me-2"></i>
                                    Target Date
                                </label>
                                <input type="date" class="form-control" id="targetDate" required>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-primary" onclick="saveFinancialGoal()">Save Goal</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to document
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('financialGoalsModal'));
    modal.show();
    
    // Remove modal from DOM after it's hidden
    document.getElementById('financialGoalsModal').addEventListener('hidden.bs.modal', function () {
        this.remove();
    });
}

// Update saveFinancialGoal function to include currentMoney
async function saveFinancialGoal() {
    const name = document.getElementById('goalName').value;
    const category = document.getElementById('goalCategory').value;
    const type = document.querySelector('input[name="goalType"]:checked')?.value;
    const targetAmount = parseFloat(document.getElementById('targetAmount').value);
    const deadline = document.getElementById('targetDate').value;
    const currentAmount = parseFloat(document.getElementById('currentAmount').value);
    
    if (!name || !category || !type || !targetAmount || !deadline || !currentAmount) {
        alert('Please fill in all fields');
        return;
    }
    
    const goalData = {
        name,
        category,
        type,
        targetAmount,
        deadline,
        currentAmount,
        progress: 0 // Initialize progress as 0
    };
    console.log('Sending goal data:', goalData);
    
    try {
        const response = await fetch(`http://localhost:${serverPort}/api/goals`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(goalData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error:', errorText);
            throw new Error('Failed to save goal: ' + errorText);
        }

        const savedGoal = await response.json();
        console.log('Server returned:', savedGoal);
        
        // Refresh the goals list
        const goals = await fetchGoals();
        displayGoals(goals);
        
        // Close the modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('financialGoalsModal'));
        modal.hide();
    } catch (error) {
        console.error('Error saving goal:', error);
        alert('Failed to save goal. Please try again. ' + error.message);
    }
}

// Add click event listener to the goals card
document.addEventListener('DOMContentLoaded', function() {
    const goalsCard = document.querySelector('.clickable-goal');
    const addGoalButton = document.querySelector('.add-goal-button');
    
    if (goalsCard) {
        goalsCard.addEventListener('click', showFinancialGoalsModal);
    }
    
    if (addGoalButton) {
        addGoalButton.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent the card click event from firing
            showFinancialGoalsModal();
        });
    }
});

// Add this function at the top of the file
async function checkServerStatus() {
    try {
        const response = await fetch('/api/health');
        return response.ok;
    } catch (error) {
        return false;
    }
}

// Initialize modals
let goalDetailsModal;
let addCashExpenseModal;
document.addEventListener('DOMContentLoaded', function() {
    goalDetailsModal = new bootstrap.Modal(document.getElementById('goalDetailsModal'));
    addCashExpenseModal = new bootstrap.Modal(document.getElementById('addCashExpenseModal'));
    
    // Set default date to today in the cash expense form
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('expenseDate').value = today;
});

// Function to show goal details
async function showGoalDetails(goalId) {
    try {
        const modalTitle = document.getElementById('goalDetailsModalLabel');
        const predictionValue = document.getElementById('predictionValue');
        const expectedCompletion = document.getElementById('expectedCompletion');
        const successProbability = document.getElementById('successProbability');
        const recommendedSavings = document.getElementById('recommendedSavings');
        const riskLevel = document.getElementById('riskLevel');

        // Reset previous chart if it exists
        const existingChart = Chart.getChart('progressChart');
        if (existingChart) {
            existingChart.destroy();
        }

        // Reset modal content
        predictionValue.textContent = 'Loading...';
        expectedCompletion.textContent = '-';
        successProbability.textContent = '-';
        recommendedSavings.textContent = '-';
        riskLevel.textContent = '-';
        riskLevel.className = 'prediction-item-value';

        // Show modal
        goalDetailsModal.show();

        // Fetch goal data
        let goalResponse;
        try {
            goalResponse = await fetch(`http://localhost:${serverPort}/api/goals/${goalId}`);
            if (!goalResponse.ok) {
                throw new Error(`Server returned ${goalResponse.status}`);
            }
            const contentType = goalResponse.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server returned non-JSON response');
            }
        } catch (error) {
            throw new Error('Unable to connect to server. Please check if the server is running.');
        }

        const goal = await goalResponse.json();
        if (!goal || !goal._id) {
            throw new Error('Invalid goal data received from server');
        }

        // Use correct property names
        const name = goal.name || 'Unnamed Goal';
        const targetAmount = goal.targetAmount || 0;
        const currentAmount = goal.currentAmount || 0;
        const deadline = goal.deadline ? new Date(goal.deadline).toLocaleDateString() : 'No deadline';

        // Update modal title
        modalTitle.textContent = name;

        // Check if LSTM is enabled
        const lstmEnabled = localStorage.getItem('lstmEnabled') === 'true';
        const predictionEndpoint = lstmEnabled ? 
            `http://localhost:${serverPort}/api/goals/${goalId}/predictions?model=lstm` :
            `http://localhost:${serverPort}/api/goals/${goalId}/predictions`;

        // Fetch predictions
        let response;
        try {
            response = await fetch(predictionEndpoint);
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server returned non-JSON response');
            }
        } catch (error) {
            throw new Error('Unable to fetch predictions. Please try again later.');
        }

        const predictions = await response.json();
        if (!predictions || predictions.error) {
            throw new Error(predictions?.error || 'Invalid prediction data received');
        }

        // Update UI with predictions
        predictionValue.textContent = `${predictions.success_probability}%`;
        expectedCompletion.textContent = predictions.expected_completion_date;
        successProbability.textContent = `${predictions.success_probability}%`;
        recommendedSavings.textContent = `₹${predictions.daily_savings_needed}/day`;
        riskLevel.textContent = predictions.risk_level;

        // Add color classes based on risk level
        riskLevel.className = 'prediction-item-value';
        switch (predictions.risk_level.toLowerCase()) {
            case 'high':
                riskLevel.classList.add('text-danger');
                break;
            case 'medium':
                riskLevel.classList.add('text-warning');
                break;
            case 'low':
                riskLevel.classList.add('text-success');
                break;
        }

        // Create progress chart
        createProgressChart(goal, predictions);
    } catch (error) {
        console.error('Error showing goal details:', error);
        const predictionValue = document.getElementById('predictionValue');
        
        // Show error message in the modal
        predictionValue.innerHTML = `
            <div class="alert alert-danger" role="alert">
                <i class="fas fa-exclamation-circle me-2"></i>
                ${error.message}
            </div>
        `;
        
        // Update other fields to show error state
        document.getElementById('expectedCompletion').textContent = 'Error';
        document.getElementById('successProbability').textContent = 'Error';
        document.getElementById('recommendedSavings').textContent = 'Error';
        document.getElementById('riskLevel').textContent = 'Error';
        
        // Add error styling
        document.querySelectorAll('.prediction-item').forEach(item => {
            item.classList.add('bg-light');
        });
    }
}

// Function to create progress chart
function createProgressChart(goal, predictions) {
    const ctx = document.getElementById('progressChart').getContext('2d');
    
    // Generate data for the last 6 months and future predictions
    const months = [];
    const progressData = [];
    const targetData = [];
    const predictedData = [];
    
    const currentDate = new Date();
    const targetDate = new Date(goal.deadline);
    const startDate = new Date(currentDate);
    startDate.setMonth(startDate.getMonth() - 6);
    
    // Calculate end date (either target date or predicted completion date)
    const endDate = new Date(predictions.expected_completion_date);
    
    for (let d = new Date(startDate); d <= endDate; d.setMonth(d.getMonth() + 1)) {
        months.push(d.toLocaleDateString('default', { month: 'short' }));
        
        if (d <= currentDate) {
            // Historical data
            const monthProgress = (goal.currentAmount / goal.targetAmount) * 100;
            progressData.push(monthProgress);
            
            // Target progress
            const totalDays = (targetDate - startDate) / (1000 * 60 * 60 * 24);
            const daysElapsed = (d - startDate) / (1000 * 60 * 60 * 24);
            const targetProgress = (daysElapsed / totalDays) * 100;
            targetData.push(Math.min(targetProgress, 100));
            
            // Predicted progress (same as actual for historical data)
            predictedData.push(monthProgress);
        } else {
            // Future predictions
            const daysFromStart = (d - startDate) / (1000 * 60 * 60 * 24);
            const predictedProgress = Math.min(
                (goal.currentAmount + (predictions.daily_savings_needed * daysFromStart)) / goal.targetAmount * 100,
                100
            );
            predictedData.push(predictedProgress);
            
            // Target progress
            const totalDays = (targetDate - startDate) / (1000 * 60 * 60 * 24);
            const daysElapsed = (d - startDate) / (1000 * 60 * 60 * 24);
            const targetProgress = (daysElapsed / totalDays) * 100;
            targetData.push(Math.min(targetProgress, 100));
            
            // No actual progress for future dates
            progressData.push(null);
        }
    }
    
    // Create the chart
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'Actual Progress',
                    data: progressData,
                    borderColor: '#4a90e2',
                    backgroundColor: 'rgba(74, 144, 226, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Predicted Progress',
                    data: predictedData,
                    borderColor: '#51cf66',
                    borderDash: [5, 5],
                    tension: 0.4,
                    fill: false
                },
                {
                    label: 'Target Progress',
                    data: targetData,
                    borderColor: '#6c757d',
                    borderDash: [5, 5],
                    tension: 0.4,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Progress (%)'
                    }
                }
            }
        }
    });
}

// Function to show add cash expense modal
function showAddCashExpenseModal() {
    // Reset form
    document.getElementById('cashExpenseForm').reset();
    // Set default date to today
    document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
    // Show modal
    addCashExpenseModal.show();
}

// Function to save cash expense
async function saveCashExpense() {
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const category = document.getElementById('expenseCategory').value;
    const date = document.getElementById('expenseDate').value;
    const description = document.getElementById('expenseDescription').value;

    if (!amount || !category || !date || !description) {
        alert('Please fill in all fields');
        return;
    }

    try {
        const response = await fetch(`http://localhost:${serverPort}/api/transactions/cash`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount,
                category,
                date,
                description,
                type: 'Expense'
            })
        });

        if (!response.ok) {
            throw new Error('Failed to save cash expense');
        }

        // Close modal
        addCashExpenseModal.hide();

        // Refresh expenses data
        await loadExpenses();

        // Show success message
        alert('Cash expense added successfully!');
    } catch (error) {
        console.error('Error saving cash expense:', error);
        alert('Failed to save cash expense. Please try again.');
    }
} 