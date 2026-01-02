import express from 'express';
import { auth, isAdmin } from '../middlewares/auth.js';
import {
	assignManager,
	getUsers,
	createUser,
	getUser,
	getUserStats,
	updateUser,
} from '../controllers/user.js';

const router = express.Router();
// Assign manager to business/outlet (Admin only)
router.post('/assign-manager', auth, isAdmin, assignManager);

// Get all users with filters (Admin only)
router.get('/', auth, isAdmin, getUsers);

// Create user (Admin only)
router.post('/', auth, isAdmin, createUser);

// get user (Admin only)
router.get('/:id', auth, isAdmin, getUser);

// Update user (Admin only)
router.patch('/:id', auth, isAdmin, updateUser);

// Get user statistics (Admin only)
router.get('/stats', auth, isAdmin, getUserStats);

export default router;
