const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// MongoDB connection for production
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tci-trucking';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => {
    console.error('❌ MongoDB connection error:', err);
    console.log('⚠️  Running without database - some features disabled');
});

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
        accuracy: Number,
        address: String
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

// Routes - Serve HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/driver-portal', (req, res) => {
    res.sendFile(path.join(__dirname, 'driver-portal.html'));
});

app.get('/admin-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
});

// REAL API Routes with MongoDB
app.get('/api/drivers', async (req, res) => {
    try {
        const drivers = await Driver.find().sort({ createdAt: -1 });
        res.json(drivers);
    } catch (error) {
        console.error('Error fetching drivers:', error);
        // Fallback to mock data if database fails
        res.json([
            { _id: '1', name: 'John Smith', phone: '+1-555-0101', isTracking: false },
            { _id: '2', name: 'Maria Garcia', phone: '+1-555-0102', isTracking: false }
        ]);
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
                consentTimestamp: action === 'start_tracking' ? new Date() : null
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
        const { driverId, latitude, longitude, accuracy, timestamp, speed } = req.body;
        
        const driver = await Driver.findOneAndUpdate(
            { _id: driverId },
            {
                lastLocation: {
                    lat: latitude,
                    lng: longitude,
                    accuracy: accuracy,
                    timestamp: new Date(timestamp),
                    speed: speed || 0
                },
                $push: {
                    trackingHistory: {
                        lat: latitude,
                        lng: longitude,
                        accuracy: accuracy,
                        timestamp: new Date(timestamp),
                        speed: speed || 0
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

// Create sample drivers
app.post('/api/init-drivers', async (req, res) => {
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

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'TCI Trucking Server Running',
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚚 TCI Trucking Server running on port ${PORT}`);
    console.log(`📍 Homepage: http://localhost:${PORT}`);
    console.log(`👤 Driver Portal: http://localhost:${PORT}/driver-portal`);
    console.log(`👑 Admin Dashboard: http://localhost:${PORT}/admin-dashboard`);
    console.log(`💾 MongoDB: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
});