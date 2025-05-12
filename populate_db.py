from pymongo import MongoClient
from datetime import datetime, timedelta
import random

def connect_to_db():
    client = MongoClient('mongodb://localhost:27017/')
    db = client['expense-tracker']
    return db

def generate_sample_data():
    # Categories for expenses
    categories = ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Healthcare']
    
    # Generate dates for the last 3 months
    end_date = datetime.now()
    start_date = end_date - timedelta(days=90)
    dates = [start_date + timedelta(days=x) for x in range((end_date - start_date).days + 1)]
    
    # Generate UPI transactions
    upi_transactions = []
    for date in dates:
        # Generate 0-3 transactions per day
        num_transactions = random.randint(0, 3)
        for _ in range(num_transactions):
            transaction = {
                'date': date,
                'amount': round(random.uniform(100, 5000), 2),
                'description': f'UPI Payment {random.randint(1000, 9999)}',
                'category': random.choice(categories),
                'merchant': f'Merchant {random.randint(1, 20)}'
            }
            upi_transactions.append(transaction)
    
    # Generate cash transactions
    cash_transactions = []
    for date in dates:
        # Generate 0-2 transactions per day
        num_transactions = random.randint(0, 2)
        for _ in range(num_transactions):
            transaction = {
                'date': date,
                'amount': round(random.uniform(50, 2000), 2),
                'description': f'Cash Payment {random.randint(1000, 9999)}',
                'category': random.choice(categories),
                'location': f'Location {random.randint(1, 15)}'
            }
            cash_transactions.append(transaction)
    
    # Generate daily savings
    daily_savings = []
    for date in dates:
        # Generate savings between 100 and 2000
        savings = {
            'date': date,
            'amount': round(random.uniform(100, 2000), 2),
            'description': f'Daily Savings {date.strftime("%Y-%m-%d")}'
        }
        daily_savings.append(savings)
    
    return upi_transactions, cash_transactions, daily_savings

def populate_database():
    try:
        # Connect to database
        db = connect_to_db()
        
        # Generate sample data
        upi_transactions, cash_transactions, daily_savings = generate_sample_data()
        
        # Clear existing collections
        db.upi_transactions.delete_many({})
        db.cash_transactions.delete_many({})
        db.daily_savings.delete_many({})
        
        # Insert new data
        if upi_transactions:
            db.upi_transactions.insert_many(upi_transactions)
        if cash_transactions:
            db.cash_transactions.insert_many(cash_transactions)
        if daily_savings:
            db.daily_savings.insert_many(daily_savings)
        
        print("Database populated successfully!")
        print(f"Inserted {len(upi_transactions)} UPI transactions")
        print(f"Inserted {len(cash_transactions)} cash transactions")
        print(f"Inserted {len(daily_savings)} daily savings records")
        
    except Exception as e:
        print(f"Error populating database: {str(e)}")

if __name__ == "__main__":
    populate_database() 