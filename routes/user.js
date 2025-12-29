import express from 'express';
import User from '../models/User.js';
import { auth, isAdmin } from '../middlewares/auth.js';
import {
	assignManager,
	getUsers,
	createUser,
	getUser,
	getUserStats,
} from '../controllers/user.js';

const router = express.Router();
// Assign manager to business/outlet (Admin only)
router.post('/assign-manager', auth, isAdmin, assignManager);

// Get all users with filters (Admin only)
router.get('/', auth, isAdmin, getUsers);

// Create user (Admin only)
router.post('/', auth, isAdmin, createUser);

// Update user (Admin only)
router.put('/:id', auth, isAdmin, getUser);

// Get user statistics (Admin only)
router.get('/stats', auth, isAdmin, getUserStats);

export default router;
