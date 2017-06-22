from os import environ
from flask import Flask, render_template

app = Flask(__name__)

@app.route("/")
def index():
    """Render the home page"""
    return render_template('index.html')

if __name__ == "__main__":
    app.debug = True
    port = int(environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
    app.run()
