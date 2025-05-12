// Fetch data from the server
async function fetchData() {
    try {
        const response = await fetch('/api/transactions');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}

// Function to clear all graph containers
function clearGraphs() {
    const graphContainer = document.getElementById('graphContainer');
    if (graphContainer) {
        graphContainer.innerHTML = '';
    }
}

// Fetch LSTM predictions
async function fetchLSTMPredictions() {
    try {
        const response = await fetch('/api/lstm/predictions');
        const data = await response.json();
        
        if (data.predictions) {
            const predictions = data.predictions.split('\n');
            predictions.forEach(prediction => {
                if (prediction.includes('UPI')) {
                    const amount = parseFloat(prediction.match(/₹([\d,]+\.\d{2})/)[1].replace(/,/g, ''));
                    document.getElementById('nextMonthUpi').textContent = `₹${amount.toFixed(2)}`;
                } else if (prediction.includes('Cash')) {
                    const amount = parseFloat(prediction.match(/₹([\d,]+\.\d{2})/)[1].replace(/,/g, ''));
                    document.getElementById('nextMonthCash').textContent = `₹${amount.toFixed(2)}`;
                } else if (prediction.includes('Savings')) {
                    const amount = parseFloat(prediction.match(/₹([\d,]+\.\d{2})/)[1].replace(/,/g, ''));
                    document.getElementById('nextMonthSavings').textContent = `₹${amount.toFixed(2)}`;
                }
            });
        }
    } catch (error) {
        console.error('Error fetching LSTM predictions:', error);
    }
}

// Refresh all predictions
async function refreshPredictions() {
    await fetchLSTMPredictions();
    await updateProjection();
}

// Update savings projection
async function updateProjection() {
    try {
        const months = document.getElementById('projectionMonths').value;
        const response = await fetch(`/api/lstm/savings-projection?months=${months}`);
        const data = await response.json();
        
        if (data.projection) {
            // Parse the projection data and update the chart
            const lines = data.projection.split('\n');
            const dates = [];
            const historical = [];
            const projected = [];
            
            let isHistorical = true;
            for (const line of lines) {
                if (line.includes('Historical')) {
                    isHistorical = true;
                } else if (line.includes('Projection')) {
                    isHistorical = false;
                } else if (line.match(/^\d{4}-\d{2}-\d{2}/)) {
                    const [date, value] = line.split(',');
                    if (isHistorical) {
                        dates.push(date);
                        historical.push(parseFloat(value));
                    } else {
                        projected.push(parseFloat(value));
                    }
                }
            }

            const ctx = document.getElementById('savingsProjectionChart').getContext('2d');
            if (window.savingsProjectionChart) {
                window.savingsProjectionChart.destroy();
            }
            
            window.savingsProjectionChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dates,
                    datasets: [
                        {
                            label: 'Historical Savings',
                            data: historical,
                            borderColor: '#4BC0C0',
                            fill: false
                        },
                        {
                            label: 'Projected Savings',
                            data: projected,
                            borderColor: '#FF6384',
                            borderDash: [5, 5],
                            fill: false
                        }
                    ]
                },
                options: {
                    responsive: true,
                    scales: {
                        x: {
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45
                            }
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error updating projection:', error);
    }
}

// Calculate totals
function calculateTotals(data) {
    const totalUpi = data.upiTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalCash = data.cashTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalSavings = data.dailySavings.reduce((sum, s) => sum + s.amount, 0);

    document.getElementById('totalUpiExpenses').textContent = `₹${totalUpi.toFixed(2)}`;
    document.getElementById('totalCashExpenses').textContent = `₹${totalCash.toFixed(2)}`;
    document.getElementById('totalSavings').textContent = `₹${totalSavings.toFixed(2)}`;
}

// Create category chart
function createCategoryChart(data) {
    const categories = {};
    [...data.upiTransactions, ...data.cashTransactions].forEach(transaction => {
        categories[transaction.category] = (categories[transaction.category] || 0) + transaction.amount;
    });

    const ctx = document.getElementById('categoryChart').getContext('2d');
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(categories),
            datasets: [{
                data: Object.values(categories),
                backgroundColor: [
                    '#FF6384',
                    '#36A2EB',
                    '#FFCE56',
                    '#4BC0C0',
                    '#9966FF',
                    '#FF9F40'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

// Create savings trend chart
function createSavingsChart(data) {
    const savingsByDate = {};
    data.dailySavings.forEach(saving => {
        const date = moment(saving.date).format('YYYY-MM-DD');
        savingsByDate[date] = (savingsByDate[date] || 0) + saving.amount;
    });

    const dates = Object.keys(savingsByDate).sort();
    const amounts = dates.map(date => savingsByDate[date]);

    const ctx = document.getElementById('savingsChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Daily Savings',
                data: amounts,
                borderColor: '#4BC0C0',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

// Populate transactions table
function populateTransactionsTable(data) {
    const tableBody = document.querySelector('#transactionsTable tbody');
    tableBody.innerHTML = '';

    const allTransactions = [
        ...data.upiTransactions.map(t => ({ ...t, type: 'UPI' })),
        ...data.cashTransactions.map(t => ({ ...t, type: 'Cash' }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    allTransactions.slice(0, 10).forEach(transaction => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${moment(transaction.date).format('YYYY-MM-DD')}</td>
            <td>${transaction.type}</td>
            <td>${transaction.category}</td>
            <td>${transaction.description}</td>
            <td>₹${transaction.amount.toFixed(2)}</td>
        `;
        tableBody.appendChild(row);
    });
}

// Initialize the application
async function init() {
    const data = await fetchData();
    if (data) {
        calculateTotals(data);
        createCategoryChart(data);
        createSavingsChart(data);
        populateTransactionsTable(data);
    }
}

// Start the application
init(); 

// Menu option handlers
async function showExpenses(period) {
    try {
        // Clear all graphs before showing new one
        clearGraphs();
        
        console.log(`Fetching ${period} expenses...`);
        const response = await fetch(`http://localhost:5000/api/lstm/expenses?period=${period}`);
        const data = await response.json();
        
        if (data.error) {
            console.error('Server error:', data.error);
            const graphContainer = document.getElementById('graphContainer');
            graphContainer.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
            return;
        }
        
        if (data.graph) {
            console.log(`Received graph data for ${period} expenses`);
            const graphContainer = document.getElementById('graphContainer');
            if (!graphContainer) {
                console.error('Container not found: graphContainer');
                return;
            }
            document.getElementById('graphTitle').textContent = `${period.charAt(0).toUpperCase() + period.slice(1)} Expenses`;
            graphContainer.innerHTML = `<img src="data:image/png;base64,${data.graph}" class="img-fluid" alt="${period} expenses">`;
        } else {
            console.error('No graph data received');
            const graphContainer = document.getElementById('graphContainer');
            graphContainer.innerHTML = '<div class="alert alert-warning">No data available to display</div>';
        }
    } catch (error) {
        console.error('Error fetching expenses:', error);
        const graphContainer = document.getElementById('graphContainer');
        graphContainer.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
}

async function showSavings(period) {
    try {
        // Clear all graphs before showing new one
        clearGraphs();
        
        console.log(`Fetching ${period} savings...`);
        const response = await fetch(`http://localhost:5000/api/lstm/savings?period=${period}`);
        const data = await response.json();
        
        if (data.error) {
            console.error('Server error:', data.error);
            const graphContainer = document.getElementById('graphContainer');
            graphContainer.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
            return;
        }
        
        if (data.graph) {
            console.log(`Received graph data for ${period} savings`);
            const graphContainer = document.getElementById('graphContainer');
            if (!graphContainer) {
                console.error('Container not found: graphContainer');
                return;
            }
            document.getElementById('graphTitle').textContent = `${period.charAt(0).toUpperCase() + period.slice(1)} Savings`;
            graphContainer.innerHTML = `<img src="data:image/png;base64,${data.graph}" class="img-fluid" alt="${period} savings">`;
        } else {
            console.error('No graph data received');
            const graphContainer = document.getElementById('graphContainer');
            graphContainer.innerHTML = '<div class="alert alert-warning">No data available to display</div>';
        }
    } catch (error) {
        console.error('Error fetching savings:', error);
        const graphContainer = document.getElementById('graphContainer');
        graphContainer.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
}

async function showSavingsProjection() {
    try {
        // Clear all graphs before showing new one
        clearGraphs();
        
        const months = document.getElementById('projectionMonths').value;
        console.log(`Fetching savings projection for ${months} months...`);
        const response = await fetch(`http://localhost:5000/api/lstm/savings-projection?months=${months}`);
        const data = await response.json();
        
        if (data.error) {
            console.error('Server error:', data.error);
            const graphContainer = document.getElementById('graphContainer');
            graphContainer.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
            return;
        }
        
        if (data.graph) {
            console.log('Received savings projection graph data');
            const graphContainer = document.getElementById('graphContainer');
            if (!graphContainer) {
                console.error('Container not found: graphContainer');
                return;
            }
            document.getElementById('graphTitle').textContent = `Savings Projection (${months} Months)`;
            graphContainer.innerHTML = `<img src="data:image/png;base64,${data.graph}" class="img-fluid" alt="Savings projection">`;
        } else {
            console.error('No graph data received');
            const graphContainer = document.getElementById('graphContainer');
            graphContainer.innerHTML = '<div class="alert alert-warning">No data available to display</div>';
        }
    } catch (error) {
        console.error('Error updating projection:', error);
        const graphContainer = document.getElementById('graphContainer');
        graphContainer.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
}

async function showNextMonthSavings() {
    try {
        console.log('Fetching next month savings prediction...');
        const response = await fetch('http://localhost:5000/api/lstm/next-month-savings');
        const data = await response.json();
        
        if (data.error) {
            console.error('Server error:', data.error);
            const graphContainer = document.getElementById('graphContainer');
            graphContainer.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
            return;
        }
        
        if (data.prediction) {
            console.log('Received next month savings prediction');
            const amount = parseFloat(data.prediction.match(/₹([\d,]+\.\d{2})/)[1].replace(/,/g, ''));
            document.getElementById('graphTitle').textContent = 'Next Month Estimated Savings';
            const graphContainer = document.getElementById('graphContainer');
            graphContainer.innerHTML = `
                <div class="text-center">
                    <h2 class="mb-4">Estimated Savings for Next Month</h2>
                    <h1 class="text-primary">₹${amount.toFixed(2)}</h1>
                </div>
            `;
        } else {
            console.error('No prediction data received');
            const graphContainer = document.getElementById('graphContainer');
            graphContainer.innerHTML = '<div class="alert alert-warning">No prediction data available</div>';
        }
    } catch (error) {
        console.error('Error fetching next month savings:', error);
        const graphContainer = document.getElementById('graphContainer');
        graphContainer.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
}

async function showNextWeekSavings() {
    try {
        console.log('Fetching next week savings prediction...');
        const response = await fetch('http://localhost:5000/api/lstm/next-week-savings');
        const data = await response.json();
        
        if (data.error) {
            console.error('Server error:', data.error);
            const graphContainer = document.getElementById('graphContainer');
            graphContainer.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
            return;
        }
        
        if (data.prediction) {
            console.log('Received next week savings prediction');
            const amount = parseFloat(data.prediction.match(/₹([\d,]+\.\d{2})/)[1].replace(/,/g, ''));
            document.getElementById('graphTitle').textContent = 'Next Week Estimated Savings';
            const graphContainer = document.getElementById('graphContainer');
            graphContainer.innerHTML = `
                <div class="text-center">
                    <h2 class="mb-4">Estimated Savings for Next Week</h2>
                    <h1 class="text-primary">₹${amount.toFixed(2)}</h1>
                </div>
            `;
        } else {
            console.error('No prediction data received');
            const graphContainer = document.getElementById('graphContainer');
            graphContainer.innerHTML = '<div class="alert alert-warning">No prediction data available</div>';
        }
    } catch (error) {
        console.error('Error fetching next week savings:', error);
        const graphContainer = document.getElementById('graphContainer');
        graphContainer.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
}

// Helper functions for displaying data
function updateExpensesChart(data, period) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    if (window.expensesChart) {
        window.expensesChart.destroy();
    }
    
    window.expensesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.dates,
            datasets: [{
                label: `${period.charAt(0).toUpperCase() + period.slice(1)} Expenses`,
                data: data.amounts,
                borderColor: '#FF6384',
                fill: false
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

function updateSavingsChart(data, period) {
    const ctx = document.getElementById('savingsChart').getContext('2d');
    if (window.savingsChart) {
        window.savingsChart.destroy();
    }
    
    window.savingsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.dates,
            datasets: [{
                label: `${period.charAt(0).toUpperCase() + period.slice(1)} Savings`,
                data: data.amounts,
                borderColor: '#4BC0C0',
                fill: false
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

function displayNextWeekSavings(amount) {
    // Create a modal to display next week savings
    const modalHtml = `
        <div class="modal fade" id="nextWeekSavingsModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Next Week Savings Prediction</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <h3 class="text-center">₹${amount.toFixed(2)}</h3>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to document
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('nextWeekSavingsModal'));
    modal.show();
    
    // Remove modal from DOM after it's hidden
    document.getElementById('nextWeekSavingsModal').addEventListener('hidden.bs.modal', function () {
        this.remove();
    });
}

// Helper function to update the main graph
function updateMainGraph(data, title, color, isProjection = false) {
    const ctx = document.getElementById('mainGraph').getContext('2d');
    document.getElementById('graphTitle').textContent = title;

    if (window.mainGraph) {
        window.mainGraph.destroy();
    }

    let chartData;
    if (isProjection) {
        // Parse projection data
        const lines = data.split('\n');
        const dates = [];
        const historical = [];
        const projected = [];
        
        let isHistorical = true;
        for (const line of lines) {
            if (line.includes('Historical')) {
                isHistorical = true;
            } else if (line.includes('Projection')) {
                isHistorical = false;
            } else if (line.match(/^\d{4}-\d{2}-\d{2}/)) {
                const [date, value] = line.split(',');
                if (isHistorical) {
                    dates.push(date);
                    historical.push(parseFloat(value));
                } else {
                    projected.push(parseFloat(value));
                }
            }
        }

        chartData = {
            labels: dates,
            datasets: [
                {
                    label: 'Historical',
                    data: historical,
                    borderColor: color,
                    fill: false
                },
                {
                    label: 'Projected',
                    data: projected,
                    borderColor: '#FF6384',
                    borderDash: [5, 5],
                    fill: false
                }
            ]
        };
    } else {
        // Parse regular data
        const lines = data.split('\n');
        const dates = [];
        const values = [];
        
        for (const line of lines) {
            if (line.match(/^\d{4}-\d{2}-\d{2}/)) {
                const [date, value] = line.split(',');
                dates.push(date);
                values.push(parseFloat(value));
            }
        }

        chartData = {
            labels: dates,
            datasets: [{
                label: title,
                data: values,
                borderColor: color,
                fill: false
            }]
        };
    }

    window.mainGraph = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '₹' + value.toFixed(2);
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return '₹' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            }
        }
    });
} 