CREATE DATABASE codesprint;

USE codesprint;
-- Step 1: Drop the foreign key constraint in the submissions table
ALTER TABLE submissions DROP FOREIGN KEY submissions_ibfk_1;


-- Drop existing tables if they exist
DROP TABLE IF EXISTS submissions;
DROP TABLE IF EXISTS problems;
DROP TABLE IF EXISTS contests;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(100),
  email VARCHAR(100),
  password VARCHAR(255),
  role ENUM('admin', 'participant') DEFAULT 'participant'
);

CREATE TABLE contests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  is_group BOOLEAN DEFAULT FALSE,  -- Flag for individual or group contest
  user_id INT,  -- User ID of the creator, if applicable
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE problems (
  id INT PRIMARY KEY AUTO_INCREMENT,
  contest_id INT,
  title VARCHAR(255),
  description TEXT,
  input_format TEXT,
  output_format TEXT,
  sample_input TEXT,
  sample_output TEXT,
  time_limit INT DEFAULT 1,
  memory_limit INT DEFAULT 256,
  testcases JSON,
  FOREIGN KEY (contest_id) REFERENCES contests(id)
);

-- Submissions Table
CREATE TABLE submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  contest_id INT NOT NULL,
  problem_id INT NOT NULL,
  language VARCHAR(20) NOT NULL,
  code TEXT NOT NULL,
  verdict ENUM('Accepted', 'Wrong Answer') NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (contest_id) REFERENCES contests(id)
);