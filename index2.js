require("./utils.js");

//express constants
const express = require('express');
const app = express();
const session = require('express-session');
const fs = require('fs');
const path = require('path');
app.use(express.urlencoded({extended: false}));

// Serve static files from the dist/exercises directory
app.use('/exercises', express.static(path.join('exercises')));

//port
const port = process.env.PORT || 3000;


require('dotenv').config();

//main mongo connector
const MongoStore = require('connect-mongo');
const saltRounds = 12;

const expireTime = 3600;

//crypt const
const bcrypt = require('bcrypt');

const Joi = require("joi");

var {database} = include('databaseConnection.js');
const userCollection = database.db(process.env.MONGODB_DATABASE).collection(process.env.MONGODB_COLLECTION);


/* secret information section */
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;

const node_session_secret = process.env.NODE_SESSION_SECRET;
/* END secret section */

var mongoStore = MongoStore.create({
    mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/sessions`,
    crypto: {
        secret: mongodb_session_secret
    }
})

app.use(session({
    secret: node_session_secret,
    store: mongoStore, //default is memory store 
    saveUninitialized: false,
    resave: true
}
));



app.get('/createUser', (req,res) => {
    var html = `
    Sign Up
    <form action='/submitUser' method='post'>
    <input name='name' type='text' placeholder='name'>
    <input name='email' type='email' placeholder='email'>
    <input name='password' type='password' placeholder='password'>
    <button>Submit</button>
    </form>
    `;
    res.send(html);
});


app.post('/submitUser', async (req,res) => {
    var email = req.body.email;
    var name = req.body.name;
    var password = req.body.password;

	const schema = Joi.object(
		{
			name: Joi.string().max(50).required(),
            email: Joi.string().email().required(),
            password: Joi.string().max(20).required()
		});
	
	const validationResult = schema.validate({email, password, name});
	if (validationResult.error != null) {
	   console.log(validationResult.error);
	   res.redirect("/createUser");
	   return;
   }

    var hashedPassword = await bcrypt.hash(password, saltRounds);
	
	await userCollection.insertOne({email: email, password: hashedPassword, name: name});
	console.log("Inserted user");

    // Set user details in the session
    req.session.authenticated = true;
    req.session.email = email;
    req.session.name = name;
    req.session.cookie.maxAge = expireTime;

    var html = `
    Successfully Created User
    <form action="/member" method="get">
    <button type="submit">Member</button>
    </form>
    <form action="/logout" method="get">
    <button type="submit">LogOut</button>
    </form>
    `;
    res.send(html);
});

app.get('/login', (req,res) => {
    var html = `
    log in
    <form action='/loggingin' method='post'>
    <input name='email' type='email' placeholder='email'>
    <input name='password' type='password' placeholder='password'>
    <button>Submit</button>
    </form>
    `;
    res.send(html);
});

app.post('/loggingin', async (req,res) => {
    var email = req.body.email;
    var password = req.body.password;

	const schema = Joi.string().email().required();
	const validationResult = schema.validate(email);
	if (validationResult.error != null) {
	   console.log(validationResult.error);
	   res.redirect("/login");
	   return;
	}

	const result = await userCollection.find({email: email}).project({email: 1, password: 1, name: 1, _id: 1}).toArray();

	console.log(result);
	if (result.length != 1) {
		console.log("user not found");
		res.redirect("/login");
		return;
	}
    
    const user = result[0];

	if (await bcrypt.compare(password, result[0].password)) {
		console.log("correct password");
		req.session.authenticated = true;
		req.session.email = user.email;
        req.session.name = user.name;
		req.session.cookie.maxAge = expireTime;

		res.redirect('/loggedIn');
		return;
	}
	else {
		console.log("incorrect password");
		res.redirect("/login");
		return;
	}
});

app.get('/loggedin', async (req, res) => {
    if (!req.session.authenticated) {
        res.redirect('/login');
        return;
    }

    try {
        const email = req.session.email;

        // Fetch the user's name from the database based on their email
        const user = await userCollection.findOne({ email: email }, { projection: { name: 1 } });

        if (user) {
            // If user found, display the logged-in message along with the user's name
            req.session.name = user.name;

            var html = `
                Welcome ${user.name}!
                <form action="/member" method="get">
                    <button type="submit">Member</button>
                </form>
                <form action="/logout" method="get">
                    <button type="submit">Log Out</button>
                </form>
            `;
            res.send(html);
        } else {
            // If user not found, log out the user
            req.session.destroy();
            res.redirect('/login');
        }
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/:id', (req, res) => {
    try {
        // Read the JSON file
        fs.readFile("./dist/exercises.json", 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading file:', err);
                res.status(500).send('Internal Server Error');
                return;
            }

            // Parse the JSON data
            const jsonData = JSON.parse(data);

            const filteredExercises = jsonData.filter(item => item.id === req.params.id);

            // Generate HTML for each exercise
            const exercisesHTML = filteredExercises.map(exercise => `
            <h3>${exercise.name}</h3>
            <img src="./exercises/${exercise.images[0]}" alt="${exercise.name}">
            <p>level: ${exercise.level}, equipment: ${exercise.equipment}</p>
            <p>muscles: ${exercise.primaryMuscles}</p>
            <p>${exercise.instructions}</p>
        `).join('');

            // Send the list of exercises as response
            res.send(`
            <ul>${exercisesHTML}</ul>
        `);
        });
    } catch (error) {
        // Handle error
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});



app.get('/', (req, res) => {
    try {
        // Read the JSON file
        fs.readFile("./dist/exercises.json", 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading file:', err);
                res.status(500).send('Internal Server Error');
                return;
            }

            let searchParam = "";

            // Parse the JSON data
            let jsonData = JSON.parse(data);
            if (req.query.search != null){
                jsonData = jsonData.filter(item => item.name.toLowerCase().includes(req.query.search));
                searchParam = req.query.search;
                }

            // Calculate pagination parameters
            const pageSize = 10; // Number of exercises per page
            const totalPages = Math.ceil(jsonData.length / pageSize);
            let currentPage = parseInt(req.query.page) || 1; // Default to page 1 if not specified
            currentPage = Math.min(Math.max(currentPage, 1), totalPages); // Ensure current page is within valid range

            // Calculate the start and end indices of exercises for the current page
            const startIndex = (currentPage - 1) * pageSize;
            const endIndex = Math.min(startIndex + pageSize, jsonData.length);

            // Extract names, images, and descriptions from the JSON data for the current page
            const exercisesInfo = jsonData.slice(startIndex, endIndex).map(item => ({
                name: item.name,
                images: item.images,
                instructions: item.instructions,
                id: item.id
            }));

            // Generate HTML for each exercise on the current page
            const exercisesHTML = exercisesInfo.map(exercise => `
                <li id="${exercise.name}">
                    <a href="${exercise.id}">
                        <h3>${exercise.name}</h3>
                        <img src="./exercises/${exercise.images[0]}" alt="${exercise.name}">
                        <p>${exercise.instructions}</p>
                    </a>
                </li>
            `).join('');

            // Generate page counter links
            const pageLinks = Array.from({ length: totalPages }, (_, index) => index + 1)
                .map(page => `<a href="/?search=${searchParam}&page=${page}"${page === currentPage ? ' class="active"' : ''}>${page}</a>`)
                .join(' | ');

            // Send the list of exercises for the current page as response
            res.send(`
            Welcome
            <form action=/createUser method=get> 
                <button type=submit>Sign Up</button> 
            </form>
            <form action="/login" method="get">
                <button type="submit">Login</button>
            </form>
            <form action="/search" method="post">
            <input name="search" id="searchbar" class="form-control me-2"
                type="search" placeholder="Search" aria-label="Search">
                <button>Submit</button>
            </form>
            <h1>List of Exercises</h1>
            <ul>${exercisesHTML}</ul>
            <div>
                Pages: ${pageLinks}
            </div>
            `);
        });
    } catch (error) {
        // Handle error
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/search', async (req, res) => {
    var search = req.body.search;
    res.redirect("/?search=" + search);
});


app.get("*", (req, res) => {
    res.status(404);
    res.send("Page not found - 404");
})


app.listen(port, () => {
    console.log("Node application listening on port " + port);
}); 