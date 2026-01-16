import express from 'express';
import {
	createWaybill,
	getWaybills,
	getWaybillById,
	updateWaybill,
	deleteWaybill,
} from '../controllers/waybill.js';
import { auth } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', auth, createWaybill);
router.get('/', auth, getWaybills);
router.get('/:id', auth, getWaybillById);
router.put('/:id', auth, updateWaybill);
router.delete('/:id', auth, deleteWaybill);

export default router;
