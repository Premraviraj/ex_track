import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
import pandas as pd
from datetime import datetime, timedelta
import joblib
import os
import json
import sys

print(json.dumps({"debug": "sys.argv", "argv": sys.argv}))
sys.stdout.flush()

print(json.dumps({"debug": "goal_predictor.py started"}))

class GoalPredictor:
    def __init__(self):
        self.model = LinearRegression()
        self.scaler = StandardScaler()
        self.model_path = 'goal_predictor_model.joblib'
        self.scaler_path = 'goal_scaler.joblib'
        self.avg_daily_savings = 0
        self.avg_weekly_savings = 0
        
        # Load existing model if available
        if os.path.exists(self.model_path) and os.path.exists(self.scaler_path):
            self.model = joblib.load(self.model_path)
            self.scaler = joblib.load(self.scaler_path)
        else:
            # Initialize with default model if no saved model exists
            self.initialize_default_model()

    def initialize_default_model(self):
        """Initialize a default model with some basic training data"""
        # Create some synthetic training data
        X = np.array([
            [10000, 5000, 180, 50, 5000, 100, 700, 20],  # Example features
            [20000, 10000, 365, 50, 10000, 150, 1050, 30],
            [5000, 2500, 90, 50, 2500, 50, 350, 10]
        ])
        y = np.array([180, 365, 90])  # Example target values (days to complete)
        
        # Scale features
        X_scaled = self.scaler.fit_transform(X)
        
        # Train model
        self.model.fit(X_scaled, y)
        
        # Save model and scaler
        joblib.dump(self.model, self.model_path)
        joblib.dump(self.scaler, self.scaler_path)

    def prepare_features(self, goal_data, historical_data):
        """Prepare features for the model"""
        features = []
        
        # Goal features
        target_amount = goal_data['targetAmount']
        current_amount = goal_data['currentAmount']
        days_remaining = (datetime.strptime(goal_data['targetDate'], '%Y-%m-%d') - datetime.now()).days
        
        # Calculate basic metrics
        progress = (current_amount / target_amount) * 100
        amount_remaining = target_amount - current_amount
        
        # Historical savings features
        if historical_data:
            daily_savings = historical_data.get('daily_savings', [])
            weekly_savings = historical_data.get('weekly_savings', [])
            
            self.avg_daily_savings = np.mean(daily_savings) if daily_savings else 0
            self.avg_weekly_savings = np.mean(weekly_savings) if weekly_savings else 0
            savings_std = np.std(daily_savings) if daily_savings else 0
        else:
            self.avg_daily_savings = 0
            self.avg_weekly_savings = 0
            savings_std = 0
        
        # Combine features
        features = [
            target_amount,
            current_amount,
            days_remaining,
            progress,
            amount_remaining,
            self.avg_daily_savings,
            self.avg_weekly_savings,
            savings_std
        ]
        
        return np.array(features).reshape(1, -1)

    def predict(self, goal_data, historical_data):
        """Make predictions for a goal"""
        try:
            # Prepare features
            features = self.prepare_features(goal_data, historical_data)
            
            # Scale features
            scaled_features = self.scaler.transform(features)
            
            # Make predictions
            predictions = self.model.predict(scaled_features)
            
            # Calculate additional metrics
            target_amount = goal_data['targetAmount']
            current_amount = goal_data['currentAmount']
            amount_remaining = target_amount - current_amount

            # Calculate progress
            progress = (current_amount / target_amount) * 100 if target_amount else 0

            # Calculate daily and weekly savings needed
            daily_savings_needed = amount_remaining / max(1, predictions[0])
            weekly_savings_needed = daily_savings_needed * 7
            
            # Calculate success probability
            if historical_data and 'daily_savings' in historical_data:
                avg_historical_savings = np.mean(historical_data['daily_savings'])
                if daily_savings_needed == 0:
                    success_probability = 100 if avg_historical_savings > 0 else 0
                else:
                    success_probability = min(100, (avg_historical_savings / daily_savings_needed) * 100)
            else:
                success_probability = 50  # Default value if no historical data
            
            # Calculate risk level
            risk_level = 'Low'
            if success_probability < 30:
                risk_level = 'High'
            elif success_probability < 70:
                risk_level = 'Medium'
            
            # Calculate expected completion date
            expected_completion_date = (datetime.now() + timedelta(days=int(predictions[0]))).strftime('%Y-%m-%d')
            
            return {
                'expected_days': int(predictions[0]),
                'daily_savings_needed': round(daily_savings_needed, 2),
                'weekly_savings_needed': round(weekly_savings_needed, 2),
                'success_probability': round(success_probability, 2),
                'expected_completion_date': expected_completion_date,
                'risk_level': risk_level,
                'current_progress': round(progress, 2),
                'amount_remaining': round(amount_remaining, 2),
                'avg_daily_savings': round(self.avg_daily_savings, 2),
                'avg_weekly_savings': round(self.avg_weekly_savings, 2)
            }
            
        except Exception as e:
            import traceback
            print(json.dumps({
                'error': f'Error making predictions: {str(e)}',
                'traceback': traceback.format_exc()
            }))
            return None

def main():
    print(json.dumps({"debug": "main() entered", "argv": sys.argv}))
    if len(sys.argv) != 3:
        print(json.dumps({
            'error': 'Invalid number of arguments. Expected goal_data and historical_data.'
        }))
        sys.exit(1)
    
    try:
        # Parse command line arguments
        goal_data = json.loads(sys.argv[1])
        historical_data = json.loads(sys.argv[2])
        
        # Create predictor and make prediction
        predictor = GoalPredictor()
        prediction = predictor.predict(goal_data, historical_data)
        
        if prediction:
            print(json.dumps(prediction))
        else:
            print(json.dumps({
                'error': 'Failed to generate prediction'
            }))
            sys.exit(1)
            
    except json.JSONDecodeError:
        print(json.dumps({
            'error': 'Invalid JSON data provided'
        }))
        sys.exit(1)
    except Exception as e:
        import traceback
        print(json.dumps({
            'error': f'Unexpected error: {str(e)}',
            'traceback': traceback.format_exc()
        }))
        sys.exit(1)

if __name__ == "__main__":
    main() 