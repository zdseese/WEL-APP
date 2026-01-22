from flask import Flask, request, jsonify, session, send_from_directory
import json
import os
import hashlib
from datetime import datetime, timedelta
import stripe

app = Flask(__name__, static_folder='.')
app.secret_key = 'scorecard-secret-key-2026-flask'
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=1)

# Stripe Configuration
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', 'sk_test_YOUR_SECRET_KEY_HERE')
STRIPE_PUBLISHABLE_KEY = os.environ.get('STRIPE_PUBLISHABLE_KEY', 'pk_test_YOUR_PUBLISHABLE_KEY_HERE')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', 'whsec_YOUR_WEBHOOK_SECRET_HERE')
APP_URL = os.environ.get('APP_URL', 'http://localhost:8000')

stripe.api_key = STRIPE_SECRET_KEY

# Subscription Plans
SUBSCRIPTION_PLANS = {
    'free': {
        'name': 'Free',
        'price': 0,
        'priceId': None,
        'features': [
            'Basic progress tracking',
            'Limited to 3 goals',
            'Community support'
        ],
        'limits': {
            'maxGoals': 3,
            'maxProjects': 1
        }
    },
    'basic': {
        'name': 'Basic',
        'price': 9.99,
        'priceId': os.environ.get('STRIPE_BASIC_PRICE_ID', 'price_YOUR_BASIC_PRICE_ID'),
        'interval': 'month',
        'features': [
            'Unlimited goals',
            'Up to 10 projects',
            'Priority email support',
            'Advanced analytics',
            'Export data'
        ],
        'limits': {
            'maxGoals': -1,
            'maxProjects': 10
        }
    },
    'pro': {
        'name': 'Pro',
        'price': 29.99,
        'priceId': os.environ.get('STRIPE_PRO_PRICE_ID', 'price_YOUR_PRO_PRICE_ID'),
        'interval': 'month',
        'features': [
            'Everything in Basic',
            'Unlimited projects',
            'Team collaboration (up to 5 members)',
            'Priority chat support',
            'Custom integrations',
            'Advanced reporting'
        ],
        'limits': {
            'maxGoals': -1,
            'maxProjects': -1,
            'teamMembers': 5
        }
    }
}

DB_FILE = 'database.json'

def hash_password(password):
    """Simple password hashing using SHA256"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password, hashed):
    """Verify password against hash"""
    return hash_password(password) == hashed

def init_db():
    if not os.path.exists(DB_FILE):
        initial_data = {
            'users': {
                'admin': {
                    'username': 'admin',
                    'password': hash_password('scorecard2026'),
                    'email': 'admin@scorecard.com',
                    'createdAt': datetime.now().isoformat(),
                    'subscription': {
                        'plan': 'free',
                        'status': 'active',
                        'stripeCustomerId': None,
                        'stripeSubscriptionId': None
                    }
                }
            },
            'profiles': {},
            'scorecards': {},
            'discussions': {},
            'calendar': {},
            'messages': {}
        }
        with open(DB_FILE, 'w') as f:
            json.dump(initial_data, f, indent=2)
    
    with open(DB_FILE, 'r') as f:
        return json.load(f)

def save_db(data):
    with open(DB_FILE, 'w') as f:
        json.dump(data, f, indent=2)

# Initialize database
db = init_db()

# Serve static files
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)

# API Routes

@app.route('/api/auth/status', methods=['GET'])
def auth_status():
    if 'user_id' in session:
        user = db['users'].get(session['user_id'])
        if user:
            return jsonify({
                'loggedIn': True,
                'username': user['username'],
                'email': user['email'],
                'isAdmin': user['username'] == 'admin'
            })
    return jsonify({'loggedIn': False})

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    user = db['users'].get(username)
    if not user:
        return jsonify({'success': False, 'error': 'Invalid username or password'}), 401
    
    if not verify_password(password, user['password']):
        return jsonify({'success': False, 'error': 'Invalid username or password'}), 401
    
    session['user_id'] = username
    session.permanent = True
    
    return jsonify({
        'success': True,
        'username': user['username'],
        'email': user['email'],
        'isAdmin': user['username'] == 'admin'
    })

@app.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '')
    email = data.get('email', '').strip()
    
    # Validation
    if not username or len(username) < 3:
        return jsonify({'success': False, 'error': 'Username must be at least 3 characters'}), 400
    if not password or len(password) < 6:
        return jsonify({'success': False, 'error': 'Password must be at least 6 characters'}), 400
    if not email or '@' not in email:
        return jsonify({'success': False, 'error': 'Valid email is required'}), 400
    
    # Check if user exists
    if username in db['users']:
        return jsonify({'success': False, 'error': 'Username already exists'}), 400
    
    # Check if email exists
    if any(u['email'] == email for u in db['users'].values()):
        return jsonify({'success': False, 'error': 'Email already registered'}), 400
    
    # Create user
    db['users'][username] = {
        'username': username,
        'password': hash_password(password),
        'email': email,
        'createdAt': datetime.now().isoformat(),
        'subscription': {
            'plan': 'free',
            'status': 'active',
            'stripeCustomerId': None,
            'stripeSubscriptionId': None
        }
    }
    
    save_db(db)
    return jsonify({'success': True})

@app.route('/api/auth/update-details', methods=['POST'])
def update_details():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Not authenticated'}), 401
    
    data = request.json
    username = session['user_id']
    user = db['users'].get(username)
    
    if not user:
        return jsonify({'success': False, 'error': 'User not found'}), 404
    
    user['organization'] = data.get('organization')
    user['jobTitle'] = data.get('jobTitle')
    user['phone'] = data.get('phone')
    user['hearAboutUs'] = data.get('hearAboutUs')
    user['profileCompleted'] = True
    
    save_db(db)
    return jsonify({'success': True})

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/profile', methods=['GET'])
def get_profile():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    profile = db['profiles'].get(session['user_id'], {
        'displayName': '',
        'bio': '',
        'picture': None
    })
    return jsonify(profile)

@app.route('/api/profile', methods=['POST'])
def update_profile():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Not authenticated'}), 401
    
    data = request.json
    db['profiles'][session['user_id']] = {
        'displayName': data.get('displayName', ''),
        'bio': data.get('bio', ''),
        'picture': data.get('picture')
    }
    
    save_db(db)
    return jsonify({'success': True})

@app.route('/api/account', methods=['DELETE'])
def delete_account():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Not authenticated'}), 401
    
    username = session['user_id']
    
    if username in db['users']:
        del db['users'][username]
    if username in db['profiles']:
        del db['profiles'][username]
    
    save_db(db)
    session.clear()
    
    return jsonify({'success': True})

@app.route('/api/admin/users', methods=['GET'])
def get_all_users():
    if 'user_id' not in session or session['user_id'] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    users = [
        {
            'username': u['username'],
            'email': u['email'],
            'organization': u.get('organization'),
            'jobTitle': u.get('jobTitle'),
            'phone': u.get('phone'),
            'hearAboutUs': u.get('hearAboutUs'),
            'createdAt': u.get('createdAt'),
            'subscription': u.get('subscription', {
                'plan': 'free',
                'status': 'active',
                'stripeCustomerId': None,
                'stripeSubscriptionId': None
            })
        }
        for u in db['users'].values()
    ]
    
    return jsonify(users)

# Scorecard/Metrics API
@app.route('/api/scorecard', methods=['GET'])
def get_scorecard():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    username = session['user_id']
    scorecard = db.get('scorecards', {}).get(username, {})
    return jsonify(scorecard)

@app.route('/api/scorecard', methods=['POST'])
def save_scorecard():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Not authenticated'}), 401
    
    username = session['user_id']
    data = request.json
    
    if 'scorecards' not in db:
        db['scorecards'] = {}
    
    db['scorecards'][username] = data
    save_db(db)
    
    return jsonify({'success': True})

# Discussions API
@app.route('/api/discussions', methods=['GET'])
def get_discussions():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    discussions = db.get('discussions', {})
    return jsonify(discussions)

@app.route('/api/discussions', methods=['POST'])
def save_discussions():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Not authenticated'}), 401
    
    data = request.json
    
    if 'discussions' not in db:
        db['discussions'] = {}
    
    db['discussions'] = data
    save_db(db)
    
    return jsonify({'success': True})

# Calendar API
@app.route('/api/calendar', methods=['GET'])
def get_calendar():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    username = session['user_id']
    calendar = db.get('calendar', {}).get(username, {})
    return jsonify(calendar)

@app.route('/api/calendar', methods=['POST'])
def save_calendar():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Not authenticated'}), 401
    
    username = session['user_id']
    data = request.json
    
    if 'calendar' not in db:
        db['calendar'] = {}
    
    db['calendar'][username] = data
    save_db(db)
    
    return jsonify({'success': True})

# Messages API
@app.route('/api/messages', methods=['GET'])
def get_messages():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    messages = db.get('messages', {})
    return jsonify(messages)

@app.route('/api/messages', methods=['POST'])
def save_messages():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Not authenticated'}), 401
    
    data = request.json
    
    if 'messages' not in db:
        db['messages'] = {}
# Stripe API Routes

@app.route('/api/stripe/config', methods=['GET'])
def stripe_config():
    return jsonify({
        'publishableKey': STRIPE_PUBLISHABLE_KEY
    })

@app.route('/api/stripe/plans', methods=['GET'])
def get_plans():
    return jsonify(SUBSCRIPTION_PLANS)

@app.route('/api/subscription/status', methods=['GET'])
def subscription_status():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    username = session['user_id']
    user = db['users'].get(username)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    subscription = user.get('subscription', {
        'plan': 'free',
        'status': 'active',
        'stripeCustomerId': None,
        'stripeSubscriptionId': None
    })
    
    return jsonify(subscription)

@app.route('/api/stripe/create-checkout-session', methods=['POST'])
def create_checkout_session():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    data = request.json
    plan_id = data.get('planId')
    
    if plan_id not in SUBSCRIPTION_PLANS or plan_id == 'free':
        return jsonify({'error': 'Invalid plan'}), 400
    
    plan = SUBSCRIPTION_PLANS[plan_id]
    price_id = plan['priceId']
    
    if not price_id or price_id.startswith('price_YOUR'):
        return jsonify({'error': 'Stripe not configured. Please add your price IDs.'}), 400
    
    username = session['user_id']
    user = db['users'].get(username)
    
    try:
        # Create or retrieve Stripe customer
        customer_id = user.get('subscription', {}).get('stripeCustomerId')
        
        if not customer_id:
            customer = stripe.Customer.create(
                email=user['email'],
                metadata={'username': username}
            )
            customer_id = customer.id
            
            if 'subscription' not in user:
                user['subscription'] = {}
            user['subscription']['stripeCustomerId'] = customer_id
            save_db(db)
        
        # Create checkout session
        checkout_session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=['card'],
            line_items=[{
                'price': price_id,
                'quantity': 1,
            }],
            mode='subscription',
            success_url=f'{APP_URL}/dashboard.html?session_id={{CHECKOUT_SESSION_ID}}&success=true',
            cancel_url=f'{APP_URL}/subscribe.html?canceled=true',
            metadata={'username': username, 'plan': plan_id}
        )
        
        return jsonify({'url': checkout_session.url})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/stripe/create-portal-session', methods=['POST'])
def create_portal_session():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    username = session['user_id']
    user = db['users'].get(username)
    customer_id = user.get('subscription', {}).get('stripeCustomerId')
    
    if not customer_id:
        return jsonify({'error': 'No subscription found'}), 404
    
    try:
        portal_session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f'{APP_URL}/dashboard.html'
        )
        
        return jsonify({'url': portal_session.url})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/stripe/webhook', methods=['POST'])
def stripe_webhook():
    payload = request.data
    sig_header = request.headers.get('Stripe-Signature')
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        return jsonify({'error': 'Invalid payload'}), 400
    except stripe.error.SignatureVerificationError:
        return jsonify({'error': 'Invalid signature'}), 400
    
    # Handle the event
    if event['type'] == 'checkout.session.completed':
        session_obj = event['data']['object']
        username = session_obj['metadata'].get('username')
        plan = session_obj['metadata'].get('plan')
        
        if username and plan and username in db['users']:
            user = db['users'][username]
            if 'subscription' not in user:
                user['subscription'] = {}
            
            user['subscription']['plan'] = plan
            user['subscription']['status'] = 'active'
            user['subscription']['stripeSubscriptionId'] = session_obj.get('subscription')
            save_db(db)
    
    elif event['type'] == 'customer.subscription.updated':
        subscription = event['data']['object']
        customer_id = subscription['customer']
        
        # Find user by customer ID
        for username, user in db['users'].items():
            if user.get('subscription', {}).get('stripeCustomerId') == customer_id:
                user['subscription']['status'] = subscription['status']
                save_db(db)
                break
    
    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        customer_id = subscription['customer']
        
        # Find user and downgrade to free
        for username, user in db['users'].items():
            if user.get('subscription', {}).get('stripeCustomerId') == customer_id:
                user['subscription']['plan'] = 'free'
                user['subscription']['status'] = 'canceled'
                user['subscription']['stripeSubscriptionId'] = None
                save_db(db)
                break
    
    return jsonify({'success': True})

    
    db['messages'] = data
    save_db(db)
    
    return jsonify({'success': True})

if __name__ == '__main__':
    print('\n🚀 Server running at http://localhost:8000')
    print('📁 Serving files from:', os.getcwd())
    print('\nDefault admin credentials:')
    print('  Username: admin')
    print('  Password: scorecard2026\n')
    app.run(host='0.0.0.0', port=8000, debug=True)
