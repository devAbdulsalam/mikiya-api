import Payment from "../models/Payment";

export const getPayments = async (req, res) => {
    try {
        const payments = await Payment.find()
            .populate('invoiceId')
            .populate('customerId');
        res.json(payments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
export const newPayment = async (req, res) => {
	try {
		const { invoiceId, customerId, amount, method, reference } = req.body;

		const customer = await Customer.findById(customerId);
		if (!customer) {
			return res.status(404).json({ error: 'Customer not found' });
		}

		const payment = new Payment({
			receipt,
			invoiceId,
			customerId,
			amount,
			method,
			reference,
			createdBy: req.user.userId,
		});

		await payment.save();

		// Update customer's currentDebt
		customer.currentDebt -= amount;
		if (customer.currentDebt < 0) customer.currentDebt = 0;
		await customer.save();

		// If the payment is linked to an invoice, update the invoice
		if (invoiceId) {
			const invoice = await Invoice.findById(invoiceId);
			if (invoice) {
				invoice.amountPaid += amount;
				invoice.balance = invoice.total - invoice.amountPaid;
				if (invoice.balance <= 0) {
					invoice.status = 'paid';
				} else if (invoice.amountPaid > 0) {
					invoice.status = 'partial';
				}
				await invoice.save();
			}
		}

		res.status(201).json(payment);
	} catch (error) {
		res.status(400).json({ error: error.message });
	}
}