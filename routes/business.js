import express from 'express';
import { auth, isAdmin, isManagerOrAdmin } from '../middlewares/auth.js';

import {
	createBusiness,
	getBusinesses,
	getBusinessById,
	updateBusiness,
	deleteBusiness,
	getBusinessesAndOutlets,
	getAllBusinessAndOutlets
} from '../controllers/business.js';

const router = express.Router();

router.get('/outlets/all', getAllBusinessAndOutlets);

// Get all Businesss (Admin/Manager only)
router.get('/', auth, isManagerOrAdmin, getBusinesses);

router.get('/outlets', auth, isManagerOrAdmin, getBusinessesAndOutlets);

// Create Business (Admin only)
router.post('/', auth, isAdmin, createBusiness);

router.get('/:id', auth, isAdmin, getBusinessById);

router.patch('/:id', auth, isAdmin, updateBusiness);

// Delete Business (Admin only)
router.delete('/:id', auth, isAdmin, deleteBusiness);

export default router;
