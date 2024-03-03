const express = require("express");
const router = express.Router();
var ObjectID = require("mongodb").ObjectId;
const UserInquiry = require("../../models/UserInquiry")
const FoodPantry = require("../../models/FoodPantry")
const User = require("../../models/User")

const nodemailer = require("nodemailer")
require('dotenv').config();
const axios = require("axios")

router.get("/fetch/user/:email", async (req, res) => {
    const existingUser = await User.findOne({authEmail: req.params.email})
    if (existingUser) {
        return res.status(200).json(existingUser)
    } else {
        return res.status(404).json({message: "no such user exists"})
    }
})

router.post("/create/user", async (req, res) => {
    const authEmail = req.body.authEmail
    const existingUser = await User.findOne({authEmail: authEmail})
    if (existingUser) {
        return res.status(400).json({message: "user already exists"})
    }
    const newUser = new User(req.body);
    await newUser.save();
    return res.status(200).json(newUser);
})

router.put("/update/user/profile/:authEmail", async (req, res) => {
    const authEmail = req.params.authEmail;
    const existingUser = await User.findOne({authEmail : authEmail});

    if (existingUser) {
        const updatedUserProfile = await User.findByIdAndUpdate(
            existingUser._id,
            req.body,
            {new: true}
        )
        if (!updatedUserProfile) {
            return res.status(404).json({message: "user update failed. Please try again"})
        }
        return res.status(200).json(updatedUserProfile);
    } else {
        return res.status(404).json({message: "User is not found. An update to user profile cannot be made."})
    }
})

router.get("/fetch/pantries/:zipcode", async (req, res) => {
    const zipcode = 92805
    const googleAPIUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${zipcode}&key=AIzaSyCrTJq2oQHQqqGZKB4jTrwpGkCPvZ4Z2Ak`
    const countyResult = await axios.get(googleAPIUrl)
    console.log(JSON.stringify(countyResult.data.results))
    const temp = countyResult.data.results
    const components = temp[0].address_components
    var foundCounty = ""
    for (var i = 0; i < components.length; i++) {
        var locationObject = components[i]
        if (locationObject.types.includes("administrative_area_level_2")) {
            foundCounty = locationObject.long_name
            break;
        }
    }
    console.log("County is " + foundCounty)
    //const foodPantryCounty = req.params.county
    const foodPantries = await FoodPantry.find({county: foundCounty})
    if (foodPantries.length === 0 || foodPantries === null || foodPantries === undefined) {
        return res.status(404).send({message: "food pantries by county not found "});
    }
    return res.status(200).json(foodPantries)
})

router.post("/create/food/bank", async (req, res) => {
    const existingAddress = req.body.address 
    const existingFoodPantry = await FoodPantry.findOne({address: existingAddress});

    if (existingFoodPantry) {
        return res.status(400).json({messaage: "Food pantry exists. Please try another one"})
    } else {
        const newFoodPantry = new FoodPantry(req.body);
        await newFoodPantry.save();
        return res.status(200).json(newFoodPantry);
    }
})

router.post("/subscribe/foodbank", async (req, res) => {
    const {foodBankEmail, firstName, lastName, userEmail, userPhoneNumber, message } = req.body
    const timestamp = new Date()
    const timestampFormatted = timestamp.toUTCString()
    const newInquiry = new UserInquiry({
        foodBankEmail: foodBankEmail,
        firstName: firstName,
        lastName: lastName,
        userEmail: userEmail,
        userPhoneNumber: userPhoneNumber,
        message: message,
        timestamp: timestamp
    })

    try {
        await newInquiry.save()
        console.log(process.env.OAUTH_CLIENTID)
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                type: "OAuth2",
                user: userEmail,
                clientId: "28930876920-cqdk4q1cu8o2cfojqlgc2ammvfddfqhb.apps.googleusercontent.com",
                clientSecret: "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",
                refreshToken: "1//042LAnYC_urVLCgYIARAAGAQSNwF-L9Ir-kHvnL0Wfjnahib-2-4rgmtsHjsEvcQlNvDUqtdP1plIoeysA2qz0cfqNfps11WBYJs"
            }
        }) 
        const mailOptions = {
            from: userEmail,
            to: foodBankEmail,
            subject: `${firstName} ${lastName} has subscribed to your food bank`,
            html: `<strong>First Name:</strong> ${firstName}<br>` +
                  `<strong>Last Name:</strong> ${lastName}<br>` +
                  `<strong>Email:</strong> ${userEmail}<br>` +
                  `<strong>Phone Number:</strong> ${userPhoneNumber}<br>` +
                  `<strong>message:</strong> ${message}<br><br>` +
                  `<strong>Time Submitted:</strong> ${timestampFormatted}`
        };
        await transporter.sendMail(mailOptions)
        return res.status(200).send("You have successfully subscribed to this food bank")
    } catch(error) {
        console.log(error)
        return res.status(500).send("Subscription to food bank has failed")
    }
})

module.exports = router;