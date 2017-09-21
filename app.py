from os import environ
import flask
from flask import Flask, render_template
from flask_mail import Mail
from flask_sqlalchemy import SQLAlchemy
from flask_user import login_required, UserManager, UserMixin, SQLAlchemyAdapter
#https://github.com/lingthio/Flask-User/tree/v0.6/example_apps

app = Flask(__name__)
app.config['SECRET_KEY'] = '#$(PUR)H)R(D)NBUF(B)*)H)Nd32d0he01he90hhdi'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///basic_app.sqlite'
app.config['CSRF_ENABLED'] = True
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 465
app.config['MAIL_USERNAME'] = 'epidemviz@gmail.com'
app.config['MAIL_PASSWORD'] = 'LIRMM_ROHAN'
app.config['MAIL_USE_TLS'] = False
app.config['MAIL_USE_SSL'] = True
app.config['MAIL_DEFAULT_SENDER'] =  '"Rohan Goel - EpidemViz" <epidemviz@gmail.com>'
app.config['USER_APP_NAME'] = 'EpidemViz'

# Initialize Flask extensions
db = SQLAlchemy(app)                            # Initialize Flask-SQLAlchemy
mail = Mail(app)                                # Initialize Flask-Mail

# Define the User data model. Make sure to add flask_user UserMixin !!!
class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)

    # User authentication information
    username = db.Column(db.String(50), nullable=False, unique=True)
    password = db.Column(db.String(255), nullable=False, server_default='')

    # User email information
    email = db.Column(db.String(255), nullable=False, unique=True)
    confirmed_at = db.Column(db.DateTime())

    # User information
    active = db.Column('is_active', db.Boolean(), nullable=False, server_default='0')
    first_name = db.Column(db.String(100), nullable=False, server_default='')
    last_name = db.Column(db.String(100), nullable=False, server_default='')

# Create all database tables
db.create_all()

# Setup Flask-User
db_adapter = SQLAlchemyAdapter(db, User)        # Register the User model
user_manager = UserManager(db_adapter, app)     # Initialize Flask-User


@app.route("/viz")
@login_required
def viz():
    return render_template('viz.html')


@app.route("/")
def home():
    return render_template('index.html')

if __name__ == "__main__":
    app.debug = True
    port = int(environ.get('PORT', 8000))
    app.run(host='0.0.0.0', port=port)
    app.run()
