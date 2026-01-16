import mongoose from 'mongoose';

const waybillSchema = new mongoose.Schema({
    receiverName: String,
    waybillNumber: String,
    date: Date,
    waybillInfo: {
        waybillNumber: String,
        date: Date,
        vehicleNumber: String,
        driverName: String,
        driverPhone: String,
    },
    items: [
        {
            id: String,
            description: String,
            quantity: Number,
            weight: String,
            remarks: String,
        },
    ],
    fromDetails: {
        name: String,
        contactPerson: String,
        phone: String,
        address: String,
    },
    toDetails: {
        name: String,
        contactPerson: String,
        phone: String,
        address: String,
    },
    notes: String,
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
});

const Waybill = mongoose.model('Waybill', waybillSchema);
export default Waybill;
