const axios = require('axios');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const dotenv = require('dotenv');
const express = require('express');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

(async () => {
  // Database connection
  const db = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'sunjida2001', // your DB password
    database: 'codesprint'
  });

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
    const { user_id, problem_id, contest_id, language, code } = req.body;

    const [problem] = await db.execute('SELECT * FROM problems WHERE id = ?', [problem_id]);
    const testcases = JSON.parse(problem[0].testcases);

    let accepted = true;

    for (const test of testcases) {
      const result = await axios.post(
        'https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true',
        {
          language_id: mapLanguage(language),
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

      if (result.data.stdout.trim() !== test.expected_output.trim()) {
        accepted = false;
        break;
      }
    }

    const verdict = accepted ? 'Accepted' : 'Wrong Answer';

    await db.execute(
      'INSERT INTO submissions (user_id, contest_id, problem_id, language, code, verdict) VALUES (?, ?, ?, ?, ?, ?)',
      [user_id, contest_id, problem_id, language, code, verdict]
    );

    res.json({ verdict });
  });

  // Map programming languages to Judge0 IDs
  function mapLanguage(lang) {
    if (lang === 'cpp') return 54;
    if (lang === 'python') return 71;
    if (lang === 'java') return 62;
    return 54;
  }

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
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ message: 'Login successful', token });
  });

  // Start server
  app.listen(5000, () => {
    console.log('Backend running on http://localhost:5000');
  });
})();
