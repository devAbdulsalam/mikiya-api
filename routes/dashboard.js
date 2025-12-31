import express from 'express';
import { auth } from '../middlewares/auth.js';
import {
	getMikiyaPlasticDashboard,
	getDebtStats,
} from '../controllers/dashboard.js';

const router = express.Router();

router.get('/mikiya-plastic', getMikiyaPlasticDashboard);
router.get('/debt-stats', getDebtStats);

export default router;
