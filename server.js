const axios = require('axios');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const dotenv = require('dotenv');
const express = require('express');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

// Point explicitly to your custom environment file name
dotenv.config({ path: './api.env' });

const app = express();
app.use(cors());
app.use(express.json());

(async () => {
  try {
    // Dynamically connect using the environment keys we just configured
    const db = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD, 
      database: process.env.DB_NAME || 'codesprint'
    });

    console.log('Successfully connected to the MySQL Database.');

    // Get all contests
    app.get('/api/contests', async (req, res) => {
      const [rows] = await db.execute('SELECT * FROM contests');
      res.json(rows);
    });

    // Create a new contest
    app.post('/api/contest', async (req, res) => {
      const { title, description, start_time, end_time } = req.body;
      await db.execute(
        'INSERT INTO contests (title, description, start_time, end_time) VALUES (?, ?, ?, ?)',
        [title, description, start_time, end_time]
      );
      res.json({ message: 'Contest created' });
    });

    // Submit code and judge it
    app.post('/api/submit', async (req, res) => {
      try {
        const { user_id, problem_id, contest_id, language, code } = req.body;

        // rows contains the matching data rows
        const [rows] = await db.execute('SELECT * FROM problems WHERE id = ?', [problem_id]);
        if (!rows.length) {
          return res.status(404).json({ message: 'Problem not found' });
        }

        const singleProblem = rows[0];

        // Safe check to unpack the testcases properly from the row item
        let testcases = singleProblem.testcases;
        if (typeof testcases === 'string') {
          testcases = JSON.parse(testcases);
        }

        if (!Array.isArray(testcases)) {
          console.error("Warning: testcases is still not an array:", testcases);
          return res.status(500).json({ error: 'Test cases configuration error on backend' });
        }

        let accepted = true;
        const targetLanguageId = mapLanguage(language);

        for (const test of testcases) {
          const result = await axios.post(
            'https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true',
            {
              language_id: targetLanguageId,
              source_code: code,
              stdin: test.input
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'X-RapidAPI-Key': process.env.JUDGE0_API_KEY,
                'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
              }
            }
          );

          // Safely handle missing standard output from compiling/runtime errors
          const stdout = result.data.stdout ? result.data.stdout.trim() : '';
          const expected = test.expected_output ? test.expected_output.trim() : '';

          if (stdout !== expected) {
            accepted = false;
            break;
          }
        }

        const verdict = accepted ? 'Accepted' : 'Wrong Answer';

        // Updated database columns to match your 'submissions' table schema (language_id)
        await db.execute(
          'INSERT INTO submissions (user_id, contest_id, problem_id, language_id, code, verdict) VALUES (?, ?, ?, ?, ?, ?)',
          [user_id, contest_id, problem_id, targetLanguageId, code, verdict]
        );

        res.json({ verdict });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Evaluation failed or database log error' });
      }
    });

    // Map programming languages to Judge0 IDs
    function mapLanguage(lang) {
      if (lang === 'cpp') return 54;
      if (lang === 'python') return 71;
      if (lang === 'java') return 62;
      // Default fallback if a numeric value is passed directly via curl instead
      if (typeof lang === 'number') return lang;
      return 54;
    }

    // Registration endpoint
    app.post('/api/register', async (req, res) => {
      try {
        const { username, password } = req.body;
        
        // Hash the password with bcrypt before saving
        const hashedPassword = await bcrypt.hash(password, 10);
        
        await db.execute(
          'INSERT INTO users (username, password) VALUES (?, ?)',
          [username, hashedPassword]
        );
        
        res.json({ message: 'User registered successfully!' });
      } catch (err) {
        console.error(err);
        res.status(400).json({ error: 'Username might already exist or database error.' });
      }
    });

    // Login endpoint
    app.post('/api/login', async (req, res) => {
      const { username, password, contest_id } = req.body;

      const [user] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);

      if (!user || !user.length) {
        return res.status(400).json({ message: 'User not found' });
      }

      if (contest_id) {
        const [contest] = await db.execute('SELECT * FROM contests WHERE id = ?', [contest_id]);

        if (!contest || !contest.length) {
          return res.status(400).json({ message: 'Contest not found' });
        }

        if (contest[0].is_group) {
          const [activeUser] = await db.execute(
            'SELECT * FROM submissions WHERE contest_id = ? AND user_id IS NOT NULL',
            [contest_id]
          );

          if (activeUser.length > 0) {
            return res.status(400).json({ message: 'This contest is already in use by another user' });
          }
        }
      }

      const validPassword = await bcrypt.compare(password, user[0].password);
      if (!validPassword) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: user[0].id, username: user[0].username },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: '1h' }
      );

      res.json({ message: 'Login successful', token });
    });

    // Start server
    app.listen(5000, () => {
      console.log('Backend running on http://localhost:5000');
    });

  } catch (error) {
    console.error('Initialization Error: Check if your local MySQL instance is running.');
    console.error(error.message);
  }
})();
