import express from 'express';
import { upload } from '../middlewares/upload.js';
import { auth } from '../middlewares/auth.js';
import {
	getInvoiceById,
	newInvoice,
	getAllInvoices,
	updateInvoice,
	deleteInvoice,
} from '../controllers/invoice.js';
const router = express.Router();

router.get('/', auth, getAllInvoices);

router.post('/', auth, upload.single('image'), newInvoice);
router.get('/:id', auth, getInvoiceById);
router.put('/:id', auth, upload.single('image'), updateInvoice);
router.delete('/:id', auth, deleteInvoice);

// ... other routes for getting, updating, deleting invoices

export default router;
