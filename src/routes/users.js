import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getUsersCollection } from '../config/db.js';
import { generateApiKey, requireBearerAuth } from '../middleware/auth.js';
import { createHash, randomBytes } from 'crypto';

const router = Router();

// Helper function to hash passwords
function hashPassword(password) {
    return createHash('sha256').update(password).digest('hex');
}

// Helper function to generate session token
function generateSessionToken() {
    return randomBytes(32).toString('hex');
}

// Public registration endpoint - creates user with email and password
router.post('/register', async (req, res) => {
	const { name, email, password } = req.body || {};
	try {
		if (!name || !email || !password) {
			return res.status(400).json({ detail: 'Name, email, and password are required' });
		}

		if (password.length < 6) {
			return res.status(400).json({ detail: 'Password must be at least 6 characters long' });
		}

		const users = await getUsersCollection();
		
		// Check if email already exists
		const existingUser = await users.findOne({ email: email.toLowerCase() });
		if (existingUser) {
			return res.status(409).json({ detail: 'User with this email already exists' });
		}

		// Hash password and create user
		const hashedPassword = hashPassword(password);
		const sessionToken = generateSessionToken();
		
		const userDoc = { 
			name: name.trim(), 
			email: email.toLowerCase().trim(), 
			password: hashedPassword,
			session_token: sessionToken,
			created_at: new Date(),
			updated_at: new Date()
		};
		
		const result = await users.insertOne(userDoc);
		
		// Return user info without password
		return res.json({ 
			id: String(result.insertedId), 
			name: userDoc.name, 
			email: userDoc.email,
			session_token: sessionToken,
			created_at: userDoc.created_at
		});
	} catch (e) {
		console.error(e);
		return res.status(500).json({ detail: 'Registration failed' });
	}
});

// Login endpoint - authenticates user with email and password
router.post('/login', async (req, res) => {
	const { email, password } = req.body || {};
	try {
		if (!email || !password) {
			return res.status(400).json({ detail: 'Email and password are required' });
		}

		const users = await getUsersCollection();
		
		// Find user by email
		const user = await users.findOne({ email: email.toLowerCase().trim() });
		if (!user) {
			return res.status(401).json({ detail: 'Invalid email or password' });
		}

		// Verify password
		const hashedPassword = hashPassword(password);
		if (user.password !== hashedPassword) {
			return res.status(401).json({ detail: 'Invalid email or password' });
		}

		// Generate new session token
		const sessionToken = generateSessionToken();
		await users.updateOne(
			{ _id: user._id },
			{ 
				$set: { 
					session_token: sessionToken,
					last_login: new Date(),
					updated_at: new Date()
				} 
			}
		);

		// Return user info with session token
		return res.json({
			id: String(user._id),
			name: user.name,
			email: user.email,
			session_token: sessionToken,
			last_login: new Date()
		});
	} catch (e) {
		console.error(e);
		return res.status(500).json({ detail: 'Login failed' });
	}
});

// Logout endpoint - invalidates session token
router.post('/logout', requireBearerAuth, async (req, res) => {
	try {
		const users = await getUsersCollection();
		
		// Invalidate session token
		await users.updateOne(
			{ _id: new ObjectId(req.authUser.id) },
			{ 
				$set: { 
					session_token: null,
					updated_at: new Date()
				} 
			}
		);
		
		return res.json({ message: 'Logged out successfully' });
	} catch (e) {
		console.error(e);
		return res.status(500).json({ detail: 'Logout failed' });
	}
});

// Get current user info
router.get('/me', requireBearerAuth, async (req, res) => {
	try {
		const users = await getUsersCollection();
		const user = await users.findOne({ _id: new ObjectId(req.authUser.id) });
		
		if (!user) {
			return res.status(404).json({ detail: 'User not found' });
		}

		// Return user info without sensitive data
		return res.json({
			id: String(user._id),
			name: user.name,
			email: user.email,
			created_at: user.created_at,
			last_login: user.last_login
		});
	} catch (e) {
		console.error(e);
		return res.status(500).json({ detail: 'Failed to get user info' });
	}
});

// Get current API key for user
router.get('/api-key', requireBearerAuth, async (req, res) => {
	try {
		const users = await getUsersCollection();
		const user = await users.findOne({ _id: new ObjectId(req.authUser.id) });
		
		if (!user) {
			return res.status(404).json({ detail: 'User not found' });
		}

		// Check if user has an API key, if not generate one
		if (!user.api_key) {
			const newApiKey = generateApiKey();
			await users.updateOne(
				{ _id: user._id },
				{ 
					$set: { 
						api_key: newApiKey,
						updated_at: new Date()
					} 
				}
			);
			return res.json({ api_key: newApiKey });
		}

		return res.json({ api_key: user.api_key });
	} catch (e) {
		console.error(e);
		return res.status(500).json({ detail: 'Failed to get API key' });
	}
});

// Change password endpoint
router.post('/change-password', requireBearerAuth, async (req, res) => {
	const { currentPassword, newPassword } = req.body || {};
	try {
		if (!currentPassword || !newPassword) {
			return res.status(400).json({ detail: 'Current and new password are required' });
		}

		if (newPassword.length < 6) {
			return res.status(400).json({ detail: 'New password must be at least 6 characters long' });
		}

		const users = await getUsersCollection();
		const user = await users.findOne({ _id: new ObjectId(req.authUser.id) });
		
		if (!user) {
			return res.status(404).json({ detail: 'User not found' });
		}

		// Verify current password
		const hashedCurrentPassword = hashPassword(currentPassword);
		if (user.password !== hashedCurrentPassword) {
			return res.status(401).json({ detail: 'Current password is incorrect' });
		}

		// Hash new password and update
		const hashedNewPassword = hashPassword(newPassword);
		await users.updateOne(
			{ _id: user._id },
			{ 
				$set: { 
					password: hashedNewPassword,
					updated_at: new Date()
				} 
			}
		);
		
		return res.json({ message: 'Password changed successfully' });
	} catch (e) {
		console.error(e);
		return res.status(500).json({ detail: 'Password change failed' });
	}
});

// Legacy API key rotation endpoint (kept for backward compatibility)
router.post('/rotate-key', requireBearerAuth, async (req, res) => {
	try {
		const users = await getUsersCollection();
		const newKey = generateApiKey();
		
		// Find user by session token and update
		await users.updateOne(
			{ _id: new ObjectId(req.authUser.id) }, 
			{ 
				$set: { 
					api_key: newKey, 
					updated_at: new Date() 
				} 
			}
		);
		
		return res.json({ 
			message: 'API key rotated successfully',
			new_api_key: newKey 
		});
	} catch (e) {
		console.error(e);
		return res.status(500).json({ detail: 'Key rotation failed' });
	}
});

export default router;


