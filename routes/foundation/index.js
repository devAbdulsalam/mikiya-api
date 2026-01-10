import express from 'express';
// import fundsRouter from './funds.js';
import donationsRouter from './donations.js';
// import grantsRouter from './grants.js';
import invoicesRouter from './invoices.js';
import expensesRouter from './expenses.js';
import projectsRouter from './projects.js';
// import beneficiariesRouter from './beneficiaries.js';

const router = express.Router();

// Mount all foundation routes
// router.use('/funds', fundsRouter);
router.use('/donations', donationsRouter);
// router.use('/grants', grantsRouter);
router.use('/invoices', invoicesRouter);
router.use('/expenses', expensesRouter);
router.use('/projects', projectsRouter);
// router.use('/beneficiaries', beneficiariesRouter);

export default router;
