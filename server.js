const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve all static files

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tci-trucking';
mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Driver Schema
const driverSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    isTracking: { type: Boolean, default: false },
    lastLocation: {
        lat: Number,
        lng: Number,
        timestamp: Date,
        speed: { type: Number, default: 0 },
        accuracy: Number
    },
    trackingHistory: [{
        lat: Number,
        lng: Number,
        timestamp: Date,
        speed: Number,
        accuracy: Number,
        address: String
    }],
    consentGiven: { type: Boolean, default: false },
    consentTimestamp: Date
}, { timestamps: true });

const Driver = mongoose.model('Driver', driverSchema);

// Routes

// Serve homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve driver portal
app.get('/driver-portal', (req, res) => {
    res.sendFile(path.join(__dirname, 'driver-portal.html'));
});

// Serve admin dashboard
app.get('/admin-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
});

// API Routes
app.get('/api/drivers', async (req, res) => {
    try {
        const drivers = await Driver.find();
        res.json(drivers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/driver/tracking', async (req, res) => {
    try {
        const { driverId, action, timestamp } = req.body;
        
        const driver = await Driver.findOneAndUpdate(
            { _id: driverId },
            { 
                isTracking: action === 'start_tracking',
                consentGiven: action === 'start_tracking',
                consentTimestamp: action === 'start_tracking' ? new Date() : null,
                lastTrackingAction: {
                    action: action,
                    timestamp: new Date(timestamp)
                }
            },
            { new: true }
        );

        if (!driver) {
            return res.status(404).json({ error: 'Driver not found' });
        }

        res.json({ success: true, driver });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/driver/location', async (req, res) => {
    try {
        const { driverId, latitude, longitude, accuracy, timestamp } = req.body;
        
        const driver = await Driver.findOneAndUpdate(
            { _id: driverId },
            {
                lastLocation: {
                    lat: latitude,
                    lng: longitude,
                    accuracy: accuracy,
                    timestamp: new Date(timestamp)
                },
                $push: {
                    trackingHistory: {
                        lat: latitude,
                        lng: longitude,
                        accuracy: accuracy,
                        timestamp: new Date(timestamp)
                    }
                }
            },
            { new: true }
        );

        if (!driver) {
            return res.status(404).json({ error: 'Driver not found' });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/drivers', async (req, res) => {
    try {
        const { name, phone } = req.body;
        const driver = new Driver({ name, phone });
        await driver.save();
        res.json(driver);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Initialize with sample data
app.post('/api/init-sample-data', async (req, res) => {
    try {
        const sampleDrivers = [
            { name: 'John Smith', phone: '+1-555-0101' },
            { name: 'Maria Garcia', phone: '+1-555-0102' },
            { name: 'David Johnson', phone: '+1-555-0103' },
            { name: 'Sarah Williams', phone: '+1-555-0104' }
        ];

        await Driver.deleteMany({});
        const drivers = await Driver.insertMany(sampleDrivers);

        res.json({ success: true, drivers: drivers.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚚 TCI Trucking Server running on port ${PORT}`);
    console.log(`📍 Homepage: http://localhost:${PORT}`);
    console.log(`👤 Driver Portal: http://localhost:${PORT}/driver-portal`);
    console.log(`👑 Admin Dashboard: http://localhost:${PORT}/admin-dashboard`);
});