export const softDelete = async (Model, id) => {
	return Model.findByIdAndUpdate(
		id,
		{ isDeleted: true, deletedAt: new Date() },
		{ new: true }
	);
};
