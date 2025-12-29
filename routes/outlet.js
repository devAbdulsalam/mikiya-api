import express from 'express';
import Outlet from '../models/Outlet.js';
import Transaction from '../models/Transaction.js';
import { auth, isAdmin, isManagerOrAdmin } from '../middlewares/auth.js';
import { generateOutletId } from '../utils/generateId.js';

import {
	createOutlet,
	getOutlets,
	getOutletById,
	deleteOutlet,
	updateOutlet
} from '../controllers/outlet.js';


const router = express.Router();

// Get all outlets (Admin/Manager only)
router.get('/', auth, isManagerOrAdmin, getOutlets);

// Create outlet (Admin only)
router.post('/', auth, isAdmin, createOutlet);

router.get('/:id', auth, getOutletById);

router.patch('/:id', auth, updateOutlet);

// Delete outlet (Admin only)
router.delete('/:id', auth, isAdmin, deleteOutlet);



export default router;
