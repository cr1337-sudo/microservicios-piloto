const Router = require("express").Router;
const router = new Router();
const Product = require("../models/Product");
const amqp = require("amqplib");

let order, channel, connection;

// Connect to RabbitMQ
async function connectToRabbitMQ() {
  const amqpServer = "amqp://guest:guest@localhost:5672";
  connection = await amqp.connect(amqpServer);
  channel = await connection.createChannel();
  await channel.assertQueue("product-service-queue");
}
connectToRabbitMQ();

// Create a new product
router.post("/", async (req, res) => {
  const { name, price, description } = req.body;
  if (!name || !price || !description) {
    return res.status(400).json({
      message: "Please provide name, price and description",
    });
  }
  const product = await new Product({ ...req.body });
  await product.save();
  return res.status(201).json({
    message: "Product created successfully",
    product,
  });
});

router.get("/", async (req,res)=>{
    const products = await Product.find()
    return res.json(products)
})

// Buy a product
router.post("/buy", async (req, res) => {
  const { productIds } = req.body;
  const products = await Product.find({ _id: { $in: productIds } });

  console.log(products)
  if(products.length === 0){
    return res.status(403).json({
        error: "No hay productos"
    })
  }
  // Send order to RabbitMQ order queue
  channel.sendToQueue(
    "order-service-queue",
    Buffer.from(
      JSON.stringify({
        products
      })
    )
  );

  // Consume previously placed order from RabbitMQ & acknowledge the transaction
  channel.consume("product-service-queue", (data) => {
    console.log("Consumed from product-service-queue");
    order = JSON.parse(data.content);
    channel.ack(data);
  });

  // Return a success message
  return res.status(201).json({
    message: "Order placed successfully",
    order,
  });
});

module.exports = router;
