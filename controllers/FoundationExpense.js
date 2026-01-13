import Expense from '../models/FoundationExpense.js';
import Project from '../models/Project.js';

export const createExpense = async (req, res) => {
	const expense = await Expense.create(req.body);

	if (expense.projectId) {
		await Project.findByIdAndUpdate(expense.projectId, {
			$inc: { spent: expense.amount },
		});
	}

	res.status(201).json(expense);
};

export const getExpenses = async (req, res) => {
	const expenses = await Expense.find({ foundationId: req.query.foundationId });
	res.json(expenses);
};

export const updateExpense = async (req, res) => {
	const expense = await Expense.findByIdAndUpdate(req.params.id, req.body, {
		new: true,
	});
	res.json(expense);
};

export const deleteExpense = async (req, res) => {
	await Expense.findByIdAndDelete(req.params.id);
	res.json({ message: 'Expense deleted' });
};
