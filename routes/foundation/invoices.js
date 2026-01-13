import express from 'express';

import {
	createInvoice,
	getInvoices,
	getInvoiceById,
	updateInvoice,
	deleteInvoice,
} from '../../controllers/foundationInvoice.js';
import { auth, authorize } from '../../middlewares/auth.js';

const router = express.Router();

router.post('/', auth, createInvoice);
router.get('/', auth, getInvoices);
router.get('/:id', auth, getInvoiceById);
router.put('/:id', auth, updateInvoice);
router.delete('/:id', auth, deleteInvoice);

export default router;
