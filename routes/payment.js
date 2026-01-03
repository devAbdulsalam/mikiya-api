import  express from'express'
import  {auth} from'../middlewares/auth.js'
import { upload } from '../middlewares/upload.js';
import {
	getPayments,
	newPayment,
	updatePayment,
	getPaymentById,
	deletePayment,
} from '../controllers/payment.js';
const  router = express.Router();

router.get('/', auth, getPayments);
router.get('/:id', auth, getPaymentById);

router.post('/', auth, upload.single('image'), newPayment);
router.patch('/:id', auth, upload.single('image'), updatePayment);
router.delete('/:id', auth, deletePayment);

export default router;