import express from 'express';
import { auth, isAdmin } from '../middlewares/auth.js';
import {
	createCustomer,
	deleteCustomer,
	getCustomerById,
	getCustomerDebtors,
	getCustomers,
	updateCustomer,
	updateCustomerDebt,
	updateCustomerCredit,
} from '../controllers/customer.js';

const router = express.Router();

// Get all customers for an outlet
router.get('/', auth, getCustomers);

// Get customer with debt details
router.get('/debtors', auth, getCustomerDebtors);

// Create customer
router.post('/', auth, createCustomer);

// Update customer debt (when transaction is made)
router.put('/:id/debit', auth, updateCustomerDebt);
router.put('/:id/credit', auth, updateCustomerCredit);

router.get('/:id', auth, getCustomerById);

router.patch('/:id', auth, updateCustomer);

router.delete('/:id', auth, isAdmin, deleteCustomer);

export default router;