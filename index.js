const express = require('express');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

// Your wger API token
const API_TOKEN = '99c85ff786bb388090f1de86bd2049c0b2ab81ae';

// Endpoint URL
const apiUrl = 'https://wger.de/api/v2/';

app.get('/', async (req, res) => {
    try {
        // Make a request to the wger API to get a list of exercises
        const exercisesResponse = await axios.get(apiUrl + 'exercise/?language=2&limit=1000', {
            headers: {
                'Authorization': `Token ${API_TOKEN}`
            }
        });

        // Make a request to the wger API to get a list of muscles
        const musclesResponse = await axios.get(apiUrl + 'muscle/', {
            headers: {
                'Authorization': `Token ${API_TOKEN}`
            }
        });

        // Extract the list of exercises and muscles from the response data
        const exercises = exercisesResponse.data.results;
        const muscles = musclesResponse.data.results;

        // Render the main page with the list of exercises and muscles
        let html = `
            <h1>List of Exercises</h1>
            <ul>
                ${exercises.map(exercise => `<li>${exercise.name}</li>`).join('')}
            </ul>
            <h1>List of Muscles</h1>
            <ul>
                ${muscles.map(muscle => `
                    <li>
                        <strong>${muscle.name}</strong>
                        <ul>
                            <li>ID: ${muscle.id}</li>
                            <li>English Name: ${muscle.name_en}</li>
                            <li>Front Muscle: ${muscle.is_front ? 'Yes' : 'No'}</li>
                            <li>Main Image: <img src="https://wger.de${muscle.image_url_main}" alt="${muscle.name}"></li>
                            <li>Secondary Image: <img src="https://wger.de${muscle.image_url_secondary}" alt="${muscle.name}"></li>
                        </ul>
                    </li>
                `).join('')}
            </ul>
        `;

        res.send(html);
    } catch (error) {
        // Handle error
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(port, () => {
    console.log("Node application listening on port " + port);
});
