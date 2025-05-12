const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/expense-tracker', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB successfully');
}).catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit if cannot connect to database
});

// Routes
app.get('/api/transactions', async (req, res) => {
    try {
        console.log('Fetching transactions...');
        const upiTransactions = await mongoose.connection.db.collection('upi_transactions').find({}).toArray();
        const cashTransactions = await mongoose.connection.db.collection('cash_transactions').find({}).toArray();
        const dailySavings = await mongoose.connection.db.collection('daily_savings').find({}).toArray();
        
        console.log(`Found ${upiTransactions.length} UPI transactions`);
        console.log(`Found ${cashTransactions.length} cash transactions`);
        console.log(`Found ${dailySavings.length} daily savings records`);
        
        res.json({
            upiTransactions,
            cashTransactions,
            dailySavings
        });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: error.message });
    }
});

// New LSTM prediction endpoints
app.get('/api/lstm/predictions', (req, res) => {
    const pythonProcess = spawn('python3', ['LSTM.py', '--all-predictions']);
    
    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
    });

    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`Python process exited with code ${code}`);
            console.error(errorData);
            res.status(500).json({ error: 'Failed to generate predictions' });
            return;
        }
        res.json({ predictions: outputData });
    });
});

app.get('/api/lstm/savings-projection', (req, res) => {
    const months = req.query.months || 3;
    const pythonProcess = spawn('python3', ['LSTM.py', '--projection', months]);
    
    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
    });

    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`Python process exited with code ${code}`);
            console.error(errorData);
            res.status(500).json({ error: 'Failed to generate savings projection' });
            return;
        }
        res.json({ projection: outputData });
    });
});

app.get('/api/lstm/next-month-savings', (req, res) => {
    const pythonProcess = spawn('python3', ['LSTM.py', '--next-month']);
    
    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
    });

    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`Python process exited with code ${code}`);
            console.error(errorData);
            res.status(500).json({ error: 'Failed to predict next month savings' });
            return;
        }
        res.json({ prediction: outputData });
    });
});

app.get('/api/lstm/next-week-savings', (req, res) => {
    const pythonProcess = spawn('python3', ['LSTM.py', '--next-week']);
    
    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
    });

    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`Python process exited with code ${code}`);
            console.error(errorData);
            res.status(500).json({ error: 'Failed to predict next week savings' });
            return;
        }
        res.json({ prediction: outputData });
    });
});

app.get('/api/lstm/expenses', (req, res) => {
    const period = req.query.period || 'weekly';
    const pythonProcess = spawn('python3', ['LSTM.py', '--expenses', period]);
    
    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
    });

    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`Python process exited with code ${code}`);
            console.error(errorData);
            res.status(500).json({ error: 'Failed to generate expenses data' });
            return;
        }
        res.json({ expenses: outputData });
    });
});

app.get('/api/lstm/savings', (req, res) => {
    const period = req.query.period || 'weekly';
    const pythonProcess = spawn('python3', ['LSTM.py', '--savings', period]);
    
    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
    });

    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`Python process exited with code ${code}`);
            console.error(errorData);
            res.status(500).json({ error: 'Failed to generate savings data' });
            return;
        }
        res.json({ savings: outputData });
    });
});

app.get('/api/lstm/category-budget', (req, res) => {
    const pythonProcess = spawn('python3', ['LSTM.py', '--category-budget']);
    
    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
    });

    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`Python process exited with code ${code}`);
            console.error(errorData);
            res.status(500).json({ error: 'Failed to generate category budget' });
            return;
        }
        res.json({ budget: outputData });
    });
});

// Serve the main page
app.get('/', (req, res) => {
    console.log('Serving index.html');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Please open your browser and navigate to: http://localhost:${PORT}`);
}); 