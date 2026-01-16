const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function resetAdminPassword() {
  const email = 'admin@pbs.group';
  const newPassword = 'Admin123!';
  
  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id, email, first_name, last_name, role',
      [hashedPassword, email]
    );
    
    if (result.rows.length > 0) {
      console.log('Password reset successful!');
      console.log('User:', result.rows[0]);
      console.log('New password: Admin123!');
    } else {
      console.log('User not found with email:', email);
      
      // List existing users
      const users = await pool.query('SELECT id, email, first_name, last_name, role FROM users LIMIT 10');
      console.log('Existing users:', users.rows);
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

resetAdminPassword();
