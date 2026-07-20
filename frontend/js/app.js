// Select DOM elements
const contestsList = document.getElementById("contestsList");
const createContestForm = document.getElementById("createContestForm");
const submitCodeForm = document.getElementById("submitCodeForm");
const submissionResult = document.getElementById("submissionResult");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const contestProblemsPage = document.getElementById("contestProblemsPage");
const problemsList = document.getElementById("problemsList");

let authToken = ''; // Store the JWT token after successful login

// Function to fetch all contests from the backend
async function fetchContests() {
  try {
    const response = await axios.get('http://localhost:5000/api/contests', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    const contests = response.data;
    contestsList.innerHTML = '';
    contests.forEach(contest => {
      const listItem = document.createElement("li");
      listItem.className = "list-group-item";
      listItem.innerText = contest.title;
      listItem.onclick = () => showContestProblems(contest.id); // Set event to show problems for that contest
      contestsList.appendChild(listItem);
    });
  } catch (error) {
    console.error("Error fetching contests:", error);
  }
}

// Function to fetch problems for a particular contest
async function fetchContestProblems(contestId) {
  try {
    const response = await axios.get(`http://localhost:5000/api/contest/${contestId}/problems`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    const problems = response.data;
    problemsList.innerHTML = ''; // Clear any existing problems

    problems.forEach(problem => {
      const listItem = document.createElement("li");
      listItem.className = "list-group-item";
      listItem.innerText = `${problem.name} (ID: ${problem.id})`;
      listItem.onclick = () => showProblemDetails(problem.id); // Show problem details when clicked
      problemsList.appendChild(listItem);
    });
  } catch (error) {
    console.error("Error fetching problems:", error);
  }
}

// Function to show problems page for a specific contest
function showContestProblems(contestId) {
  // Hide contest list page and show contest problems page
  document.getElementById('contestsPage').style.display = 'none';
  contestProblemsPage.style.display = 'block';
  
  // Fetch and display problems for the selected contest
  fetchContestProblems(contestId);
}

// Function to show problem details (for submitting code)
async function showProblemDetails(problemId) {
  // Show a form for submitting code for the selected problem
  const problemDetailsPage = document.getElementById("problemDetailsPage");
  problemDetailsPage.style.display = 'block';

  // Fetch and display the problem details
  try {
    const response = await axios.get(`http://localhost:5000/api/problem/${problemId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    const problem = response.data;

    document.getElementById("problemTitle").innerText = problem.name;
    document.getElementById("problemDescription").innerText = problem.description;

    // Handle form submission for code submission
    const submitCodeForm = document.getElementById("submitCodeForm");
    submitCodeForm.onsubmit = async function (e) {
      e.preventDefault();
      const language = document.getElementById("language").value;
      const code = document.getElementById("code").value;

      try {
        const submissionResponse = await axios.post('http://localhost:5000/api/submit', {
          problem_id: problem.id,
          language,
          code
        }, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });

        document.getElementById('submissionResult').innerText = `Verdict: ${submissionResponse.data.verdict}`;
      } catch (error) {
        console.error("Error submitting code:", error);
        document.getElementById('submissionResult').innerText = "An error occurred while submitting the code.";
      }
    };
  } catch (error) {
    console.error("Error fetching problem details:", error);
  }
}

// Go back to contest list
function goBackToContests() {
  document.getElementById('contestsPage').style.display = 'block';
  contestProblemsPage.style.display = 'none';
}

// Handle contest creation form submission
createContestForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = document.getElementById("title").value;
  const description = document.getElementById("description").value;
  const start_time = document.getElementById("start_time").value;
  const end_time = document.getElementById("end_time").value;

  try {
    await axios.post('http://localhost:5000/api/contest', {
      title,
      description,
      start_time,
      end_time
    }, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    fetchContests(); // Refresh contest list
    createContestForm.reset(); // Reset the form
  } catch (error) {
    console.error("Error creating contest:", error);
  }
});

// Handle code submission form submission
submitCodeForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const problem_id = document.getElementById("problem_id").value;
  const language = document.getElementById("language").value;
  const code = document.getElementById("code").value;

  try {
    const response = await axios.post('http://localhost:5000/api/submit', {
      problem_id,
      language,
      code
    }, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });

    submissionResult.innerText = `Verdict: ${response.data.verdict}`;
  } catch (error) {
    console.error("Error submitting code:", error);
    submissionResult.innerText = "An error occurred while submitting the code.";
  }
});

// Handle login form submission
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const contest_id = document.getElementById("contest_id").value;

  try {
    const response = await axios.post('http://localhost:5000/api/login', {
      username,
      password,
      contest_id
    });

    // Store the JWT token
    authToken = response.data.token;
    localStorage.setItem('token', authToken); // Save token for future requests
    loginMessage.innerText = `Login successful! Welcome, ${username}`;
    loginMessage.style.color = 'green';
    loginForm.reset(); // Reset the form
    showMainApp(); // Show main content after login
  } catch (error) {
    console.error("Login error:", error);
    loginMessage.innerText = error.response?.data?.message || "An error occurred during login.";
    loginMessage.style.color = 'red';
  }
});

// Function to show the login page only
function showLoginOnly() {
  document.getElementById('loginSection').style.display = 'block';
  document.getElementById('mainContent').style.display = 'none';
}

// Function to show the main app after login
function showMainApp() {
  document.getElementById('loginSection').style.display = 'none';
  document.getElementById('mainContent').style.display = 'block';
}

// Fetch contests on page load if user is logged in
document.addEventListener("DOMContentLoaded", function() {
  const token = localStorage.getItem('token');
  if (token) {
    fetchContests(); // Fetch contests if logged in
    showMainApp(); // Show the main app
  } else {
    showLoginOnly(); // Show login page if not logged in
  }
});
