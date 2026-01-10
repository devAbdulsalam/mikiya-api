import express from 'express';
import { auth } from '../../middlewares/auth.js';
import {
	cashFlow,
	fundSummary,
	monthlyFinance,
	projectBudgetHealth,
	expenseByCategory,
	topDonors,
} from '../../controllers/dashboard.js';

const router = express.Router();
router.get('/cash-flow', cashFlow);
router.get('/fund-summary', fundSummary);
router.get('/monthly-finance', monthlyFinance);
router.get('/project-budget', projectBudgetHealth);
router.get('/expense-category', expenseByCategory);
router.get('/top-donors', topDonors);

export default router;
