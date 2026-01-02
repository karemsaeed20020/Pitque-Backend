import express from 'express';
import { uploadSingleFile } from '../../utils/fileUpload/multer-cloud.js';
import { validate } from '../../middlewares/validate.js';
import { signInVal, signUpVal } from './auth.validation.js';
import {isAuthenticated} from '../../middlewares/auth.js';
import * as authControllers from './auth.controllers.js';


const authRouter = express.Router();

authRouter.post('/signup', uploadSingleFile("image"), validate(signUpVal), authControllers.signup);
authRouter.get('/verify/:token', authControllers.verifyAccount);
authRouter.post('/login', validate(signInVal),authControllers.logIn);
authRouter.put("/forgetPass", authControllers.forgetPassword);
authRouter.post("/verifyOtp", authControllers.verifyOtp);
authRouter.post("/logout", isAuthenticated, authControllers.logout);





export default authRouter;