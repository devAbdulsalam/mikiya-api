import User from '../models/User.js';

export const createManager = async ({
	username,
	email,
	password,
	businessId,
	outletId,
}) => {
	if (!username || !email || !password) {
		return res.status(400).json({ message: 'All fields are required' });
	}

	if (await User.findOne({ email })) {
		return res.status(400).json({ message: 'Email already in use' });
	}
	const user = await User.create({
		username,
		email,
		password,
		role: 'manager',
	});

	if (businessId) user.assignedBusinesses.push(businessId);
	if (outletId) user.assignedOutlets.push(outletId);

	await user.save();
	return user;
};

export default createManager;


// controllers/userController.js
export const suspendUser = async (req,res)=>{
	const user = await User.findById(req.params.id);
	user.status = "suspended";
	await user.save();
	res.json({message: "User suspended"});
};
