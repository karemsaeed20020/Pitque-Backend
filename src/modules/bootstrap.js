import { dbConnection } from "../../database/dbConnection.js";
import { AppError } from "../utils/catch-error.js";
import { globalError } from "../utils/global-error.js";
import * as allRouter from './index.js';

export const bootstrap = (app) => {
  process.on("uncaughtException", (err) => {
    console.log("ERROR in code: ", err);
  });

  dbConnection();

  // Routes
  app.use("/auth", allRouter.authRouter);

  app.use((req, res, next) => {
    next(new AppError(`Route Not Found ${req.originalUrl}`, 404));
  });
  app.use(globalError);

  process.on("unhandledRejection", (err) => {
    console.log("ERROR: ", err);
  });
};
