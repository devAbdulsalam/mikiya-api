import mongoose from 'mongoose';

const beneficiarySchema = new mongoose.Schema({
	beneficiaryId: {
		type: String,
		required: true,
		unique: true,
		trim: true,
	},
	foundationId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Foundation',
		required: true,
	},
	projectId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Project',
	},

	// Personal Information
	firstName: {
		type: String,
		required: true,
		trim: true,
	},
	lastName: {
		type: String,
		required: true,
		trim: true,
	},
	middleName: String,
	dateOfBirth: Date,
	age: {
		type: Number,
		min: 0,
	},
	gender: {
		type: String,
		enum: ['male', 'female', 'other'],
	},
	maritalStatus: {
		type: String,
		enum: ['single', 'married', 'divorced', 'widowed', 'separated'],
	},

	// Contact Information
	contact: {
		phone: String,
		email: String,
		address: {
			street: String,
			city: String,
			state: String,
			country: String,
			postalCode: String,
		},
		alternativeContact: {
			name: String,
			relationship: String,
			phone: String,
		},
	},

	// Identification
	identification: {
		type: {
			type: String,
			enum: [
				'national_id',
				'passport',
				'drivers_license',
				'voters_card',
				'birth_certificate',
			],
		},
		number: String,
		issueDate: Date,
		expiryDate: Date,
		issuingAuthority: String,
	},

	// Household Information
	household: {
		size: Number,
		dependents: Number,
		incomeLevel: {
			type: String,
			enum: [
				'extremely_poor',
				'poor',
				'low_income',
				'middle_income',
				'high_income',
			],
		},
		primaryIncomeSource: String,
		monthlyIncome: Number,
		hasElectricity: Boolean,
		hasCleanWater: Boolean,
		housingType: String,
	},

	// Education
	education: {
		level: {
			type: String,
			enum: [
				'none',
				'primary',
				'secondary',
				'vocational',
				'diploma',
				'bachelors',
				'masters',
				'phd',
			],
		},
		currentStatus: {
			type: String,
			enum: ['not_enrolled', 'enrolled', 'graduated', 'dropped_out'],
		},
		institution: String,
		course: String,
		year: String,
	},

	// Employment
	employment: {
		status: {
			type: String,
			enum: ['employed', 'self_employed', 'unemployed', 'student', 'retired'],
		},
		occupation: String,
		employer: String,
		monthlyIncome: Number,
		yearsExperience: Number,
	},

	// Health Information
	health: {
		hasDisability: Boolean,
		disabilityType: String,
		disabilitySeverity: {
			type: String,
			enum: ['mild', 'moderate', 'severe'],
		},
		chronicConditions: [String],
		healthInsurance: Boolean,
		insuranceProvider: String,
		lastMedicalCheckup: Date,
	},

	// Program Enrollment
	enrollment: {
		date: {
			type: Date,
			default: Date.now,
		},
		programType: {
			type: String,
			enum: [
				'scholarship',
				'livelihood',
				'healthcare',
				'housing',
				'food_aid',
				'other',
			],
		},
		status: {
			type: String,
			enum: ['active', 'graduated', 'dropped', 'suspended', 'completed'],
			default: 'active',
		},
		exitDate: Date,
		exitReason: String,
		exitNotes: String,
	},

	// Support Received
	support: {
		type: String,
		amount: Number,
		frequency: String,
		startDate: Date,
		endDate: Date,
		totalReceived: {
			type: Number,
			default: 0,
		},
		lastDisbursement: Date,
		nextDisbursement: Date,
	},

	// Assessment
	assessment: {
		vulnerabilityScore: {
			type: Number,
			min: 0,
			max: 100,
		},
		needs: [String],
		strengths: [String],
		challenges: [String],
		recommendations: [String],
		assessmentDate: Date,
		assessedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
		},
	},

	// Progress Tracking
	progress: {
		baseline: {
			date: Date,
			metrics: {
				type: Map,
				of: mongoose.Schema.Types.Mixed,
			},
		},
		milestones: [
			{
				milestone: String,
				targetDate: Date,
				achievedDate: Date,
				status: {
					type: String,
					enum: ['pending', 'achieved', 'delayed', 'cancelled'],
					default: 'pending',
				},
				evidence: String,
			},
		],
		improvements: [
			{
				area: String,
				before: String,
				after: String,
				change: String,
				date: Date,
			},
		],
	},

	// Documents
	documents: [
		{
			type: String,
			name: String,
			url: String,
			uploadDate: Date,
			notes: String,
		},
	],

	// Consent and Privacy
	consent: {
		dataCollection: {
			type: Boolean,
			default: false,
		},
		dataSharing: {
			type: Boolean,
			default: false,
		},
		photos: {
			type: Boolean,
			default: false,
		},
		testimonials: {
			type: Boolean,
			default: false,
		},
		consentDate: Date,
		consentForm: String,
	},

	// Status
	isActive: {
		type: Boolean,
		default: true,
	},

	// Audit Trail
	registeredBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
	},
	updatedBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
	},
	notes: String,
	tags: [String],
	createdAt: {
		type: Date,
		default: Date.now,
	},
	updatedAt: {
		type: Date,
		default: Date.now,
	},
});

// Update timestamp before saving
beneficiarySchema.pre('save', async function () {
	this.updatedAt = Date.now();

	// Calculate age from date of birth
	if (this.dateOfBirth) {
		const today = new Date();
		const birthDate = new Date(this.dateOfBirth);
		let age = today.getFullYear() - birthDate.getFullYear();
		const monthDiff = today.getMonth() - birthDate.getMonth();

		if (
			monthDiff < 0 ||
			(monthDiff === 0 && today.getDate() < birthDate.getDate())
		) {
			age--;
		}

		this.age = age;
	}

});

// Generate beneficiary ID before saving
beneficiarySchema.pre('save', async function () {
	if (!this.beneficiaryId) {
		const timestamp = Date.now().toString().slice(-6);
		const random = Math.floor(Math.random() * 1000)
			.toString()
			.padStart(3, '0');
		this.beneficiaryId = `BEN-${timestamp}-${random}`;
	}
});

// Update foundation statistics when beneficiary is registered
beneficiarySchema.post('save', async function (doc) {
	try {
		if (doc.isActive) {
			await mongoose.model('Foundation').findByIdAndUpdate(doc.foundationId, {
				$inc: {
					'statistics.totalBeneficiaries': 1,
				},
			});
		}
	} catch (error) {
		console.error('Error updating foundation statistics:', error);
	}
});

const Beneficiary = mongoose.model('Beneficiary', beneficiarySchema);

export default Beneficiary;
