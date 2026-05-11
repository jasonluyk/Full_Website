import pymongo, os
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime

load_dotenv(Path(__file__).parent / '.env')
client = pymongo.MongoClient(os.environ.get('MONGO_URI'))
db = client['softball_db']

tournament_count = db['tournament_data'].count_documents({})
db['tournament_data'].delete_many({})
db['active_tournament'].delete_many({})
print(f"{datetime.now()} - Cleared {tournament_count} division records from softball_db")