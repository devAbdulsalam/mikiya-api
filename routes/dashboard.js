import express from 'express';
import { auth } from '../middlewares/auth.js';
import {
	getBusinessDashboard,
	getDebtStats,
} from '../controllers/dashboard.js';

const router = express.Router();

router.get('/business/:id', auth, getBusinessDashboard);
router.get('/debt-stats/:id', auth, getDebtStats);

export default router;
