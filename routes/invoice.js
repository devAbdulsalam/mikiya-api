import express from 'express';
import { upload } from '../middlewares/upload.js';
import { auth, isAdmin, isManagerOrAdmin } from '../middlewares/auth.js';
import {
	getInvoiceById,
	newInvoice,
	getAllInvoices,
	updateInvoice,
	deleteInvoice,
	updateInvoiceStatus,
} from '../controllers/invoice.js';
const router = express.Router();

router.get('/', auth, getAllInvoices);

router.post('/', auth, isManagerOrAdmin, upload.single('image'), newInvoice);
router.get('/:id', auth, getInvoiceById);
router.put('/:id', auth, upload.single('image'), updateInvoice);
router.patch('/:id/status', auth, updateInvoiceStatus);
router.delete('/:id', auth, isAdmin, deleteInvoice);

// ... other routes for getting, updating, deleting invoices

export default router;
