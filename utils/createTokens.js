import jwt from 'jsonwebtoken';
export const createAccessToken = (user) => {
	const accessToken = jwt.sign(
		{
			id: user.id,
			email: user.email,
			role: user.role,
			username: user.username,
		},
		process.env.JWT_SECRET,
		{ expiresIn: process.env.JWT_EXPIRE }
	);
	return accessToken;
};

export const createRefreshToken = (user) => {
	const refreshToken = jwt.sign(
		{
			id: user.id,
			email: user.email,
			role: user.role,
			username: user.username,
		},
		process.env.REFRESH_SECRET || 'refrjhkeshSecret',
		{ expiresIn: '30d' }
	);

	return refreshToken;
};
