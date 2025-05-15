const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Connect to MongoDB using existing database
mongoose.connect('mongodb://localhost:27017/expense-tracker', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to existing MongoDB database');
    // List all collections to verify
    mongoose.connection.db.listCollections().toArray((err, collections) => {
        if (err) {
            console.error('Error listing collections:', err);
        } else {
            console.log('Available collections:', collections.map(c => c.name));
        }
    });
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

// Use existing collections with proper schema
const Transaction = mongoose.model('Transaction', {
    amount: Number,
    category: String,
    date: Date,
    type: String,
    description: String
}, 'transactions'); // Specify existing collection name

// Flexible models for exact collection names
const UpiTransaction = mongoose.model('upi_transactions', new mongoose.Schema({}, { strict: false }), 'upi_transactions');
const CashTransaction = mongoose.model('cash_transactions', new mongoose.Schema({}, { strict: false }), 'cash_transactions');
const Goal = mongoose.model('goals', new mongoose.Schema({
    name: String,
    category: String,
    type: String,
    targetAmount: Number,
    currentAmount: Number,
    deadline: Date,
    progress: Number
}), 'goals');

// Add health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Function to get historical savings data
async function getHistoricalSavingsData() {
    try {
        // Fetch from the correct collection: daily_savings
        const DailySaving = mongoose.model('daily_savings', new mongoose.Schema({}, { strict: false }), 'daily_savings');
        const savings = await DailySaving.find({
            date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
        });

        // Calculate daily and weekly savings
        const dailySavings = {};
        const weeklySavings = {};

        savings.forEach(saving => {
            const date = saving.date ? new Date(saving.date).toISOString().split('T')[0] : null;
            const weekStart = saving.date ? new Date(saving.date) : null;
            if (weekStart) weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            const weekKey = weekStart ? weekStart.toISOString().split('T')[0] : null;

            if (date && saving.amount) {
                dailySavings[date] = (dailySavings[date] || 0) + Number(saving.amount);
            }
            if (weekKey && saving.amount) {
                weeklySavings[weekKey] = (weeklySavings[weekKey] || 0) + Number(saving.amount);
            }
        });

        return {
            daily_savings: Object.values(dailySavings),
            weekly_savings: Object.values(weeklySavings)
        };
    } catch (error) {
        console.error('Error getting historical savings:', error);
        return { daily_savings: [], weekly_savings: [] };
    }
}

// API endpoint to get a single goal by ID
app.get('/api/goals/:goalId', async (req, res) => {
    try {
        // Validate if the ID is a valid MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(req.params.goalId)) {
            return res.status(400).json({ error: 'Invalid goal ID format' });
        }

        const goal = await Goal.findById(req.params.goalId);
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }
        res.json(goal);
    } catch (error) {
        console.error('Error fetching goal:', error);
        res.status(500).json({ error: 'Error fetching goal' });
    }
});

// API endpoint to get goal predictions
app.get('/api/goals/:goalId/predictions', async (req, res) => {
    try {
        // Validate if the ID is a valid MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(req.params.goalId)) {
            return res.status(400).json({ error: 'Invalid goal ID format' });
        }

        const goal = await Goal.findById(req.params.goalId);
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        const historicalData = await getHistoricalSavingsData();
        
        // Prepare goal data for prediction
        const goalData = {
            targetAmount: Number(goal.targetAmount),
            currentAmount: Number(goal.currentAmount),
            targetDate: goal.deadline instanceof Date ? goal.deadline.toISOString().split('T')[0] : goal.deadline
        };

        // Call Python script for prediction
        const pythonProcess = spawn('python3', [
            path.join(__dirname, 'goal_predictor.py'),
            JSON.stringify(goalData),
            JSON.stringify(historicalData)
        ]);

        let predictionData = '';
        let errorData = '';

        pythonProcess.stdout.on('data', (data) => {
            predictionData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorData += data.toString();
            // Log Python errors for debugging
            console.error('Python stderr:', data.toString());
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error('Python process error:', errorData);
                return res.status(500).json({ 
                    error: 'Prediction failed',
                    details: errorData
                });
            }

            try {
                // Split the output by newlines and get the last line which should be the JSON response
                const lines = predictionData.trim().split('\n');
                const lastLine = lines[lines.length - 1];
                
                // Try to parse the last line as JSON
                const prediction = JSON.parse(lastLine);
                
                if (prediction.error) {
                    return res.status(500).json({ 
                        error: 'Prediction error',
                        details: prediction.error
                    });
                }
                
                // Send the prediction response
                res.json(prediction);
            } catch (error) {
                console.error('Error parsing prediction:', error, predictionData);
                res.status(500).json({ 
                    error: 'Invalid prediction data',
                    details: error.message,
                    raw: predictionData
                });
            }
        });
    } catch (error) {
        console.error('Error getting predictions:', error);
        res.status(500).json({ 
            error: 'Server error',
            details: error.message
        });
    }
});

// API endpoint to get all goals
app.get('/api/goals', async (req, res) => {
    try {
        const goals = await Goal.find().sort({ createdAt: -1 });
        res.json(goals);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching goals' });
    }
});

// API endpoint to save a new goal
app.post('/api/goals', async (req, res) => {
    try {
        const { name, category, type, targetAmount, deadline, currentAmount } = req.body;
        const progress = (currentAmount / targetAmount) * 100;
        const goal = new Goal({
            name,
            category,
            type,
            targetAmount,
            currentAmount,
            deadline,
            progress
        });
        await goal.save();
        res.json(goal);
    } catch (error) {
        res.status(500).json({ error: 'Error saving goal' });
    }
});

// API endpoint to get transactions from both collections
app.get('/api/transactions', async (req, res) => {
    try {
        const upiTransactions = await UpiTransaction.find({}).sort({ date: -1 });
        const cashTransactions = await CashTransaction.find({}).sort({ date: -1 });

        // Debug: print a sample document
        console.log('Sample UPI transaction:', upiTransactions[0]);
        console.log('Sample Cash transaction:', cashTransactions[0]);

        const totalUpi = upiTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const totalCash = cashTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        res.json({
            upiTransactions,
            cashTransactions,
            totalUpi,
            totalCash
        });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({
            error: 'Error fetching transactions',
            details: error.message
        });
    }
});

// Add cash expense transaction
app.post('/api/transactions/cash', async (req, res) => {
    try {
        const { amount, category, date, description, type } = req.body;
        
        // Validate required fields
        if (!amount || !category || !date || !description || !type) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Create new transaction in cash_transactions collection
        const transaction = new CashTransaction({
            amount: Number(amount),
            category,
            date: new Date(date),
            description,
            type,
            paymentMethod: 'Cash'
        });

        // Save transaction
        await transaction.save();

        res.status(201).json(transaction);
    } catch (error) {
        console.error('Error saving cash transaction:', error);
        res.status(500).json({ error: 'Failed to save transaction' });
    }
});

// LSTM Analysis API
app.get('/api/lstm/analysis', async (req, res) => {
    const { model = 'lstm', range = '1m' } = req.query;
    const { spawn } = require('child_process');
    const path = require('path');

    // Map range to months for projection
    const rangeMap = { '1m': 1, '3m': 3, '6m': 6, '1y': 12 };
    const months = rangeMap[range] || 1;

    // Call LSTM.py for savings projection
    const pythonProcess = spawn('python3', [
        path.join(__dirname, 'LSTM.py'),
        '--projection', String(months)
    ]);

    let output = '';
    let error = '';

    pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
    });
    pythonProcess.stderr.on('data', (data) => {
        error += data.toString();
    });
    pythonProcess.on('close', (code) => {
        if (code !== 0 || !output) {
            return res.status(500).json({ error: 'LSTM analysis failed', details: error });
        }
        // Try to extract base64 image from output
        const base64Match = output.match(/[A-Za-z0-9+/=]{100,}/g);
        const base64img = base64Match ? base64Match[0] : null;
        if (!base64img) {
            return res.status(500).json({ error: 'No graph image returned', raw: output });
        }
        // Return dummy data for now for all graphs and metrics
        res.json({
            main: {
                labels: [],
                actual: [],
                predicted: [],
                img: base64img
            },
            comparison: {
                labels: [],
                lstm: [],
                gru: [],
                rnn: []
            },
            metrics: {
                accuracy: 0.95,
                mse: 0.01,
                mae: 0.02,
                r2: 0.9
            }
        });
    });
});

// Endpoint to run LSTM.py
app.post('/api/run-lstm', async (req, res) => {
    try {
        const { args } = req.body;
        if (!args || !Array.isArray(args)) {
            return res.status(400).json({ error: 'Invalid arguments provided' });
        }

        console.log('Running LSTM analysis with args:', args);
        
        const pythonProcess = spawn('python3', ['LSTM.py', ...args]);
        
        let output = '';
        let error = '';

        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
            console.log('Python stdout:', data.toString());
        });

        pythonProcess.stderr.on('data', (data) => {
            error += data.toString();
            console.error('Python stderr:', data.toString());
        });

        pythonProcess.on('close', (code) => {
            console.log('Python process exited with code:', code);
            
            if (code !== 0) {
                console.error('LSTM analysis failed:', error);
                return res.status(500).json({ 
                    error: 'Analysis failed',
                    details: error || 'Unknown error occurred'
                });
            }

            try {
                // Try to parse the output as JSON
                const result = JSON.parse(output);
                if (result.error) {
                    return res.status(500).json({ 
                        error: result.error,
                        details: result.details || 'Analysis failed'
                    });
                }
                res.json(result);
            } catch (e) {
                console.error('Error parsing Python output:', e);
                // If not JSON, treat as a message
                res.json({ message: output.trim() });
            }
        });

        pythonProcess.on('error', (err) => {
            console.error('Failed to start Python process:', err);
            res.status(500).json({ 
                error: 'Failed to start analysis',
                details: err.message
            });
        });
    } catch (error) {
        console.error('Server error in LSTM endpoint:', error);
        res.status(500).json({ 
            error: 'Server error',
            details: error.message
        });
    }
});

// Start server
const startServer = (port) => {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`Port ${port} is busy, trying ${port + 1}`);
            startServer(port + 1);
        } else {
            console.error('Server error:', err);
        }
    });
};

const PORT = process.env.PORT || 5000;
startServer(PORT); 