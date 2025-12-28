import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const auth = async (req, res, next) => {
	try {
		const token = req.header('Authorization')?.replace('Bearer ', '');

		if (!token) {
			return res.status(401).json({
				success: false,
				message: 'No authentication token provided',
			});
		}

		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		const user = await User.findOne({
			_id: decoded.id,
			isActive: true,
			isSuspended: false,
		});

		if (!user) {
			throw new Error('User not found or account is suspended');
		}

		req.token = token;
		req.user = user;
		next();
	} catch (error) {
		console.error('Auth Middleware Error:', error.message);

		if (error.name === 'JsonWebTokenError') {
			return res.status(401).json({
				success: false,
				message: 'Invalid authentication token',
			});
		}

		if (error.name === 'TokenExpiredError') {
			return res.status(401).json({
				success: false,
				message: 'Authentication token expired',
			});
		}

		res.status(401).json({
			success: false,
			message: 'Please authenticate',
			error: error.message,
		});
	}
};

export const authorize = (...roles) => {
	return (req, res, next) => {
		if (!req.user) {
			return res.status(401).json({
				success: false,
				message: 'Authentication required',
			});
		}

		if (!roles.includes(req.user.role)) {
			return res.status(403).json({
				success: false,
				message: `Access denied. Required role: ${roles.join(' or ')}`,
				userRole: req.user.role,
			});
		}
		next();
	};
};

export const isAdmin = authorize('admin');
export const isManagerOrAdmin = authorize('admin', 'manager');
