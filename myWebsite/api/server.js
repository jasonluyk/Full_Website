require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static HTML/CSS/JS files
const path = require('path');
app.use(express.static(path.join(__dirname, '..')));

// MongoDB connection
const mongoUri = process.env.MONGODB_URI;
let db;
let feedbackCollection;

// Connect to MongoDB
async function connectToMongoDB() {
    try {
        const client = new MongoClient(mongoUri);
        await client.connect();
        console.log('Connected to MongoDB');
        
        db = client.db('website');
        feedbackCollection = db.collection('feedback');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
}

connectToMongoDB();

// Email configuration (use environment variables for security)
let transporter;
try {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
    
    // Verify email configuration on startup
    transporter.verify((error, success) => {
        if (error) {
            console.error('Email configuration error:', error);
            console.log('Please check EMAIL_USER and EMAIL_PASS environment variables');
        } else {
            console.log('Email server is ready to send messages');
        }
    });
} catch (error) {
    console.error('Failed to create email transporter:', error);
}

// Alternatively, for other email providers:
// const transporter = nodemailer.createTransport({
//     host: 'smtp.example.com',
//     port: 587,
//     secure: false,
//     auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS
//     }
// });

// Route to handle email submissions
app.post('/send-email', async (req, res) => {
    const { name, email, subject, message } = req.body;

    // Validate input
    if (!name || !email || !subject || !message) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER, // Send to yourself
        replyTo: email,
        subject: `Contact Form: ${subject}`,
        html: `
            <h2>New Contact Form Submission</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Message:</strong></p>
            <p>${message.replace(/\n/g, '<br>')}</p>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Email sent successfully' });
    } catch (error) {
        console.error('Email error:', error);
        res.status(500).json({ error: 'Failed to send email' });
    }
});

// Route to handle suggestion submissions
app.post('/submit-suggestion', async (req, res) => {
    const { name, email, category, suggestion } = req.body;

    // Validate required fields
    if (!category || !suggestion) {
        return res.status(400).json({ error: 'Category and suggestion are required' });
    }

    const newSuggestion = {
        name: name || 'Anonymous',
        email: email || 'Not provided',
        category,
        suggestion,
        createdAt: new Date(),
        status: 'new'
    };

    try {
        const result = await feedbackCollection.insertOne(newSuggestion);
        res.json({ 
            success: true, 
            message: 'Suggestion submitted successfully',
            id: result.insertedId 
        });
    } catch (error) {
        console.error('MongoDB insert error:', error);
        res.status(500).json({ error: 'Failed to save suggestion' });
    }
});

// Route to get all suggestions (optional - for admin view)
app.get('/suggestions', async (req, res) => {
    try {
        const suggestions = await feedbackCollection.find({}).sort({ createdAt: -1 }).toArray();
        res.json(suggestions);
    } catch (error) {
        console.error('MongoDB read error:', error);
        res.status(500).json({ error: 'Failed to retrieve suggestions' });
    }
});

// Route to get suggestion count
app.get('/suggestions/count', async (req, res) => {
    try {
        const count = await feedbackCollection.countDocuments();
        res.json({ count });
    } catch (error) {
        console.error('MongoDB count error:', error);
        res.status(500).json({ error: 'Failed to count suggestions' });
    }
});

// Route to delete a suggestion
app.delete('/suggestions/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const { ObjectId } = require('mongodb');
        const result = await feedbackCollection.deleteOne({ _id: new ObjectId(id) });
        
        if (result.deletedCount === 1) {
            res.json({ success: true, message: 'Suggestion deleted successfully' });
        } else {
            res.status(404).json({ error: 'Suggestion not found' });
        }
    } catch (error) {
        console.error('MongoDB delete error:', error);
        res.status(500).json({ error: 'Failed to delete suggestion' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', database: db ? 'connected' : 'disconnected' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});