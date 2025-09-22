require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const User = require('./models/userModel');
const bcrypt = require('bcryptjs');

// Import routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const userRoutes = require('./routes/users');
const storeRoutes = require('./routes/stores');
const vehicleRoutes = require('./routes/vehicles');
const orderRoutes = require('./routes/orders');
const routeRoutes = require('./routes/routes');
const visitRoutes = require('./routes/visits');
const surveyRoutes = require('./routes/surveys');
const salesVisitRoutes = require('./routes/salesVisitRoutes');
const regionRoutes = require('./routes/regionRoutes');

const app = express();

// Disable ETag caching to ensure fresh data on every request
app.disable('etag');

// Middleware
const allowedOrigins = [
  'http://localhost:5173',                  // Alamat frontend lokal Anda
  'https://ku-airku.vercel.app',              // Alamat Vercel Anda
  'https://2b2b10f331a3.ngrok-free.app',      // Alamat ngrok Anda
  'amdk-airku-final-production-cdc3.up.railway.app'
];

app.use(cors({
  origin: function (origin, callback) {
    // Izinkan permintaan tanpa origin (seperti dari Postman atau mobile apps)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}));
// Tingkatkan batas ukuran payload menjadi 5MB untuk unggahan gambar
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));


// --- Admin Seeder Function ---
const seedAdminAccount = async (connection) => {
    try {
        const adminEmail = 'admin@kuairku.com';
        const defaultPassword = '123';
        
        const existingAdmin = await User.findByEmail(adminEmail);

        if (!existingAdmin) {
            console.log(`Admin user '${adminEmail}' not found. Creating one with default password...`);
            await User.create({
                name: 'Admin Utama',
                email: adminEmail,
                role: 'Admin',
                password: defaultPassword
            });
            console.log(`Admin user '${adminEmail}' created successfully.`);
        } else {
            // This part handles the case where the user might have manually inserted 
            // a plain-text password, causing bcrypt.compare to fail.
            const isMatch = await bcrypt.compare(defaultPassword, existingAdmin.password);
            if (!isMatch && existingAdmin.password === defaultPassword) {
                console.log(`Password for '${adminEmail}' is not hashed. Fixing...`);
                const hashedPassword = await bcrypt.hash(defaultPassword, 10);
                await connection.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, existingAdmin.id]);
                console.log(`Password for '${adminEmail}' has been securely updated.`);
            }
        }
    } catch (err) {
        // Avoid crashing the server for a seeding error, but log it.
        console.error('An error occurred during the admin account seeding process:', err);
    }
};

// Test database connection and seed admin on startup
pool.getConnection()
    .then(async conn => {
        console.log('Successfully connected to database.');
        
        // Run the seeder to ensure the admin account is usable
        await seedAdminAccount(conn);
        
        conn.release();
    })
    .catch(err => {
        console.error('Error connecting to database:', err.stack);
    });

// Define API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/surveys', surveyRoutes);
app.use('/api/sales-routes', salesVisitRoutes);
app.use('/api/regions', regionRoutes);


// Simple test route
app.get('/', (req, res) => {
    res.send('AMDK Airku Backend is running!');
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
