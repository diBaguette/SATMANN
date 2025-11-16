// server.js
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../')));

app.get('/:path(*)', (req, res) => {
  res.sendFile(path.join(__dirname, '../psychometric_test.html'));
});




const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Crear tablas si no existen
const initDb = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS participants (
      id SERIAL PRIMARY KEY,
      document_number TEXT NOT NULL,
      age INTEGER,
      gender TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS results (
      id SERIAL PRIMARY KEY,
      participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
      test_name TEXT,
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
      total_score INTEGER,
      details JSONB
    );
  `);
};

app.post('/api/participants', async (req, res) => {
  try {
    const { document_number, age, gender } = req.body;
    if (!document_number) return res.status(400).json({ error: 'document_number required' });

    const result = await pool.query(
      'INSERT INTO participants(document_number, age, gender) VALUES($1,$2,$3) RETURNING *',
      [document_number, age || null, gender || null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/results', async (req, res) => {
  try {
    const { participant_id, test_name, total_score, details } = req.body;
    if (!participant_id) return res.status(400).json({ error: 'participant_id required' });

    const result = await pool.query(
      'INSERT INTO results(participant_id, test_name, total_score, details) VALUES($1,$2,$3,$4) RETURNING *',
      [participant_id, test_name || 'SATMANN', total_score || null, details || {}]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/participants/:id/results', async (req, res) => {
  try {
    const pid = req.params.id;
    const r = await pool.query('SELECT * FROM results WHERE participant_id = $1 ORDER BY timestamp DESC', [pid]);
    return res.json(r.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
});

const start = async () => {
  await initDb();
  const port = process.env.PORT || 4000;
  app.listen(port, () => console.log('Server running on port', port));
};

start();
