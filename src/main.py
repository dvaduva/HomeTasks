from flask import Flask
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')

@app.route('/')
def hello():
    return 'Hello, HomeTasks!'

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)