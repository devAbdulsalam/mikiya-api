import Invoice from '../models/FoundationInvoice.js';

export const createInvoice = async (req, res) => {
	const invoice = await Invoice.create(req.body);
	res.status(201).json(invoice);
};

export const getInvoices = async (req, res) => {
	const { foundationId } = req.query;
	const invoices = await Invoice.find({ foundationId });
	res.json(invoices);
};

export const getInvoiceById = async (req, res) => {
	const invoice = await Invoice.findById(req.params.id);
	if (!invoice) return res.status(404).json({ message: 'Not found' });
	res.json(invoice);
};

export const updateInvoice = async (req, res) => {
	const invoice = await Invoice.findByIdAndUpdate(req.params.id, req.body, {
		new: true,
	});
	res.json(invoice);
};

export const deleteInvoice = async (req, res) => {
	await Invoice.findByIdAndDelete(req.params.id);
	res.json({ message: 'Invoice deleted' });
};
