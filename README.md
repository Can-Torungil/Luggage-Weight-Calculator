# 🧳 Luggage Weight Calculator

A comprehensive web application that helps travelers calculate luggage weight limits for different airlines, flight classes, and destinations. Built with Firebase authentication and modern web technologies.

## 🌟 Features

### 🔐 User Authentication
- **Dual User Types**: Regular users and administrators with different access levels
- **Firebase Integration**: Secure authentication with email/password
- **Session Management**: Persistent login sessions with localStorage

### ✈️ Flight Configuration
- **Airline Selection**: Support for multiple airlines with specific weight policies
- **Class Selection**: Economy, Business, and First Class options
- **Route Configuration**: Origin and destination country selection
- **Flight Type**: Domestic vs International flight differentiation
- **Trip Direction**: Outbound vs Inbound flight tracking

### 📦 Luggage Management
- **Categorized Items**: 7 main categories for organized packing
  - 👕 **Clothes**: Shirts, pants, jackets, etc.
  - 👟 **Shoes**: Various footwear types
  - 💻 **Electronics**: Laptops, phones, tablets, etc.
  - 🔦 **Accessories**: Watches, umbrellas, etc.
  - 🍎 **Food and Liquid**: Beverages, snacks, etc.
  - 👶 **Baby Items**: Strollers, car seats, etc.
  - 🏕️ **Camping and Travel**: Gear and equipment

### 📊 Analytics & History
- **Usage Statistics**: Track most frequently added items
- **Flight History**: Recent outbound/inbound flights
- **Country Analytics**: Most traveled destinations
- **Policy Violations**: Track weight limit violations
- **Weight Analytics**: Average luggage weights across users

### 👨‍💼 Admin Features
- **Item Management**: Add, modify, or remove items from categories
- **Global Analytics**: System-wide usage statistics
- **Policy Violation Tracking**: Monitor common violations across all airlines

## 🚀 Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection (for Firebase services)
- No additional software installation required

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Can-Torungil/Luggage-Weight-Calculator.git
   cd Luggage-Weight-Calculator
   ```

2. **Open the application**
   - Navigate to the project directory
   - Open `index.html` in your web browser
   - Or use a local web server for better performance

### 🔧 Configuration

The application uses Firebase for backend services. The Firebase configuration is already set up in `firebaseauth.js`:



## 📱 Usage

### 1. **Account Creation/Login**
- Visit the application homepage
- Choose between "User" or "Admin" account type
- Create a new account or log in with existing credentials

### 2. **Configure Your Flight**
- Select your airline from the dropdown
- Choose your flight class (Economy/Business/First)
- Pick origin and destination countries
- Select flight type (Domestic/International)
- Choose trip direction (Outbound/Inbound)

### 3. **Add Luggage Items**
- Click "Add" to open the item selection interface
- Browse through 7 categorized sections
- Click on items to add them to your luggage
- View real-time weight calculations

### 4. **Calculate & Analyze**
- Click "Calculate" to get weight results
- View weight limits vs. your luggage weight
- Check for policy violations
- Access historical data and analytics


## 🔧 Technical Details

### Frontend Technologies
- **HTML5**: Semantic markup and structure
- **CSS3**: Modern styling with flexbox and grid
- **JavaScript (ES6+)**: Dynamic functionality and interactions
- **Ionicons**: Beautiful icon library

### Backend Services
- **Firebase Authentication**: User management and security
- **Firestore Database**: Real-time data storage and synchronization
- **Firebase Analytics**: Usage tracking and insights

### Key Features Implementation
- **Responsive Design**: Mobile-first approach with adaptive layouts
- **Real-time Updates**: Live weight calculations and data synchronization
- **Offline Capability**: Local storage for session management
- **Error Handling**: Comprehensive error messages and validation

## 📊 Database Schema



### Subcollections
- **ItemsUsed**: Track item usage frequency
- **calculationLogs**: Store calculation history



## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- **Can Torungil** - *Initial work* - [Can-Torungil](https://github.com/Can-Torungil)



---

**Happy Traveling! ✈️🧳**

*Made with ❤️ for travelers worldwide*
