import  express from'express'
import  Payment from'../models/Payment.js'
import  Invoice from'../models/Invoice.js'
import  Customer from'../models/Customer.js'
import  {auth} from'../middlewares/auth.js'
import { getPayments, newPayment } from '../controllers/payment.js';
const  router = express.Router();

router.get('/', auth, getPayments);

router.post('/', auth, newPayment);

export default router;