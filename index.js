import express, { json } from "express";
import { bootstrap } from "./src/modules/bootstrap.js";

const app = express();

const port = process.env.PORT || 3000;

// Body parsing middleware
app.use(json());

bootstrap(app);


app.listen(port, () => {
  console.log(`App is listing on PORT ${port}`);
});
