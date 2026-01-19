const express = require('express');
const mongoose = require('mongoose');
const app = express();
const PORT = 3000;

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASS = process.env.DB_PASS || 'password';
const APP_VERSION = process.env.APP_VERSION || 'v1'; 

// polaczenie do mongodb
const dbURI = `mongodb://${DB_USER}:${DB_PASS}@${DB_HOST}:27017/admin`;

mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// endpoint 
app.get('/', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'Połączono (MongoDB)' : 'Rozłączono';
  // kolory dla rozroznienia wersji
  const bgColor = APP_VERSION === 'v1' ? '#e0f7fa' : '#e8f5e9'; // niebieski i zielony kolor
  const titleColor = APP_VERSION === 'v1' ? 'blue' : 'green';

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <script src="https://ajax.googleapis.com/ajax/libs/angularjs/1.6.9/angular.min.js"></script>
    <body ng-app="" style="background-color: ${bgColor}; font-family: Arial; text-align: center; padding-top: 50px;">
      <h1 style="color: ${titleColor};">MEAN Stack App (Zadanie 2)</h1>
      
      <div style="border: 1px solid #ccc; padding: 20px; display: inline-block; background: white;">
        <h3>Warstwa AngularJS</h3>
        <p>Wpisz coś: <input type="text" ng-model="name" placeholder="Twoje Imię"></p>
        <p>Witaj, <b>{{name}}</b>!</p>
      </div>

      <hr>
      <h3>Status Systemu:</h3>
      <p><b>Wersja Aplikacji:</b> ${APP_VERSION}</p>
      <p><b>Status Bazy Danych:</b> ${dbStatus}</p>
      <p><b>Pod Hostname:</b> ${require('os').hostname()}</p>
    </body>
    </html>
  `;
  res.send(htmlContent);
});

// --- SONDY ---
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/ready', (req, res) => {
  if (mongoose.connection.readyState === 1) {
    res.status(200).send('Ready');
  } else {
    res.status(500).send('Not Ready');
  }
});

app.listen(PORT, () => {
  console.log(`Mean App running on port ${PORT}`);
});
