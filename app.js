const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const path = require('path');
const bcrypt = require('bcrypt');
const https = require('https');

const app = express();

// Initialize Firebase Admin SDK
const serviceAccount = require('./key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Body parser middleware
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Number of salt rounds for bcrypt hashing
const saltRounds = 10;

// Route for rendering the signup form
app.get('/signup', (req, res) => {
  res.render('signup');
});

// Route for handling signup form submission
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  try {
    // Check if email already exists
    const existingUser = await db.collection('users').where('email', '==', email).get();

    if (!existingUser.empty) {
      console.log('Email already exists:', email);
      return res.status(400).send('Email already exists');
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Save user data directly in Firestore
    await db.collection('users').add({
      email,
      password: hashedPassword,
    });

    console.log('User signed up:', email);

    // Redirect to login page after successful signup
    res.redirect('/login');
  } catch (error) {
    console.error('Error during signup:', error);
    res.status(500).send('Error: ' + error.message);
  }
});

// Route for rendering the login form
app.get('/login', (req, res) => {
  res.render('login');
});

// Route for handling login form submission
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    // Query Firestore to find user with given email
    const userQuery = await db.collection('users').where('email', '==', email).get();

    if (userQuery.empty) {
      console.log('Invalid email or password:', email);
      return res.status(401).send('Invalid email or password');
    }

    const userData = userQuery.docs[0].data();
    const hashedPassword = userData.password;

    // Compare hashed password with input password
    const passwordMatch = await bcrypt.compare(password, hashedPassword);

    if (passwordMatch) {
      console.log('User logged in:', email);
      res.redirect('/dashboard'); // Redirect to dashboard after successful login
    } else {
      console.log('Invalid email or password:', email);
      res.status(401).send('Invalid email or password');
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).send('Error: ' + error.message);
  }
});

// OMDb API Key (replace with your actual API key)
const omdbApiKey = '6a26f52';

// Function to fetch movie data from OMDb API
function fetchMovies(searchTerm, callback) {
  const url = `https://www.omdbapi.com/?s=${encodeURIComponent(searchTerm)}&apikey=${omdbApiKey}`;
  https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      callback(null, JSON.parse(data));
    });
  }).on('error', (err) => {
    callback(err);
  });
}

// Route for rendering the dashboard
app.get('/dashboard', (req, res) => {
  const searchTerm = req.query.search || 'batman'; // Default search term
  fetchMovies(searchTerm, (error, data) => {
    if (error) {
      console.error('Error fetching movies:', error);
      return res.status(500).send('Error fetching movies');
    }

    // Check if there are any results
    if (!data.Search || data.Search.length === 0) {
      console.log('No movies found for:', searchTerm);
      return res.render('dashboard', { movies: [] }); // Render with empty movies array
    }

    // Render the dashboard with the movies
    res.render('dashboard', { movies: data.Search });
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
