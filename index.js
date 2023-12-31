const express = require("express");
const cors = require("cors");
require("dotenv").config();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2xlwfmf.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const classCollection = client.db("academy").collection("classes");
    const myClassCollection = client.db("academy").collection("myClasses");
    const usersCollection = client.db("academy").collection("users");
    const paymentCollection = client.db("academy").collection("payments");


    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.patch('/users/admin/:id',async(req,res)=>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const updatedDoc = {
        $set:{
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })

    app.patch('/users/instructor/:id',async(req,res)=>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const updatedDoc = {
        $set:{
          role: 'instructor'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })

    app.post("/users", async (req, res) => {
      const user = req.body;
      user.role = "student";
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/classes", async (req, res) => {
      const result = await classCollection.find().sort({ createdAt: -1 }).toArray();
      res.send(result);
    });
    
    app.post("/classes", async (req, res) => {
      const classes = req.body;
      classes.status = "pending";
      classes.enrolled = 0;
      classes.createdAt = new Date();
      const result = await classCollection.insertOne(classes);
      res.send(result);
    });

    app.patch('/classes/approve/:id',async(req,res)=>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const updatedDoc = {
        $set:{
          status: 'Approved'
        }
      }
      const result = await classCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })

    app.patch('/classes/deny/:id',async(req,res)=>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const updatedDoc = {
        $set:{
          status: 'deny'
        }
      }
      const result = await classCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })

    app.patch('/classes/feedback/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const message = req.body.message;
      const result = await classCollection.updateOne(filter, {
        $set: {
          feedback: message
        }
      });
      res.send(result);
    });

    app.get('/useRole/:email',async(req,res)=>{
      const email = req.params.email;
      const query = {email: email}
      const result = await usersCollection.findOne(query)
      res.send(result)
    })

    app.get("/instructorClasses/:email", async (req, res) => {
      const instructorEmail = req.params.email;
      const classes = await classCollection.find({ instructorEmail }).toArray();
      res.json(classes);
    });

    app.get('/singleClass/:id',async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await classCollection.findOne(query)
      res.send(result)
    })

    app.patch('/updateClass/:id',async(req,res)=>{
      const id = req.params.id;
      const filter = { _id: new ObjectId(id)}
      const updateClass = req.body;
      const updateDoc = {
        $set: {
          name: updateClass.name,
          image: updateClass.image,
          price: updateClass.price,
          availableSeats: updateClass.availableSeats
        }
      }
      const result = await classCollection.updateOne(filter,updateDoc);
      res.send(result)
    })

    app.get("/approved", async (req, res) => {
      const result = await classCollection
        .find({ status: "Approved" })
        .toArray();
      res.send(result);
    });

    app.get("/topClasses", async (req, res) => {
      const result = await classCollection
        .find({})
        .limit(6)
        .sort({ enrolled: -1 })
        .toArray();
      res.send(result);
    });

    app.post("/myClasses", async (req, res) => {
      const query = req.body;
      const existingRecordMyClasses = await myClassCollection.findOne({
        email: query.email,
        name: query.name,
      });
    
      const existingRecordPayments = await paymentCollection.findOne({
        email: query.email,
        name: query.name,
      });
    
      if (existingRecordMyClasses || existingRecordPayments) {
        return res.status(400).json({ error: "Email and name already exist in payment records." });
      }
    
      const result = await myClassCollection.insertOne(query);
      res.send(result);
    });
    
    

    app.get("/myClasses", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const query = { email: email };
      const result = await myClassCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/myClasses/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await myClassCollection.deleteOne(query);
      res.send(result);
    });

    // all Instructors
    app.get("/instructors", async (req, res) => {
      try {
        const instructors = await classCollection
          .aggregate([
            {
              $group: {
                _id: "$instructorEmail",
                instructor: { $first: "$$ROOT" },
              },
            },
            {
              $replaceRoot: { newRoot: "$instructor" },
            },
          ])
          .toArray();

        res.send(instructors);
      } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.post('/create-payment-intent',async(req,res)=>{
      const {price} = req.body;
      const amount = price*100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency:'usd',
        payment_method_types: ['card']
      });
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })


app.post('/payments', async (req, res) => {
  const payment = req.body;
  const insertResult = await paymentCollection.insertOne(payment);

  const name = payment.name;
  const deleteResult = await myClassCollection.deleteOne({ name: name });

  res.send({ insertedCount: insertResult.insertedCount, deletedCount: deleteResult.deletedCount });
});

  app.get('/payments',async(req,res)=>{
    const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const query = { email: email };
    const result = await paymentCollection.find(query).sort({ date: -1 }).toArray()
    res.send(result)
  })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Athletes is Running");
});

app.listen(port, () => {
  console.log(`Supreme Athlete Academy server is running on port ${port}`);
});
