const express = require('express');
const cors = require('cors');
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2xlwfmf.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    
    const classCollection = client.db('academy').collection('classes')
    const myClassCollection = client.db('academy').collection('myClasses')

    app.get('/classes',async(req,res)=>{
        const result = await classCollection.find().toArray()
        res.send(result)
    })

    app.get('/approved',async(req,res)=>{
        const result = await classCollection.find({status:"Approved"}).toArray()
        res.send(result)
    })
    
    app.get('/topClasses',async(req,res)=>{
        const result = await classCollection.find({}).limit(6).sort({enrolled: -1}).toArray()
        res.send(result)
    })

    app.post('/myClasses', async (req, res) => {
      const query = req.body;
      const existingRecord = await myClassCollection.findOne({ email: query.email, name: query.name });
      if (existingRecord) {
        return res.status(400).json({ error: 'Email and name already exist.' });
      }
      const result = await myClassCollection.insertOne(query);
      res.send(result);
    });

    // all Instructors 
    app.get('/instructors', async (req, res) => {
        try {
          const instructors = await classCollection.aggregate([
            {
              $group: {
                _id: "$instructorEmail",
                instructor: { $first: "$$ROOT" }
              }
            },
            {
              $replaceRoot: { newRoot: "$instructor" }
            }
          ]).toArray();
      
          res.send(instructors);
        } catch (error) {
          console.error(error);
          res.status(500).send("Internal Server Error");
        }
      });
      

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/',(req,res)=>{
    res.send('Athletes is Running')
})

app.listen(port,()=>{
    console.log(`Supreme Athlete Academy server is running on port ${port}`)
})