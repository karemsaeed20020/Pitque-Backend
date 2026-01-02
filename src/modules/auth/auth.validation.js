import joi from 'joi'
import { generalFields } from '../../middlewares/validate.js';


export const signUpVal = joi.object({
    userName: generalFields.name.required(),
    email: generalFields.email.required(),
    password: generalFields.password.required(),
    Cpassword: generalFields.Cpassword.required(),
    mobileNumber: generalFields.mobileNumber.required(),
    gender: joi.string(),
}).required();