import Project from '../models/projects.js';

export const createProject = async (req, res) => {
	const project = await Project.create(req.body);
	res.status(201).json(project);
};

export const getProjects = async (req, res) => {
	const projects = await Project.find({ foundationId: req.query.foundationId });
	res.json(projects);
};

export const updateProject = async (req, res) => {
	const project = await Project.findByIdAndUpdate(req.params.id, req.body, {
		new: true,
	});
	res.json(project);
};

export const deleteProject = async (req, res) => {
	await Project.findByIdAndDelete(req.params.id);
	res.json({ message: 'Project deleted' });
};
