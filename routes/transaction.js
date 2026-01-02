import express from 'express';
import { auth } from '../middlewares/auth.js';
import {
	getTransaction,
	createTransaction,
} from '../controllers/transaction.js';

const router = express.Router();

// Create transaction (sale)
router.post('/', auth, createTransaction );

// Get all transactions
router.get('/', auth, getTransaction);

export default router;
