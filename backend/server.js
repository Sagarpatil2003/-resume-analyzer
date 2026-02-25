const express = require("express");
const cors = require("cors");
const multer = require("multer");
var morgan = require('morgan')
const dotenv = require("dotenv");

// Only require this once!
const analyzerRouter = require('./routers/analyzer'); 

dotenv.config();

let app = express();

// Middleware
app.use(cors());
app.use(morgan("dev"));
app.use(express.json()); 


// Your routes
app.use('/analyzer', analyzerRouter); // This makes the route: http://localhost:5000/analyzer/

app.listen(process.env.PORT || 5000, () => {
    console.log('app running...');
});
