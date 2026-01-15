import express from 'express';
import { auth, isAdmin } from '../middlewares/auth.js';
import {
	getBusinessDashboard,
	getDebtStats,
	getDashboardData,
	dashboardStats,
} from '../controllers/dashboard.js';

const router = express.Router();

router.get('/super-admin', auth, isAdmin, getDashboardData);
router.get('/business/:id', auth, getBusinessDashboard);
router.get('/debt-stats', auth, getDebtStats);
router.get('/stats', auth, dashboardStats);

export default router;
