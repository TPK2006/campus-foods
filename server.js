require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 6800;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static('uploads'));
app.use('/menu-images', express.static('menu-images'));

mongoose.connect(process.env.MONGODB_URI_CAMPUSEATU, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to CampusEatu MongoDB'))
  .catch(err => console.error('Error connecting to CampusEatu MongoDB:', err));

const ownerSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  restaurantName: { type: String, required: true },
  ownerName: { type: String, required: true },
  restaurantLogo: String,
  category: String,
  address: String,
  landmark: String,
  operatingHours: {
    start: String,
    end: String
  },
  location: {
    type: { type: String, default: 'Point' },
    coordinates: [Number]
  },
  paymentDetails: {
    upiId: { type: String, required: true },
    accountHolderName: { type: String, required: true },
    bankName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    ifscCode: { type: String, required: true }
  }
});

const Owner = mongoose.model('Owner', ownerSchema);

const menuItemSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', required: true },
  name: String,
  price: Number,
  type: String,
  description: String,
  imagePath: String,
  estimatedPreparationTime: Number,
  toppings: [{
    name: String,
    price: Number
  }],
  sizes: [{
    name: String,
    price: Number
  }],
  ratings: [{ type: Number }],
  reviews: [{ 
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: String,
    rating: Number
  }]
});

const MenuItem = mongoose.model('MenuItem', menuItemSchema, 'menu');

const cartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  restaurants: [{
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', required: true },
    items: [{
      menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
      quantity: { type: Number, required: true, min: 1 },
      selectedSize: String,
      selectedToppings: [String],
      additionalInstructions: String,
      totalPrice: { type: Number, required: true },
      isSelected: { type: Boolean, default: true }
    }]
  }],
  deliveryCoordinates: {
    lat: { type: Number },
    lon: { type: Number }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Cart = mongoose.model('Cart', cartSchema);

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const uploadLogo = multer({ storage: logoStorage });

const menuImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'menu-images/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const uploadMenuImage = multer({ storage: menuImageStorage });

const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access denied' });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    res.status(400).json({ message: 'Invalid token' });
  }
};

const partTimeVerifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access denied' });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.partner = verified;
    next();
  } catch (error) {
    res.status(400).json({ message: 'Invalid token' });
  }
};

app.post('/api/check-user', async (req, res) => {
  const { identifier } = req.body;
  try {
    const owner = await Owner.findOne({ $or: [{ email: identifier }, { phoneNumber: identifier }] });
    res.json({ exists: !!owner });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { identifier, password } = req.body;
  try {
    const owner = await Owner.findOne({ $or: [{ email: identifier }, { phoneNumber: identifier }] });
    if (!owner) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const isMatch = await bcrypt.compare(password, owner.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: owner._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, redirect: '/dashboard.html' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/register', uploadLogo.single('restaurantLogo'), async (req, res) => {
  try {
    const { 
      email, 
      phoneNumber, 
      password, 
      restaurantName, 
      ownerName,
      category, 
      address, 
      landmark, 
      operatingHoursStart, 
      operatingHoursEnd, 
      latitude, 
      longitude,
      upiId,
      accountHolderName,
      bankName,
      accountNumber,
      ifscCode
    } = req.body;

    if (!email || !phoneNumber || !password || !restaurantName || !ownerName || !latitude || !longitude || !upiId || !accountHolderName || !bankName || !accountNumber || !ifscCode) {
      return res.status(400).json({ message: 'All required fields must be filled' });
    }

    const existingOwner = await Owner.findOne({ $or: [{ email }, { phoneNumber }] });
    if (existingOwner) {
      return res.status(400).json({ message: 'Email or phone number already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const newOwner = new Owner({
      email,
      phoneNumber,
      password: hashedPassword,
      restaurantName,
      ownerName,
      restaurantLogo: req.file ? `/uploads/${req.file.filename}` : undefined,
      category,
      address,
      landmark,
      operatingHours: {
        start: operatingHoursStart,
        end: operatingHoursEnd
      },
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      },
      paymentDetails: {
        upiId,
        accountHolderName,
        bankName,
        accountNumber,
        ifscCode
      }
    });

    await newOwner.save();
    const token = jwt.sign({ id: newOwner._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.status(201).json({ token, redirect: '/dashboard.html' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/menu', verifyToken, uploadMenuImage.single('image'), async (req, res) => {
  try {
    const { name, price, type, description, toppings, sizes, estimatedPreparationTime } = req.body;
    const imagePath = req.file ? '/menu-images/' + req.file.filename : null;

    const newMenuItem = new MenuItem({
      ownerId: req.user.id,
      name,
      price: parseFloat(price),
      type,
      description,
      imagePath,
      estimatedPreparationTime: parseInt(estimatedPreparationTime),
      toppings: JSON.parse(toppings),
      sizes: JSON.parse(sizes)
    });

    const savedMenuItem = await newMenuItem.save();
    res.status(201).json(savedMenuItem);
  } catch (error) {
    console.error('Error adding menu item:', error);
    res.status(500).json({ message: 'Error adding menu item', error: error.message });
  }
});

app.get('/api/menu', verifyToken, async (req, res) => {
  try {
    const menuItems = await MenuItem.find({ ownerId: req.user.id });
    res.json(menuItems);
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({ message: 'Error fetching menu items' });
  }
});

app.get('/api/menu-item/:id', async (req, res) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id);
    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    res.json(menuItem);
  } catch (error) {
    console.error('Error fetching menu item:', error);
    res.status(500).json({ message: 'Error fetching menu item' });
  }
});

app.patch('/api/menu/:id', verifyToken, uploadMenuImage.single('image'), async (req, res) => {
  try {
    const { name, price, type, description, toppings, sizes, estimatedPreparationTime } = req.body;
    const updateData = {
      name,
      price: parseFloat(price),
      type,
      description,
      estimatedPreparationTime: parseInt(estimatedPreparationTime),
      toppings: JSON.parse(toppings),
      sizes: JSON.parse(sizes)
    };

    if (req.file) {
      updateData.imagePath = '/menu-images/' + req.file.filename;
    }

    const updatedMenuItem = await MenuItem.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.user.id },
      updateData,
      { new: true }
    );
    
    if (!updatedMenuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    res.json(updatedMenuItem);
  } catch (error) {
    console.error('Error updating menu item:', error);
    res.status(500).json({ message: 'Error updating menu item', error: error.message });
  }
});

app.delete('/api/menu/:id', verifyToken, async (req, res) => {
  try {
    const deletedMenuItem = await MenuItem.findOneAndDelete({ _id: req.params.id, ownerId: req.user.id });
    if (!deletedMenuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    res.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    res.status(500).json({ message: 'Error deleting menu item', error: error.message });
  }
});

app.get('/api/menu/count', verifyToken, async (req, res) => {
  try {
    const count = await MenuItem.countDocuments({ ownerId: req.user.id });
    res.json({ count });
  } catch (error) {
    console.error('Error fetching menu items count:', error);
    res.status(500).json({ message: 'Error fetching menu items count', error: error.message });
  }
});

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  ; 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c;
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

const verifyUserToken = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access denied' });

  try {
      const verified = jwt.verify(token, process.env.JWT_SECRET);
      req.user = verified;
      next();
  } catch (error) {
      res.status(400).json({ message: 'Invalid token' });
  }
};

app.get('/api/restaurants', verifyUserToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.userLat || !user.userLon) {
      return res.status(400).json({ message: 'User location not available' });
    }

    const restaurants = await Owner.find({}, '_id restaurantName restaurantLogo category location');
    
    const restaurantsWithDistance = restaurants.map(restaurant => {
      const distance = getDistanceFromLatLonInKm(
        user.userLat,user.userLon,
        restaurant.location.coordinates[1],
        restaurant.location.coordinates[0]
      );
      return {
        ...restaurant.toObject(),
        distance: parseFloat(distance.toFixed(2))
      };
    });

    const sortedRestaurants = restaurantsWithDistance.sort((a, b) => a.distance - b.distance);

    res.json(sortedRestaurants);
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    res.status(500).json({ message: 'Error fetching restaurants', error: error.message });
  }
});

app.get('/api/restaurant/:id/menu', async (req, res) => {
  try {
    const restaurantId = req.params.id;
    const menuItems = await MenuItem.find({ ownerId: restaurantId });
    res.json(menuItems);
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({ message: 'Error fetching menu items', error: error.message });
  }
});

app.get('/api/restaurant/:id', async (req, res) => {
  try {
    const restaurantId = req.params.id;
    const restaurant = await Owner.findById(restaurantId, 'restaurantName category');
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }
    res.json(restaurant);
  } catch (error) {
    console.error('Error fetching restaurant details:', error);
    res.status(500).json({ message: 'Error fetching restaurant details', error: error.message });
  }
});

app.get('/api/owner/profile', verifyToken, async (req, res) => {
  try {
    const owner = await Owner.findById(req.user.id).select('-password');
    if (!owner) {
      return res.status(404).json({ message: 'Owner not found' });
    }
    res.json(owner);
  } catch (error) {
    console.error('Error fetching owner profile:', error);
    res.status(500).json({ message: 'Error fetching owner profile', error: error.message });
  }
});

app.patch('/api/owner/profile', verifyToken, uploadLogo.single('restaurantImage'), async (req, res) => {
  try {
    const { 
      email, 
      phoneNumber, 
      restaurantName, 
      ownerName,
      category, 
      address, 
      landmark, 
      operatingHoursStart, 
      operatingHoursEnd, 
      latitude, 
      longitude,
      upiId,
      accountHolderName,
      bankName,
      accountNumber,
      ifscCode
    } = req.body;

    const updateData = {
      email,
      phoneNumber,
      restaurantName,
      ownerName,
      category,
      address,
      landmark,
      operatingHours: {
        start: operatingHoursStart,
        end: operatingHoursEnd
      },
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      },
      paymentDetails: {
        upiId,
        accountHolderName,
        bankName,
        accountNumber,
        ifscCode
      }
    };

    if (req.file) {
      updateData.restaurantLogo = `/uploads/${req.file.filename}`;
    }

    const updatedOwner = await Owner.findByIdAndUpdate(req.user.id, updateData, { new: true }).select('-password');
    if (!updatedOwner) {
      return res.status(404).json({ message: 'Owner not found' });
    }
    res.json(updatedOwner);
  } catch (error) {
    console.error('Error updating owner profile:', error);
    res.status(500).json({ message: 'Error updating owner profile', error: error.message });
  }
});

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  phoneNumber: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  addresses: [{
      manual: String,
      auto: String
  }],
  userLat: { type: Number },
  userLon: { type: Number }
});

const User = mongoose.model('User', userSchema);

const partTimeSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  uidNo: { type: String, required: true, unique: true },
  cuEmail: { type: String, required: true, unique: true },
  personalEmail: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profilePic: String,
  idCardPhoto: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  totalDeliveries: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 }, // New field
  totalEarnings: { type: Number, default: 0 },
  currentBalance: { type: Number, default: 0 },
  currentLat: { type: Number },
  currentLon: { type: Number }
});

const PartTimeDeliveryPartner = mongoose.model('PartTimeDeliveryPartner', partTimeSchema);

const partTimeStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const uploadPartTime = multer({ storage: partTimeStorage });

app.post('/api/partTime/register', uploadPartTime.fields([
    { name: 'profilePic', maxCount: 1 },
    { name: 'idCardPhoto', maxCount: 1 }
]), async (req, res) => {
    try {
        const { fullName, uidNo, cuEmail, personalEmail, password } = req.body;

        const existingPartner = await PartTimeDeliveryPartner.findOne({
            $or: [{ uidNo }, { cuEmail }, { personalEmail }]
        });

        if (existingPartner) {
            return res.status(400).json({ message: 'User already exists with this UID, CU email, or personal email' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const newPartner = new PartTimeDeliveryPartner({
            fullName,
            uidNo,
            cuEmail,
            personalEmail,
            password: hashedPassword,
            profilePic: req.files['profilePic'] ? `/uploads/${req.files['profilePic'][0].filename}` : undefined,
            idCardPhoto: `/uploads/${req.files['idCardPhoto'][0].filename}`
        });

        await newPartner.save();
        res.status(201).json({ message: 'Registration successful. Please wait for account verification.' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.post('/api/partTime/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;

        const partner = await PartTimeDeliveryPartner.findOne({
            $or: [{ cuEmail: identifier }, { personalEmail: identifier }]
        });

        if (!partner) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        if (!partner.isVerified) {
            return res.status(400).json({ message: 'Account is not verified yet' });
        }

        const isMatch = await bcrypt.compare(password, partner.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: partner._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.get('/api/partTime/profile', partTimeVerifyToken, async (req, res) => {
  try {
    const partner = await PartTimeDeliveryPartner.findById(req.partner.id)
      .select('-password');
    
    if (!partner) {
      return res.status(404).json({ message: 'Partner not found' });
    }
    
    res.json(partner);
  } catch (error) {
    console.error('Error fetching partner profile:', error);
    res.status(500).json({ message: 'Error fetching partner profile' });
  }
});

app.post('/api/user/register', async (req, res) => {
  try {
      const { fullName, phoneNumber, email, password } = req.body;

      if (!fullName || !phoneNumber || !email || !password) {
          return res.status(400).json({ message: 'All fields are required' });
      }

      const existingUser = await User.findOne({ $or: [{ email }, { phoneNumber }] });
      if (existingUser) {
          return res.status(400).json({ message: 'User already exists with this email or phone number' });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const newUser = new User({
          fullName,
          phoneNumber,
          email,
          password: hashedPassword
      });

      await newUser.save();
      res.status(201).json({ message: 'User registered successfully', redirect: '/user_auth.html' });
  } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/user/login', async (req, res) => {
    try {
        const { phoneNumber, password } = req.body;

        const user = await User.findOne({ phoneNumber });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.get('/api/user/profile', verifyUserToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/user/addresses', verifyUserToken, async (req, res) => {
  try {
      const user = await User.findById(req.user.id);
      res.json(user.addresses);
  } catch (error) {
      console.error('Error fetching addresses:', error);
      res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/user/addresses', verifyUserToken, async (req, res) => {
  try {
      const { address_manual, address_auto } = req.body;
      const user = await User.findById(req.user.id);
      user.addresses.push({
          manual: address_manual,
          auto: address_auto
      });
      await user.save();
      res.status(201).json(user.addresses);
  } catch (error) {
      console.error('Error adding address:', error);
      res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/user/addresses/:index', verifyUserToken, async (req, res) => {
  try {
      const index = parseInt(req.params.index);
      const user = await User.findById(req.user.id);
      user.addresses.splice(index, 1);
      await user.save();
      res.json(user.addresses);
  } catch (error) {
      console.error('Error deleting address:', error);
      res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/user/addresses/:index', verifyUserToken, async (req, res) => {
  try {
    const index = parseInt(req.params.index);
    const { address_manual, address_auto } = req.body;
    const user = await User.findById(req.user.id);
    
    if (index < 0 || index >= user.addresses.length) {
      return res.status(400).json({ message: 'Invalid address index' });
    }

    user.addresses[index] = {
      manual: address_manual || user.addresses[index].manual,
      auto: address_auto || user.addresses[index].auto
    };

    await user.save();
    res.json(user.addresses);
  } catch (error) {
    console.error('Error updating address:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/user/location', verifyUserToken, async (req, res) => {
  try {
    const { lat, lon } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { userLat: lat, userLon: lon } },
      { new: true }
    );
    res.json({ message: 'Location updated successfully' });
  } catch (error) {
    console.error('Error updating user location:', error);
    res.status(500).json({ message: 'Error updating user location' });
  }
});

app.post('/api/cart', verifyUserToken, async (req, res) => {
  try {
    const { menuItemId, quantity, selectedSize, selectedToppings, additionalInstructions, totalPrice } = req.body;
    const userId = req.user.id;

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({ userId, restaurants: [] });
    }

    const menuItem = await MenuItem.findById(menuItemId);
    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    const restaurantIndex = cart.restaurants.findIndex(r => r.restaurantId.toString() === menuItem.ownerId.toString());

    if (restaurantIndex > -1) {
      const existingItemIndex = cart.restaurants[restaurantIndex].items.findIndex(item => 
        item.menuItem.toString() === menuItemId &&
        item.selectedSize === selectedSize &&
        JSON.stringify(item.selectedToppings) === JSON.stringify(selectedToppings)
      );

      if (existingItemIndex > -1) {
        cart.restaurants[restaurantIndex].items[existingItemIndex].quantity += quantity;
        cart.restaurants[restaurantIndex].items[existingItemIndex].totalPrice += totalPrice;
      } else {
        cart.restaurants[restaurantIndex].items.push({
          menuItem: menuItemId,
          quantity,
          selectedSize,
          selectedToppings,
          additionalInstructions,
          totalPrice,
          isSelected: true
        });
      }
    } else {
      cart.restaurants.push({
        restaurantId: menuItem.ownerId,
        items: [{
          menuItem: menuItemId,
          quantity,
          selectedSize,
          selectedToppings,
          additionalInstructions,
          totalPrice,
          isSelected: true
        }]
      });
    }

    cart.updatedAt = Date.now();
    await cart.save();
    res.status(201).json(cart);
  } catch (error) {
    console.error('Error adding item to cart:', error);
    res.status(500).json({ message: 'Error adding item to cart', error: error.message });
  }
});

app.get('/api/cart', verifyUserToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      console.error('User not found:', userId);
      return res.status(404).json({ message: 'User not found' });
    }
    const cart = await Cart.findOne({ userId })
      .populate({
        path: 'restaurants.restaurantId',
        select: 'restaurantName category location'
      })
      .populate('restaurants.items.menuItem');
    
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    // Calculate delivery fees for each restaurant
    const cartWithDeliveryFees = {
      ...cart.toObject(),
      restaurants: await Promise.all(cart.restaurants.map(async (restaurant) => {
        const restaurantDetails = await Owner.findById(restaurant.restaurantId);
        const restaurantLocation = restaurantDetails.location.coordinates;
        const distance = getDistanceFromLatLonInKm(
          user.userLat, user.userLon,
          restaurantLocation[1], restaurantLocation[0]
        );
        const deliveryFee = distance * 1000 * 0.02; // 0.02 rupees per meter
        return {
          ...restaurant.toObject(),
          distance: parseFloat(distance.toFixed(2)),
          deliveryFee: parseFloat(deliveryFee.toFixed(2))
        };
      }))
    };

    res.json(cartWithDeliveryFees);
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ message: 'Error fetching cart', error: error.message });
  }
});

app.patch('/api/cart/item/:restaurantId/:itemId', verifyUserToken, async (req, res) => {
  try {
    const { restaurantId, itemId } = req.params;
    const { increment, newQuantity, newTotalPrice, isSelected } = req.body;
    const userId = req.user.id;

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    const restaurantIndex = cart.restaurants.findIndex(r => r.restaurantId.toString() === restaurantId);
    if (restaurantIndex === -1) {
      return res.status(404).json({ message: 'Restaurant not found in cart' });
    }

    const itemIndex = cart.restaurants[restaurantIndex].items.findIndex(item => item._id.toString() === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }

    if (increment !== undefined) {
      cart.restaurants[restaurantIndex].items[itemIndex].quantity += increment ? 1 : -1;
      cart.restaurants[restaurantIndex].items[itemIndex].quantity = Math.max(cart.restaurants[restaurantIndex].items[itemIndex].quantity, 1);
    } else if (newQuantity !== undefined) {
      cart.restaurants[restaurantIndex].items[itemIndex].quantity = newQuantity;
    }

    if (newTotalPrice !== undefined) {
      cart.restaurants[restaurantIndex].items[itemIndex].totalPrice = newTotalPrice;
    }

    if (isSelected !== undefined) {
      cart.restaurants[restaurantIndex].items[itemIndex].isSelected = isSelected;
    }

    cart.updatedAt = Date.now();
    await cart.save();

    res.json(cart);
  } catch (error) {
    console.error('Error updating cart item:', error);
    res.status(500).json({ message: 'Error updating cart item', error: error.message });
  }
});

app.post('/api/cart/update-delivery-fees', verifyUserToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { lat, lon } = req.body;

    const cart = await Cart.findOne({ userId })
      .populate({
        path: 'restaurants.restaurantId',
        select: 'restaurantName category location'
      })
      .populate('restaurants.items.menuItem');
    
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    // Calculate delivery fees for each restaurant
    const cartWithDeliveryFees = {
      ...cart.toObject(),
      restaurants: await Promise.all(cart.restaurants.map(async (restaurant) => {
        const restaurantDetails = await Owner.findById(restaurant.restaurantId);
        const restaurantLocation = restaurantDetails.location.coordinates;
        const distance = getDistanceFromLatLonInKm(
          lat, lon,
          restaurantLocation[1], restaurantLocation[0]
        );
        const deliveryFee = distance * 1000 * 0.02; // 0.02 rupees per meter
        return {
          ...restaurant.toObject(),
          distance: parseFloat(distance.toFixed(2)),
          deliveryFee: parseFloat(deliveryFee.toFixed(2))
        };
      }))
    };

    res.json(cartWithDeliveryFees);
  } catch (error) {
    console.error('Error updating delivery fees:', error);
    res.status(500).json({ message: 'Error updating delivery fees', error: error.message });
  }
});

app.patch('/api/cart/item/:restaurantId/:itemId/customize', verifyUserToken, async (req, res) => {
  try {
    const { restaurantId, itemId } = req.params;
    const { selectedSize, selectedToppings, additionalInstructions } = req.body;
    const userId = req.user.id;

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    const restaurantIndex = cart.restaurants.findIndex(r => r.restaurantId.toString() === restaurantId);
    if (restaurantIndex === -1) {
      return res.status(404).json({ message: 'Restaurant not found in cart' });
    }

    const itemIndex = cart.restaurants[restaurantIndex].items.findIndex(item => item._id.toString() === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }

    const item = cart.restaurants[restaurantIndex].items[itemIndex];
    item.selectedSize = selectedSize || item.selectedSize;
    item.selectedToppings = selectedToppings || item.selectedToppings;
    item.additionalInstructions = additionalInstructions || item.additionalInstructions;

    // Recalculate the total price based on the new customizations
    const menuItem = await MenuItem.findById(item.menuItem);
    let newPrice = menuItem.price;

    if (selectedSize) {
      const size = menuItem.sizes.find(s => s.name === selectedSize);
      if (size) {
        newPrice = size.price;
      }
    }

    if (selectedToppings) {
      selectedToppings.forEach(topping => {
        const toppingItem = menuItem.toppings.find(t => t.name === topping);
        if (toppingItem) {
          newPrice += toppingItem.price;
        }
      });
    }

    item.totalPrice = newPrice * item.quantity;

    cart.updatedAt = Date.now();
    await cart.save();

    res.json(cart);
  } catch (error) {
    console.error('Error customizing cart item:', error);
    res.status(500).json({ message: 'Error customizing cart item', error: error.message });
  }
});

app.delete('/api/cart/item/:restaurantId/:itemId', verifyUserToken, async (req, res) => {
  try {
    const { restaurantId, itemId } = req.params;
    const userId = req.user.id;

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    const restaurantIndex = cart.restaurants.findIndex(r => r.restaurantId.toString() === restaurantId);
    if (restaurantIndex === -1) {
      return res.status(404).json({ message: 'Restaurant not found in cart' });
    }

    const itemIndex = cart.restaurants[restaurantIndex].items.findIndex(item => item._id.toString() === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }

    cart.restaurants[restaurantIndex].items.splice(itemIndex, 1);

    // If the restaurant has no more items, remove the entire restaurant entry
    if (cart.restaurants[restaurantIndex].items.length === 0) {
      cart.restaurants.splice(restaurantIndex, 1);
    }

    cart.updatedAt = Date.now();
    await cart.save();

    res.json(cart);
  } catch (error) {
    console.error('Error removing cart item:', error);
    res.status(500).json({ message: 'Error removing cart item', error: error.message });
  }
});

app.get('/api/cart/check', verifyUserToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const cart = await Cart.findOne({ userId });
    res.json({ hasCart: !!cart });
  } catch (error) {
    console.error('Error checking cart:', error);
    res.status(500).json({ message: 'Error checking cart', error: error.message });
  }
});

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', required: true },
  items: [{
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    quantity: { type: Number, required: true },
    selectedSize: String,
    selectedToppings: [String],
    additionalInstructions: String,
    totalPrice: { type: Number, required: true }
  }],
  subtotal: { type: Number, required: true },
  deliveryFee: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  deliveryAddress: {
    manual: String,
    auto: String
  },
  contactNumber: { type: String, required: true },
  orderNotes: String,
  deliveryOption: { type: String, enum: ['delivery', 'pickup'], required: true },
  specificTime: Date,
  status: { type: String, enum: ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled', 'ready', 'completed'], default: 'pending' },
  readyAt: Date,
  completedAt: Date,
  createdAt: { type: Date, default: Date.now },
  maxPrepTime: { type: Number, required: true },
  orderAcceptedBy: { type: String, default: 'Not Accepted' },
  verificationCode: { type: String, default: null } // New field for verification code
});
const Order = mongoose.model('Order', orderSchema);

// Add schema for storing completed order timestamps
const completedOrderSchema = new mongoose.Schema({
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'PartTimeDeliveryPartner', required: true },
  orderId: { type: String, required: true },
  completedAt: { type: Date, required: true }
});

const CompletedOrder = mongoose.model('CompletedOrder', completedOrderSchema);

app.post('/api/orders', verifyUserToken, async (req, res) => {
  try {
    const { 
      restaurants, 
      totalAmount, 
      deliveryAddress, 
      contactNumber, 
      orderNotes, 
      deliveryOption, 
      specificTime,
      maxPrepTime
    } = req.body;

    const orders = [];

    for (const restaurant of restaurants) {
      const newOrder = new Order({
        userId: req.user.id,
        restaurantId: restaurant.restaurantId,
        items: restaurant.items,
        subtotal: restaurant.subtotal,
        deliveryFee: restaurant.deliveryFee,
        totalAmount: restaurant.subtotal + restaurant.deliveryFee,
        deliveryAddress,
        contactNumber,
        orderNotes,
        deliveryOption,
        specificTime: specificTime ? new Date(specificTime) : undefined,
        status: 'pending',
        maxPrepTime
      });

      const savedOrder = await newOrder.save();
      orders.push(savedOrder);
    }

    // Remove only the selected items from the user's cart
    const cart = await Cart.findOne({ userId: req.user.id });
    if (cart) {
      cart.restaurants = cart.restaurants.map(restaurant => ({
        ...restaurant,
        items: restaurant.items.filter(item => !item.isSelected)
      })).filter(restaurant => restaurant.items.length > 0);

      if (cart.restaurants.length > 0) {
        await cart.save();
      } else {
        await Cart.findOneAndDelete({ userId: req.user.id });
      }
    }

    res.status(201).json(orders);
  } catch (error) {
    console.error('Error creating orders:', error);
    res.status(500).json({ message: 'Error creating orders', error: error.message });
  }
});

app.get('/api/orders', verifyToken, async (req, res) => {
  try {
    const orders = await Order.find({ restaurantId: req.user.id })
      .populate('userId', 'fullName')
      .populate('items.menuItem', 'name')
      .sort({ 
        status: 1,
        readyAt: -1,
        createdAt: -1
      });

    const ordersWithPartnerNames = await Promise.all(orders.map(async (order) => {
      if (order.orderAcceptedBy && order.orderAcceptedBy !== 'Not Accepted') {
        const partner = await PartTimeDeliveryPartner.findById(order.orderAcceptedBy);
        return {
          ...order.toObject(),
          partnerName: partner ? partner.fullName : 'Unknown'
        };
      }
      return order.toObject();
    }));

    res.json(ordersWithPartnerNames);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Error fetching orders', error: error.message });
  }
});

// Update the order status endpoint
app.patch('/api/orders/:orderId/status', verifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    let updateData = { status };

    // Add timestamps based on status
    if (status === 'ready') {
      updateData.readyAt = new Date();
    } else if (status === 'completed') {
      updateData.completedAt = new Date();
      
      // Store completed order in partTimeDeliveryPartners collection
      const order = await Order.findById(orderId);
      if (order && order.orderAcceptedBy) {
        await CompletedOrder.create({
          partnerId: order.orderAcceptedBy,
          orderId: order._id,
          completedAt: new Date()
        });
      }
    }

    const order = await Order.findOneAndUpdate(
      { _id: orderId, restaurantId: req.user.id },
      updateData,
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Error updating order status', error: error.message });
  }
});

// Add this new endpoint to fetch user orders
app.get('/api/user/orders', verifyUserToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const orders = await Order.find({ userId })
      .populate('restaurantId', 'restaurantName')
      .populate('items.menuItem', 'name')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ message: 'Error fetching user orders', error: error.message });
  }
});

// Add this new endpoint for part-time delivery partners to cancel orders
app.post('/api/partTime/orders/:orderId/cancel', partTimeVerifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const partnerId = req.partner.id;

    const order = await Order.findOne({ _id: orderId, orderAcceptedBy: partnerId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found or not assigned to you' });
    }

    if (order.status === 'out_for_delivery') {
      return res.status(400).json({ message: 'Cannot cancel an order that is out for delivery' });
    }

    order.orderAcceptedBy = 'Not Accepted';
    order.status = 'pending';
    await order.save();

    res.json({ message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ message: 'Error cancelling order' });
  }
});

// Update this endpoint to fetch available orders for part-time delivery partners
app.get('/api/partTime/available-orders', partTimeVerifyToken, async (req, res) => {
  try {
    const partner = await PartTimeDeliveryPartner.findById(req.partner.id);
    if (!partner) {
      return res.status(404).json({ message: 'Partner not found' });
    }

    // Fetch orders with status 'preparing' or 'ready' and not yet accepted by any delivery partner
    const orders = await Order.find({
      status: { $in: ['preparing', 'ready'] },
      orderAcceptedBy: 'Not Accepted'
    })
      .populate('restaurantId', 'restaurantName location')
      .populate('userId', 'addresses')
      .populate('items.menuItem');

    // Calculate distances and format response
    const ordersWithDetails = orders.map(order => {
      const restaurantLocation = order.restaurantId.location.coordinates;
      const destinationCoords = order.deliveryAddress.auto.split(',').map(Number);
      
      const distanceToRestaurant = getDistanceFromLatLonInKm(
        partner.currentLat || 0,
        partner.currentLon || 0,
        restaurantLocation[1],
        restaurantLocation[0]
      );

      const distanceToDestination = getDistanceFromLatLonInKm(
        restaurantLocation[1],
        restaurantLocation[0],
        destinationCoords[0],
        destinationCoords[1]
      );

      const readyTime = new Date(order.readyAt || Date.now());
      readyTime.setMinutes(readyTime.getMinutes() - 5);

      const deliveryTime = new Date(order.specificTime || Date.now());
      deliveryTime.setMinutes(deliveryTime.getMinutes() - 5);

      return {
        orderId: order._id,
        restaurantName: order.restaurantId.restaurantName,
        restaurantDistance: parseFloat(distanceToRestaurant.toFixed(2)),
        destinationDistance: parseFloat(distanceToDestination.toFixed(2)),
        pickupTime: readyTime,
        deliveryTime: deliveryTime,
        earnings: order.deliveryFee
      };
    });

    res.json(ordersWithDetails);
  } catch (error) {
    console.error('Error fetching available orders:', error);
    res.status(500).json({ message: 'Error fetching available orders' });
  }
});

// Update this endpoint for part-time delivery partners to mark an order as delivered
app.patch('/api/partTime/orders/:orderId/status', partTimeVerifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, verificationCode } = req.body;
    const partnerId = req.partner.id;

    const order = await Order.findOne({ _id: orderId, orderAcceptedBy: partnerId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found or not assigned to you' });
    }

    if (status === 'picked_up') {
      order.status = 'out_for_delivery';
    } else if (status === 'delivered') {
      // Check if the verification code matches
      if (order.verificationCode !== verificationCode) {
        return res.status(400).json({ message: 'Invalid verification code' });
      }
      order.status = 'completed';
      order.completedAt = new Date();

      // Update partner statistics
      const partner = await PartTimeDeliveryPartner.findById(partnerId);
      partner.totalDeliveries += 1;
      partner.totalOrders += 1;
      partner.totalEarnings += order.deliveryFee;
      partner.currentBalance += order.deliveryFee;
      await partner.save();
    } else {
      return res.status(400).json({ message: 'Invalid status update' });
    }

    await order.save();

    res.json({ message: 'Order status updated successfully' });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Error updating order status' });
  }
});

// Add this new endpoint to fetch partner statistics
app.get('/api/partTime/statistics', partTimeVerifyToken, async (req, res) => {
  try {
    const partner = await PartTimeDeliveryPartner.findById(req.partner.id)
      .select('totalDeliveries totalOrders totalEarnings currentBalance');
    
    if (!partner) {
      return res.status(404).json({ message: 'Partner not found' });
    }
    
    res.json(partner);
  } catch (error) {
    console.error('Error fetching partner statistics:', error);
    res.status(500).json({ message: 'Error fetching partner statistics' });
  }
});



// Update this endpoint to fetch accepted orders for part-time delivery partners
app.get('/api/partTime/accepted-orders', partTimeVerifyToken, async (req, res) => {
  try {
    const partnerId = req.partner.id;
    const orders = await Order.find({
      orderAcceptedBy: partnerId,
      status: { $in: ['preparing', 'ready', 'out_for_delivery'] }
    })
      .populate('restaurantId', 'restaurantName location')
      .populate('userId', 'fullName')
      .populate('items.menuItem');

    const partner = await PartTimeDeliveryPartner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({ message: 'Partner not found' });
    }

    const ordersWithDetails = orders.map(order => {
      const restaurantLocation = order.restaurantId.location.coordinates;
      const destinationCoords = order.deliveryAddress.auto.split(',').map(Number);

      // Calculate distances
      const distanceToRestaurant = getDistanceFromLatLonInKm(
        partner.currentLat || 0,
        partner.currentLon || 0,
        restaurantLocation[1],
        restaurantLocation[0]
      );

      const distanceToDestination = getDistanceFromLatLonInKm(
        restaurantLocation[1],
        restaurantLocation[0],
        destinationCoords[0],
        destinationCoords[1]
      );

      return {
        orderId: order._id,
        restaurantName: order.restaurantId.restaurantName,
        userName: order.userId.fullName,
        contactNumber: order.contactNumber,
        restaurantDistance: parseFloat(distanceToRestaurant.toFixed(2)), // Added this
        destinationDistance: parseFloat(distanceToDestination.toFixed(2)),
        pickupTime: order.readyAt,
        deliveryTime: order.specificTime,
        earnings: order.deliveryFee,
        status: order.status,
        items: order.items.map(item => ({
          name: item.menuItem.name,
          quantity: item.quantity
        }))
      };
    });

    res.json(ordersWithDetails);
  } catch (error) {
    console.error('Error fetching accepted orders:', error);
    res.status(500).json({ message: 'Error fetching accepted orders' });
  }
});



// Add this new endpoint for part-time delivery partners to accept orders
app.post('/api/partTime/orders/:orderId/accept', partTimeVerifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const partnerId = req.partner.id;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.orderAcceptedBy !== 'Not Accepted') {
      return res.status(400).json({ message: 'Order already accepted by another partner' });
    }

    // Generate a 4-digit random code
    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();

    order.orderAcceptedBy = partnerId;
    order.verificationCode = verificationCode;
    await order.save();

    // Update partner statistics
    const partner = await PartTimeDeliveryPartner.findById(partnerId);
    partner.totalOrders += 1;
    await partner.save();

    res.json({ message: 'Order accepted successfully', verificationCode });
  } catch (error) {
    console.error('Error accepting order:', error);
    res.status(500).json({ message: 'Error accepting order' });
  }
});

// Update this endpoint for part-time delivery partners to mark an order as delivered
app.patch('/api/partTime/orders/:orderId/status', partTimeVerifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, verificationCode } = req.body;
    const partnerId = req.partner.id;

    const order = await Order.findOne({ _id: orderId, orderAcceptedBy: partnerId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found or not assigned to you' });
    }

    if (status === 'picked_up') {
      order.status = 'out_for_delivery';
    } else if (status === 'delivered') {
      // Check if the verification code matches
      if (order.verificationCode !== verificationCode) {
        return res.status(400).json({ message: 'Invalid verification code' });
      }
      order.status = 'completed';
      order.completedAt = new Date();

      // Update partner statistics
      const partner = await PartTimeDeliveryPartner.findById(partnerId);
      partner.totalDeliveries += 1;
      partner.totalEarnings += order.deliveryFee;
      partner.currentBalance += order.deliveryFee;
      await partner.save();
    } else {
      return res.status(400).json({ message: 'Invalid status update' });
    }

    await order.save();

    res.json({ message: 'Order status updated successfully' });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Error updating order status' });
  }
});





// Update this endpoint for part-time delivery partners to cancel orders
app.post('/api/partTime/orders/:orderId/cancel', partTimeVerifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const partnerId = req.partner.id;

    const order = await Order.findOne({ _id: orderId, orderAcceptedBy: partnerId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found or not assigned to you' });
    }

    if (order.status === 'out_for_delivery') {
      return res.status(400).json({ message: 'Cannot cancel an order that is out for delivery' });
    }

    order.orderAcceptedBy = 'Not Accepted';
    order.status = 'pending';
    await order.save();

    // Update partner statistics
    const partner = await PartTimeDeliveryPartner.findById(partnerId);
    partner.totalOrders -= 1;
    await partner.save();

    res.json({ message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ message: 'Error cancelling order' });
  }
});

// Update the endpoint to fetch completed orders history
app.get('/api/partTime/completed-orders', partTimeVerifyToken, async (req, res) => {
  try {
    const completedOrders = await Order.find({
      orderAcceptedBy: req.partner.id,
      status: 'completed'
    })
      .sort({ completedAt: -1 })
      .limit(50); // Limit to last 50 orders

    const ordersWithDetails = completedOrders.map(order => ({
      orderId: order._id,
      completedAt: order.completedAt,
      earnings: order.deliveryFee
    }));

    res.json(ordersWithDetails);
  } catch (error) {
    console.error('Error fetching completed orders:', error);
    res.status(500).json({ message: 'Error fetching completed orders' });
  }
});


app.post('/api/partTime/redeem', partTimeVerifyToken, async (req, res) => {
  try {
    const { amount } = req.body;
    const partnerId = req.partner.id;

    const partner = await PartTimeDeliveryPartner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({ message: 'Partner not found' });
    }

    if (amount < 100 || amount > partner.currentBalance) {
      return res.status(400).json({ message: 'Invalid redeem amount' });
    }

    partner.currentBalance -= amount;
    await partner.save();

    res.json({ message: 'Redeem successful', newBalance: partner.currentBalance });
  } catch (error) {
    console.error('Error redeeming earnings:', error);
    res.status(500).json({ message: 'Error redeeming earnings' });
  }
});





app.use(express.static('public'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
