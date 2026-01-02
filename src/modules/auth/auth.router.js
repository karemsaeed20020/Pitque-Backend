import express from 'express';
import { uploadSingleFile } from '../../utils/fileUpload/multer-cloud.js';
import { validate } from '../../middlewares/validate.js';
import { signUpVal } from './auth.validation.js';
import * as authControllers from './auth.controllers.js';


const authRouter = express.Router();

authRouter.post('/signup', uploadSingleFile("image"), validate(signUpVal), authControllers.signup)




export default authRouter;