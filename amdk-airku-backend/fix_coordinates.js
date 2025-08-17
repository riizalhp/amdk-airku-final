const pool = require('./src/config/db');

async function fixCoordinates() {
  try {
    console.log('🔍 Checking database schema...');
    
    // Check if lat/lng columns exist in route_stops
    const [routeStopsColumns] = await pool.query('DESCRIBE route_stops');
    const routeStopsHasCoords = routeStopsColumns.some(col => col.Field === 'lat') && 
                                routeStopsColumns.some(col => col.Field === 'lng');
    
    console.log('📋 Route stops columns:', routeStopsColumns.map(c => c.Field).join(', '));
    console.log('📍 Has coordinates columns:', routeStopsHasCoords);
    
    if (!routeStopsHasCoords) {
      console.log('➕ Adding coordinate columns to route_stops...');
      await pool.query(`
        ALTER TABLE route_stops 
        ADD COLUMN lat DECIMAL(10,8) NOT NULL DEFAULT 0,
        ADD COLUMN lng DECIMAL(11,8) NOT NULL DEFAULT 0
      `);
      console.log('✅ Added lat/lng to route_stops');
      
      // Update existing data
      console.log('🔄 Updating existing route_stops with coordinates from stores...');
      const [updateResult] = await pool.query(`
        UPDATE route_stops rs
        JOIN stores s ON rs.storeId = s.id
        SET rs.lat = s.lat, rs.lng = s.lng
      `);
      console.log(`✅ Updated ${updateResult.affectedRows} route stops with coordinates`);
    }
    
    // Check if lat/lng columns exist in sales_visit_route_stops
    const [salesStopsColumns] = await pool.query('DESCRIBE sales_visit_route_stops');
    const salesStopsHasCoords = salesStopsColumns.some(col => col.Field === 'lat') && 
                                salesStopsColumns.some(col => col.Field === 'lng');
    
    console.log('📋 Sales visit stops columns:', salesStopsColumns.map(c => c.Field).join(', '));
    console.log('📍 Has coordinates columns:', salesStopsHasCoords);
    
    if (!salesStopsHasCoords) {
      console.log('➕ Adding coordinate columns to sales_visit_route_stops...');
      await pool.query(`
        ALTER TABLE sales_visit_route_stops 
        ADD COLUMN lat DECIMAL(10,8) NOT NULL DEFAULT 0,
        ADD COLUMN lng DECIMAL(11,8) NOT NULL DEFAULT 0
      `);
      console.log('✅ Added lat/lng to sales_visit_route_stops');
      
      // Update existing data
      console.log('🔄 Updating existing sales_visit_route_stops with coordinates from stores...');
      const [updateResult2] = await pool.query(`
        UPDATE sales_visit_route_stops svrs
        JOIN stores s ON svrs.storeId = s.id
        SET svrs.lat = s.lat, svrs.lng = s.lng
      `);
      console.log(`✅ Updated ${updateResult2.affectedRows} sales visit stops with coordinates`);
    }
    
    // Test query to check if coordinates are available
    console.log('🧪 Testing coordinate retrieval...');
    const [testResult] = await pool.query(`
      SELECT rs.*, s.name as storeName
      FROM route_stops rs
      LEFT JOIN stores s ON rs.storeId = s.id
      LIMIT 5
    `);
    
    console.log('📊 Sample route stops with coordinates:');
    testResult.forEach((row, index) => {
      console.log(`${index + 1}. ${row.storeName}: lat=${row.lat}, lng=${row.lng}`);
    });
    
    console.log('🎉 Database schema fix completed!');
    process.exit(0);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

fixCoordinates();
