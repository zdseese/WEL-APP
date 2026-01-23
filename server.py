from flask import Flask, request, jsonify, session, send_from_directory
import json
import os
import hashlib
import secrets
from datetime import datetime, timedelta
import stripe

app = Flask(__name__, static_folder='.')
app.secret_key = 'scorecard-secret-key-2026-flask'

# Simple in-memory token storage (use Redis in production)
active_tokens = {}
password_reset_tokens = {}  # Store reset tokens with expiration

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
    token = request.headers.get('Authorization') or request.cookies.get('auth_token')
    print(f"Auth status check - token: {token}")
    
    if token and token in active_tokens:
        username = active_tokens[token]
        user = db['users'].get(username)
        print(f"User found: {user['username'] if user else 'None'}")
        if user:
            return jsonify({
                'loggedIn': True,
                'username': user['username'],
                'email': user['email'],
                'isAdmin': user['username'] == 'admin',
                'subscription': user.get('subscription', {
                    'plan': 'free',
                    'status': 'active',
                    'stripeCustomerId': None,
                    'stripeSubscriptionId': None,
                    'currentPeriodEnd': None
                })
            })
    print("No valid token - returning not logged in")
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
    
    # Generate a unique token
    token = secrets.token_urlsafe(32)
    active_tokens[token] = username
    
    print(f"Login successful - generated token for: {username}")
    print(f"Active tokens: {len(active_tokens)}")
    
    response = jsonify({
        'success': True,
        'username': user['username'],
        'email': user['email'],
        'isAdmin': user['username'] == 'admin',
        'token': token,
        'subscription': user.get('subscription', {
            'plan': 'free',
            'status': 'active',
            'stripeCustomerId': None,
            'stripeSubscriptionId': None,
            'currentPeriodEnd': None
        })
    })
    
    # Also set as cookie for convenience
    response.set_cookie('auth_token', token, max_age=86400, httponly=False, samesite='Lax')
    
    return response

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
    token = request.headers.get('Authorization') or request.cookies.get('auth_token')
    if token and token in active_tokens:
        del active_tokens[token]
    response = jsonify({'success': True})
    response.set_cookie('auth_token', '', expires=0)
    return response

@app.route('/api/auth/forgot-password', methods=['POST'])
def forgot_password():
    data = request.json
    email = data.get('email', '').strip().lower()
    
    if not email or '@' not in email:
        return jsonify({'success': False, 'error': 'Valid email is required'}), 400
    
    # Find user by email
    user = None
    username = None
    for uname, udata in db['users'].items():
        if udata.get('email', '').lower() == email:
            user = udata
            username = uname
            break
    
    # Always return success to prevent email enumeration
    if not user:
        print(f"Password reset requested for non-existent email: {email}")
        return jsonify({'success': True, 'message': 'If an account exists with that email, a reset link has been sent'})
    
    # Generate reset token
    reset_token = secrets.token_urlsafe(32)
    password_reset_tokens[reset_token] = {
        'username': username,
        'email': email,
        'expires': (datetime.now() + timedelta(hours=1)).isoformat()
    }
    
    # Create reset link
    reset_link = f"{APP_URL}/reset-password.html?token={reset_token}"
    
    # In production, send actual email. For now, just log it
    print(f"\n{'='*60}")
    print(f"PASSWORD RESET REQUEST")
    print(f"{'='*60}")
    print(f"Email: {email}")
    print(f"Username: {username}")
    print(f"Reset Link: {reset_link}")
    print(f"Token expires in 1 hour")
    print(f"{'='*60}\n")
    
    # TODO: Integrate with email service (SendGrid, AWS SES, etc.)
    # send_email(
    #     to=email,
    #     subject="Reset Your Password - Scorecard",
    #     body=f"Click here to reset your password: {reset_link}\n\nThis link expires in 1 hour."
    # )
    
    return jsonify({'success': True, 'message': 'Password reset link sent to your email'})

@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    data = request.json
    token = data.get('token')
    new_password = data.get('newPassword')
    
    if not token or not new_password:
        return jsonify({'success': False, 'error': 'Token and new password are required'}), 400
    
    if len(new_password) < 6:
        return jsonify({'success': False, 'error': 'Password must be at least 6 characters'}), 400
    
    # Check if token exists and is valid
    if token not in password_reset_tokens:
        return jsonify({'success': False, 'error': 'Invalid or expired reset token'}), 400
    
    token_data = password_reset_tokens[token]
    
    # Check if token has expired
    expires = datetime.fromisoformat(token_data['expires'])
    if datetime.now() > expires:
        del password_reset_tokens[token]
        return jsonify({'success': False, 'error': 'Reset token has expired'}), 400
    
    username = token_data['username']
    
    # Update user password
    if username not in db['users']:
        return jsonify({'success': False, 'error': 'User not found'}), 404
    
    db['users'][username]['password'] = hash_password(new_password)
    save_db()
    
    # Delete the used token
    del password_reset_tokens[token]
    
    print(f"Password successfully reset for user: {username}")
    
    return jsonify({'success': True, 'message': 'Password has been reset successfully'})

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
    # Check for token-based auth
    auth_header = request.headers.get('Authorization')
    token = auth_header.split(' ')[1] if auth_header and auth_header.startswith('Bearer ') else None
    
    if not token or token not in active_tokens:
        return jsonify({'error': 'Admin access required'}), 403
    
    user_id = active_tokens[token]
    if user_id != 'admin':
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

@app.route('/api/admin/users/<username>', methods=['DELETE'])
def delete_user():
    # Check for token-based auth
    auth_header = request.headers.get('Authorization')
    token = auth_header.split(' ')[1] if auth_header and auth_header.startswith('Bearer ') else None
    
    if not token or token not in active_tokens:
        return jsonify({'error': 'Admin access required'}), 403
    
    user_id = active_tokens[token]
    if user_id != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    username = request.view_args.get('username')
    
    if username == 'admin':
        return jsonify({'error': 'Cannot delete admin user'}), 400
    
    if username not in db['users']:
        return jsonify({'error': 'User not found'}), 404
    
    # Delete user and associated data
    del db['users'][username]
    
    # Delete user's scorecard if exists
    if 'scorecards' in db and username in db['scorecards']:
        del db['scorecards'][username]
    
    # Delete user's posts if exists
    if 'posts' in db:
        db['posts'] = [p for p in db['posts'] if p.get('author') != username]
    
    save_db()
    
    return jsonify({'success': True})

@app.route('/api/admin/users/<username>/reset-password', methods=['POST'])
def admin_reset_password():
    # Check for token-based auth
    auth_header = request.headers.get('Authorization')
    token = auth_header.split(' ')[1] if auth_header and auth_header.startswith('Bearer ') else None
    
    if not token or token not in active_tokens:
        return jsonify({'error': 'Admin access required'}), 403
    
    user_id = active_tokens[token]
    if user_id != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    username = request.view_args.get('username')
    data = request.json
    new_password = data.get('newPassword')
    
    if not new_password or len(new_password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    
    if username not in db['users']:
        return jsonify({'error': 'User not found'}), 404
    
    db['users'][username]['password'] = hash_password(new_password)
    save_db()
    
    return jsonify({'success': True})

@app.route('/api/admin/users/<username>/scorecard', methods=['GET'])
def get_user_scorecard():
    # Check for token-based auth
    auth_header = request.headers.get('Authorization')
    token = auth_header.split(' ')[1] if auth_header and auth_header.startswith('Bearer ') else None
    
    if not token or token not in active_tokens:
        return jsonify({'error': 'Admin access required'}), 403
    
    user_id = active_tokens[token]
    if user_id != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    username = request.view_args.get('username')
    scorecard = db.get('scorecards', {}).get(username, {})
    
    return jsonify(scorecard)

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
    port = int(os.environ.get('PORT', 8000))
    print('\n🚀 Server running at http://localhost:{}'.format(port))
    print('📁 Serving files from:', os.getcwd())
    print('\nDefault admin credentials:')
    print('  Username: admin')
    print('  Password: scorecard2026\n')
    app.run(host='0.0.0.0', port=port, debug=False)
