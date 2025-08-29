import crypto from 'crypto';
import { getUsersCollection } from '../config/db.js';

export async function requireBearerAuth(req, res, next) {
	try {
		const header = req.headers['authorization'] || '';
		if (!header.startsWith('Bearer ')) {
			return res.status(401).json({ detail: 'Missing or invalid Authorization header' });
		}
		const token = header.slice(7);
		const users = await getUsersCollection();
		
		// First try to find user by session token
		let user = await users.findOne({ session_token: token });
		
		// Fallback: try to find user by API key (for backward compatibility)
		if (!user) {
			user = await users.findOne({ api_key: token });
		}
		
		// Final fallback for legacy single-key env (optional)
		if (!user && process.env.API_KEY && token === process.env.API_KEY) {
			req.authUser = { id: 'env_user', user_id: 'env_user', name: 'Env User' };
			return next();
		}
		
		if (!user) {
			return res.status(403).json({ detail: 'Invalid or expired session token' });
		}
		
		req.authUser = { 
			id: String(user._id), 
			user_id: user.user_id || String(user._id), 
			name: user.name || 'user',
			email: user.email
		};
		return next();
	} catch (e) {
		console.error(e);
		return res.status(500).json({ detail: 'Auth error' });
	}
}

export async function requireXApiKey(req, res, next) {
	const key = req.headers['x-api-key'];
	if (!key) {
		return res.status(401).json({ detail: 'Missing x-api-key header' });
	}
	const users = await getUsersCollection();
	
	// Try session token first, then API key
	let user = await users.findOne({ session_token: key });
	if (!user) {
		user = await users.findOne({ api_key: key });
	}
	
	if (!user && !(process.env.API_KEY && key === process.env.API_KEY)) {
		return res.status(403).json({ detail: 'Invalid token or API key' });
	}
	
	req.authUser = user ? { 
		id: String(user._id), 
		user_id: user.user_id || String(user._id), 
		name: user.name || 'user',
		email: user.email
	} : { 
		id: 'env_user', 
		user_id: 'env_user', 
		name: 'Env User' 
	};
	return next();
}

export function generateApiKey() {
	return crypto.randomBytes(24).toString('hex');
}


