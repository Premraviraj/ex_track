from flask import Flask, jsonify, request
from flask_cors import CORS
from LSTM import FinancialAnalyzer
import json
import logging
import traceback

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
analyzer = FinancialAnalyzer()

@app.route('/api/lstm/expenses')
def get_expenses():
    try:
        period = request.args.get('period', 'weekly')
        logger.debug(f"Received request for {period} expenses")
        
        # Get the data
        expenses, _ = analyzer.get_processed_data()
        if expenses is None:
            logger.error("No expenses data available")
            return jsonify({'error': 'No expenses data available'}), 404
            
        logger.debug(f"Retrieved expenses data: {len(expenses) if expenses is not None else 0} records")
        
        # Generate the graph
        graph_data = analyzer.plot_expenses(expenses, 'W' if period == 'weekly' else 'ME')
        if not graph_data:
            logger.error("Failed to generate graph data")
            return jsonify({'error': 'Failed to generate graph data'}), 500
            
        logger.debug(f"Generated graph data length: {len(graph_data)}")
        return jsonify({'graph': graph_data})
        
    except Exception as e:
        logger.error(f"Error in get_expenses: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/lstm/savings')
def get_savings():
    try:
        period = request.args.get('period', 'weekly')
        logger.debug(f"Received request for {period} savings")
        
        # Get the data
        _, savings = analyzer.get_processed_data()
        if savings is None:
            logger.error("No savings data available")
            return jsonify({'error': 'No savings data available'}), 404
            
        logger.debug(f"Retrieved savings data: {len(savings) if savings is not None else 0} records")
        
        # Generate the graph
        graph_data = analyzer.plot_savings(savings, 'W' if period == 'weekly' else 'ME')
        if not graph_data:
            logger.error("Failed to generate graph data")
            return jsonify({'error': 'Failed to generate graph data'}), 500
            
        logger.debug(f"Generated graph data length: {len(graph_data)}")
        return jsonify({'graph': graph_data})
        
    except Exception as e:
        logger.error(f"Error in get_savings: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/lstm/savings-projection')
def get_savings_projection():
    try:
        months = int(request.args.get('months', 3))
        logger.debug(f"Received request for {months} months savings projection")
        
        # Get the data
        _, savings = analyzer.get_processed_data()
        if savings is None:
            logger.error("No savings data available")
            return jsonify({'error': 'No savings data available'}), 404
            
        logger.debug(f"Retrieved savings data: {len(savings) if savings is not None else 0} records")
        
        # Generate the graph
        graph_data = analyzer.plot_savings_projection(savings, months)
        if not graph_data:
            logger.error("Failed to generate graph data")
            return jsonify({'error': 'Failed to generate graph data'}), 500
            
        logger.debug(f"Generated graph data length: {len(graph_data)}")
        return jsonify({'graph': graph_data})
        
    except Exception as e:
        logger.error(f"Error in get_savings_projection: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/lstm/next-month-savings')
def get_next_month_savings():
    try:
        logger.debug("Received request for next month savings prediction")
        
        # Get the data
        _, savings = analyzer.get_processed_data()
        if savings is None:
            logger.error("No savings data available")
            return jsonify({'error': 'No savings data available'}), 404
            
        logger.debug(f"Retrieved savings data: {len(savings) if savings is not None else 0} records")
        
        # Calculate next month savings
        monthly_savings = savings.resample('ME').sum()
        if len(monthly_savings) < 2:
            logger.error("Not enough data for prediction")
            return jsonify({'error': 'Not enough data for prediction'}), 400
            
        avg_saving = monthly_savings.mean()
        prediction = f"By the next month, you can save: ₹{avg_saving:,.2f}"
        
        logger.debug(f"Generated prediction: {prediction}")
        return jsonify({'prediction': prediction})
        
    except Exception as e:
        logger.error(f"Error in get_next_month_savings: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/lstm/next-week-savings')
def get_next_week_savings():
    try:
        logger.debug("Received request for next week savings prediction")
        
        # Get the data
        _, savings = analyzer.get_processed_data()
        if savings is None:
            logger.error("No savings data available")
            return jsonify({'error': 'No savings data available'}), 404
            
        logger.debug(f"Retrieved savings data: {len(savings) if savings is not None else 0} records")
        
        # Calculate next week savings
        weekly_savings = savings.resample('W').sum()
        if len(weekly_savings) < 2:
            logger.error("Not enough data for prediction")
            return jsonify({'error': 'Not enough data for prediction'}), 400
            
        avg_weekly_saving = weekly_savings.mean()
        prediction = f"By the next week, you can save: ₹{avg_weekly_saving:,.2f}"
        
        logger.debug(f"Generated prediction: {prediction}")
        return jsonify({'prediction': prediction})
        
    except Exception as e:
        logger.error(f"Error in get_next_week_savings: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000) 