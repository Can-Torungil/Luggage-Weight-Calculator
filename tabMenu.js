/*
================================================================================
                    AIRLINE LUGGAGE CALCULATOR - MAIN APPLICATION
================================================================================

This is the main JavaScript file for the Airline Luggage Calculator application.
It handles all functionality including:
- Firebase integration for data storage and authentication
- Tab management and UI interactions
- Object management and weight calculations
- History tracking and analytics
- File uploads and admin functionality

================================================================================
                                FIREBASE SETUP
================================================================================
This section imports Firebase modules and initializes the Firebase app.
Firebase is used for:
- User authentication (login/logout)
- Database operations (storing/retrieving data)
- File storage (uploading images)
*/

// Import Firebase modules for different services

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, getDocs, setDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js";

// Firebase configuration object - contains all necessary credentials
// This connects the app to the specific Firebase project
const firebaseConfig = {
    apiKey: "AIzaSyB1UukH_IAKPtZEMz7EVAb-JlRCKrmpQ8c",
    authDomain: "cs-ia-ct.firebaseapp.com",
    projectId: "cs-ia-ct",
    storageBucket: "cs-ia-ct.appspot.com",
    messagingSenderId: "691153045688",
    appId: "1:691153045688:web:b6512a0d1a7f93fb9bcc4d",
    measurementId: "G-F61EZJCHZV"
};

// Initialize Firebase services
const app = initializeApp(firebaseConfig);  // Initialize the Firebase app
const auth = getAuth();                     // Get authentication service
const db = getFirestore();                  // Get Firestore database service
const storage = getStorage();               // Get Firebase Storage service

/*
================================================================================
                            GLOBAL STATE VARIABLES
================================================================================
These variables maintain the application state throughout the user session.
They track user selections and manage the current state of the application.
*/

// Array to store objects that user has added to their luggage
// Each object contains: {id, name, weight, count, category, imageUrl}
let addedObjects = [];

// Variables to store user's current selections from dropdowns and radio buttons
let selectedAirline = null;           // Currently selected airline
let selectedClass = null;             // Currently selected class (Economy, Business, etc.)
let selectedFlightType = null;        // Domestic or International
let selectedTripType = null;          // Outbound or Inbound
let currentAirlineDomCountry = null;  // Domestic country for the selected airline

/*
================================================================================
                            UTILITY FUNCTIONS
================================================================================
These are helper functions used throughout the application.
*/

// Global function to navigate back to the login page
// This is attached to window object so it can be called from HTML onclick events
window.goBack = function () {
    window.location.href = "index.html";
};

// WeakSet to prevent multiple initializations of the same container
// This prevents event listeners from being added multiple times to the same element
const initialized = new WeakSet();

/*
================================================================================
                            TAB MANAGEMENT SYSTEM
================================================================================
This section handles all tab-related functionality including:
- Main navigation tabs (Calculator, History, Admin)
- Nested tabs within sections
- Segment tabs for object categories
- Tab switching logic and content updates
*/

// Initialize the main navigation tabs (Calculator, History, Admin)
// This function sets up click handlers for switching between main sections
function initTopLevelTabs(container) {
    // Prevent multiple initializations of the same container
    if (initialized.has(container)) return;
    initialized.add(container);

    // Get all tab elements and their corresponding content areas
    const tabs = container.querySelectorAll(".tab-bar .tabs [data-tab-target]");
    const tabContents = container.querySelectorAll(".tab-content > [data-tab-content]");

    // Add click event listeners to each tab
    tabs.forEach(tab => {
        tab.addEventListener("click", async () => {
            // SECURITY: Prevent non-admin users from accessing admin tab
            // Check if tab is admin tab but user doesn't have admin privileges
            if (tab.classList.contains('admin-tab') && !tab.classList.contains('show-admin')) {
                console.log('Prevented non-admin user from accessing admin tab');
                return;
            }
            
            // Get the target content area for this tab
            const target = container.querySelector(tab.dataset.tabTarget);
            
            // Remove active class from all tabs and content areas
            tabs.forEach(t => t.classList.remove("active"));
            tabContents.forEach(tc => tc.classList.remove("active"));
            
            // Add active class to clicked tab and its content
            tab.classList.add("active");
            if (target) target.classList.add("active");
            
            // SPECIAL BEHAVIOR: Update history data when history tab is clicked
            if (tab.dataset.tabTarget === "#history") {
                try {
                    await updateHistoryDisplay(); // Fetch and display user's calculation history
                } catch (error) {
                    console.error("Error updating history display:", error);
                }
            }
            
            // SPECIAL BEHAVIOR: Update analytics data when analytics tab is clicked
            console.log('Tab clicked:', tab.dataset.tabTarget);
            if (tab.dataset.tabTarget === "#analytics") {
                console.log('Analytics tab detected - calling updateAnalyticsDisplay');
                try {
                    await updateAnalyticsDisplay(); // Fetch and display analytics for all users
                } catch (error) {
                    console.error("Error updating analytics display:", error);
                }
            }
        });
    });
}

// Initialize nested tabs within the "Admin" section (Modify, Analytics)
// These are sub-tabs that appear when the Admin main tab is selected
function initNestedTabs(container) {
    // Prevent multiple initializations of the same container
    if (initialized.has(container)) return;
    initialized.add(container);

    // Get nested tab elements and their content areas
    // Note: nested tabs are inside the admin section, so we look for .nested-tabs
    const tabs = container.querySelectorAll(".nested-tabs .tab[data-tab-target]");
    const tabContents = container.parentElement.querySelectorAll(".nested-tab-content [data-tab-content]");

    // Add click event listeners to each nested tab
    tabs.forEach(tab => {
        tab.addEventListener("click", async (e) => {
            // Prevent event bubbling to parent elements
            e.stopPropagation();
            
            // Get the target content area for this nested tab
            const target = container.parentElement.querySelector(tab.dataset.tabTarget);
            
            // Remove active class from all nested tabs and their content
            tabs.forEach(t => t.classList.remove("active"));
            tabContents.forEach(tc => tc.classList.remove("active"));
            
            // Add active class to clicked nested tab and its content
            tab.classList.add("active");
            if (target) target.classList.add("active");
            
            // SPECIAL BEHAVIOR: Update analytics when analytics nested tab is clicked
            console.log('Nested tab clicked:', tab.dataset.tabTarget);
            if (tab.dataset.tabTarget === "#analytics") {
                console.log('Analytics nested tab detected - calling updateAnalyticsDisplay');
                try {
                    await updateAnalyticsDisplay(); // Fetch analytics data for all users
                } catch (error) {
                    console.error("Error updating analytics display:", error);
                }
            }
        });
    });
}

// Initialize segment tabs within the "Add Segment" panel
// These tabs organize objects by categories (Clothes, Shoes, Electronics, etc.)
function initSegmentTabs() {
    // Get all segment tab elements and their content areas
    const segmentTabs = document.querySelectorAll(".segment-tabs .segment-tab[data-tab-target]");
    const segmentTabContents = document.querySelectorAll(".segment-tab-content [data-tab-content]");

    // DEFAULT STATE: Ensure "Clothes" tab is active when the panel opens
    // This provides a consistent starting point for users
    const clothesTab = document.querySelector('[data-tab-target="#clothes"]');
    const clothesContent = document.querySelector('#clothes[data-tab-content]');
    
    if (clothesTab && clothesContent) {
        // Remove active class from all tabs and content
        segmentTabs.forEach(t => t.classList.remove("active"));
        segmentTabContents.forEach(tc => tc.classList.remove("active"));
        // Set clothes tab as active by default
        clothesTab.classList.add("active");
        clothesContent.classList.add("active");
    }

    // Add click event listeners to each segment tab
    segmentTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            // Get the target content area for this segment tab
            const target = document.querySelector(tab.dataset.tabTarget);
            
            // Remove active class from all segment tabs and content
            segmentTabs.forEach(t => t.classList.remove("active"));
            segmentTabContents.forEach(tc => tc.classList.remove("active"));
            
            // Add active class to clicked segment tab and its content
            tab.classList.add("active");
            if (target) target.classList.add("active");
        });
    });
    
    // INITIALIZATION SEQUENCE: Set up all the data and functionality
    populateSegmentTabs();        // Load objects from database and display them
    populateModifySegmentTabs();  // Load objects for the admin modify section
    initModifySegmentTabs();      // Set up modify tab functionality
}

/*
================================================================================
                            OBJECT MANAGEMENT SYSTEM
================================================================================
This section handles all object-related functionality including:
- Creating and managing object counters
- Fetching objects from the database
- Displaying objects in different categories
- Handling object selection and counting
- Image management and fallback handling
*/

// Create HTML for object counter controls (up/down arrows and count display)
// This generates the interactive counter interface for each object
function createCounterGroup(objectId, name, weight, initialCount = 0) {
    return `
        <div class="counter-group" data-object-id="${objectId}" data-name="${name}" data-weight="${weight}">
            <ion-icon name="arrow-down-outline" class="counter-arrow down"></ion-icon>
            <span class="counter-value">${initialCount}</span>
            <ion-icon name="arrow-up-outline" class="counter-arrow up"></ion-icon>
        </div>
    `;
}

// FALLBACK IMAGE SYSTEM: Backup image URLs for when Firestore images fail to load
// This ensures the UI always shows an image even if the database image is unavailable
// Each object type has a corresponding Unsplash image as a fallback
const fallbackImages = {
    Phone: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9",
    Tablet: "https://images.unsplash.com/photo-1527697834460-5e01fc4b7b10",
    Laptop: "https://images.unsplash.com/photo-1496181133206-80ce9b88a7a0",
    iPhone: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9",
    iPad: "https://images.unsplash.com/photo-1527697834460-5e01fc4b7b10",
    MacBook: "https://images.unsplash.com/photo-1496181133206-80ce9b88a7a0",
    Charger: "https://images.unsplash.com/photo-1609592806598-ef25b0cbb05a",
    TShirt: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab",
    Sweater: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105",
    Jeans: "https://images.unsplash.com/photo-1542272604-787c3835535d",
    Hoodie: "https://images.unsplash.com/photo-1556821840-3a63f95609a7",
    FullSuit: "https://images.unsplash.com/photo-1593030761757-71fae45fa0e7",
    PajamaSet: "https://images.unsplash.com/photo-1441986300917-64674bd600d8",
    Underwear: "https://images.unsplash.com/photo-1441986300917-64674bd600d8",
    LightJacket: "https://images.unsplash.com/photo-1551028719-00167b16eac5",
    HeavyJacket: "https://images.unsplash.com/photo-1544966503-7cc5ac882d5f",
    WoolCoat: "https://images.unsplash.com/photo-1544966503-7cc5ac882d5f",
    Skirt: "https://images.unsplash.com/photo-1551163943-3f6a855d1153",
    SportShoe: "https://images.unsplash.com/photo-1542291026-7eec264c27ff",
    SnowBoot: "https://images.unsplash.com/photo-1549298916-b41d501d3772",
    PlatformShoes: "https://images.unsplash.com/photo-1549298916-b41d501d3772",
    ClimbingShoes: "https://images.unsplash.com/photo-1549298916-b41d501d3772",
    Jordans: "https://images.unsplash.com/photo-1556906781-9a412961c28c",
    Crocs: "https://images.unsplash.com/photo-1549298916-b41d501d3772",
    Watch: "https://images.unsplash.com/photo-1524592094714-0f0654e20314",
    Umbrella: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64",
    Hairbrush: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64",
    WaterBottle: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64",
    TurkishAirlines: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64"
};

// MAIN OBJECT LOADER: Fetch objects from Firestore database and populate the segment tabs
// This is the core function that loads all available objects and organizes them by category
// It handles database queries, image loading, and UI population
async function populateSegmentTabs() {
    try {
        console.log("=== populateSegmentTabs() started ===");
        // Get reference to the "objects" collection in Firestore database
        const objectsCol = collection(db, "objects");
        console.log("Collection reference created");
        
        const objectSnapshot = await getDocs(objectsCol);
        console.log("Firestore query completed, snapshot:", objectSnapshot);
        
        const groupedObjects = {};

        console.log("Fetching objects from Firestore...");
        if (objectSnapshot.empty) {
            console.log("No objects found in Firestore, using fallback data...");
            const fallbackData = [
                // Electronics
                { id: "iphone", name: "iPhone", weight: 0.2, category: "electronics", image: fallbackImages.iPhone },
                { id: "ipad", name: "iPad", weight: 0.5, category: "electronics", image: fallbackImages.iPad },
                { id: "macbook", name: "MacBook", weight: 1.5, category: "electronics", image: fallbackImages.MacBook },
                { id: "charger", name: "Charger", weight: 0.1, category: "electronics", image: fallbackImages.Charger },
                
                // Clothes
                { id: "tshirt", name: "T-Shirt", weight: 0.2, category: "clothes", image: fallbackImages.TShirt },
                { id: "sweater", name: "Sweater", weight: 0.4, category: "clothes", image: fallbackImages.Sweater },
                { id: "jeans", name: "Jeans", weight: 0.5, category: "clothes", image: fallbackImages.Jeans },
                { id: "hoodie", name: "Hoodie", weight: 0.6, category: "clothes", image: fallbackImages.Hoodie },
                { id: "fullSuit", name: "Full Suit", weight: 0.8, category: "clothes", image: fallbackImages.FullSuit },
                { id: "pajamaSet", name: "Pajama Set", weight: 0.3, category: "clothes", image: fallbackImages.PajamaSet },
                { id: "underwear", name: "Underwear", weight: 0.1, category: "clothes", image: fallbackImages.Underwear },
                { id: "lightJacket", name: "Light Jacket", weight: 0.7, category: "clothes", image: fallbackImages.LightJacket },
                { id: "heavyJacket", name: "Heavy Jacket", weight: 1.2, category: "clothes", image: fallbackImages.HeavyJacket },
                { id: "woolCoat", name: "Wool Coat", weight: 1.0, category: "clothes", image: fallbackImages.WoolCoat },
                { id: "skirt", name: "Skirt", weight: 0.3, category: "clothes", image: fallbackImages.Skirt },
                
                // Shoes
                { id: "sportShoe", name: "Sport Shoes", weight: 0.8, category: "shoes", image: fallbackImages.SportShoe },
                { id: "snowBoot", name: "Snow Boots", weight: 1.2, category: "shoes", image: fallbackImages.SnowBoot },
                { id: "platformShoes", name: "Platform Shoes", weight: 0.9, category: "shoes", image: fallbackImages.PlatformShoes },
                { id: "climbingShoes", name: "Climbing Shoes", weight: 0.6, category: "shoes", image: fallbackImages.ClimbingShoes },
                { id: "jordans", name: "Jordan Shoes", weight: 1.0, category: "shoes", image: fallbackImages.Jordans },
                { id: "crocs", name: "Crocs", weight: 0.4, category: "shoes", image: fallbackImages.Crocs },
                
                // Accessories
                { id: "watch", name: "Watch", weight: 0.1, category: "accessories", image: fallbackImages.Watch },
                { id: "umbrella", name: "Umbrella", weight: 0.3, category: "accessories", image: fallbackImages.Umbrella },
                { id: "hairbrush", name: "Hairbrush", weight: 0.1, category: "accessories", image: fallbackImages.Hairbrush },
                { id: "waterBottle", name: "Water Bottle", weight: 0.5, category: "accessories", image: fallbackImages.WaterBottle },
                
                // Food and Liquid
                { id: "turkishAirlines", name: "Turkish Airlines", weight: 0.1, category: "food-liquid", image: fallbackImages.TurkishAirlines },
                
                // Baby Items (using available images as placeholders)
                { id: "babyClothes", name: "Baby Clothes", weight: 0.2, category: "baby-items", image: fallbackImages.TShirt },
                { id: "babyToys", name: "Baby Toys", weight: 0.3, category: "baby-items", image: fallbackImages.WaterBottle },
                
                // Camping and Travel (using available images as placeholders)
                { id: "tent", name: "Tent", weight: 2.0, category: "camping-travel", image: fallbackImages.Umbrella },
                { id: "sleepingBag", name: "Sleeping Bag", weight: 1.5, category: "camping-travel", image: fallbackImages.PajamaSet }
            ];

            fallbackData.forEach(data => {
                const category = data.category.toLowerCase();
                if (!groupedObjects[category]) {
                    groupedObjects[category] = [];
                }
                groupedObjects[category].push(data);
            });
        } else {
            objectSnapshot.forEach(doc => {
                const data = doc.data();
                const category = data.category.toLowerCase();
                if (!groupedObjects[category]) {
                    groupedObjects[category] = [];
                }
                groupedObjects[category].push({
                    id: doc.id,
                    ...data
                });
            });
        }

        console.log("Grouped objects:", groupedObjects);

        // Populate each category tab
        Object.keys(groupedObjects).forEach(category => {
            const tabContent = document.getElementById(category);
            if (tabContent) {
                const objects = groupedObjects[category];
                const objectRows = [];
                
                // Group objects into rows of 3
                for (let i = 0; i < objects.length; i += 3) {
                    const rowObjects = objects.slice(i, i + 3);
                    const rowHTML = rowObjects.map(obj => {
                        // Use the exact image path from Firestore
                        let imageSrc = obj.image || obj.imageUrl;
                        
                        // Debug logging
                        console.log(`Object: ${obj.name}, Image path from Firestore: ${imageSrc}`);
                        
                        // If no image path from Firestore, try fallback
                        if (!imageSrc) {
                            // Try to find a fallback image based on the object name
                            const fallbackKey = obj.name.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
                            imageSrc = fallbackImages[fallbackKey] || fallbackImages[obj.name];
                            console.log(`Using fallback image for ${obj.name}: ${imageSrc}`);
                        }
                        
                        // If still no image, use a generic placeholder
                        if (!imageSrc) {
                            imageSrc = 'Images/placeholder.jpg'; // You can add a placeholder image
                            console.log(`Using placeholder for ${obj.name}`);
                        }
                        
                        return `
                        <div class="object-item">
                            <img src="${imageSrc}" alt="${obj.name}" class="transparent-object" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                            <div class="image-fallback" style="display: none;">${obj.name}</div>
                            <div class="object-name">${obj.name}</div>
                            ${createCounterGroup(obj.id, obj.name, obj.weight)}
                        </div>
                    `;
                    }).join('');
                    objectRows.push(`<div class="object-row">${rowHTML}</div>`);
                }
                
                tabContent.innerHTML = objectRows.join('');
            }
        });

        // Add event listeners to counter arrows
        addCounterEventListeners();
        
        // Display initial state of added objects
        displayAddedObjects();

    } catch (error) {
        console.error("Error populating segment tabs:", error);
    }
}

// Populate modify segment tabs with objects (display only, no adding)
async function populateModifySegmentTabs() {
    try {
        console.log("=== populateModifySegmentTabs() started ===");
        const objectsCol = collection(db, "objects");
        console.log("Collection reference created for modify tabs");
        
        const objectSnapshot = await getDocs(objectsCol);
        console.log("Firestore query completed for modify tabs, snapshot:", objectSnapshot);
        
        const groupedObjects = {};

        console.log("Fetching objects from Firestore for modify tabs...");
        if (objectSnapshot.empty) {
            console.log("No objects found in Firestore for modify tabs, using fallback data...");
            const fallbackData = [
                // Electronics
                { id: "iphone", name: "iPhone", weight: 0.2, category: "electronics", image: fallbackImages.iPhone },
                { id: "ipad", name: "iPad", weight: 0.5, category: "electronics", image: fallbackImages.iPad },
                { id: "macbook", name: "MacBook", weight: 1.5, category: "electronics", image: fallbackImages.MacBook },
                { id: "charger", name: "Charger", weight: 0.1, category: "electronics", image: fallbackImages.Charger },
                
                // Clothes
                { id: "tshirt", name: "T-Shirt", weight: 0.2, category: "clothes", image: fallbackImages.TShirt },
                { id: "sweater", name: "Sweater", weight: 0.4, category: "clothes", image: fallbackImages.Sweater },
                { id: "jeans", name: "Jeans", weight: 0.5, category: "clothes", image: fallbackImages.Jeans },
                { id: "hoodie", name: "Hoodie", weight: 0.6, category: "clothes", image: fallbackImages.Hoodie },
                { id: "fullSuit", name: "Full Suit", weight: 0.8, category: "clothes", image: fallbackImages.FullSuit },
                { id: "pajamaSet", name: "Pajama Set", weight: 0.3, category: "clothes", image: fallbackImages.PajamaSet },
                { id: "underwear", name: "Underwear", weight: 0.1, category: "clothes", image: fallbackImages.Underwear },
                { id: "lightJacket", name: "Light Jacket", weight: 0.7, category: "clothes", image: fallbackImages.LightJacket },
                { id: "heavyJacket", name: "Heavy Jacket", weight: 1.2, category: "clothes", image: fallbackImages.HeavyJacket },
                { id: "woolCoat", name: "Wool Coat", weight: 1.0, category: "clothes", image: fallbackImages.WoolCoat },
                { id: "skirt", name: "Skirt", weight: 0.3, category: "clothes", image: fallbackImages.Skirt },
                
                // Shoes
                { id: "sportShoe", name: "Sport Shoes", weight: 0.8, category: "shoes", image: fallbackImages.SportShoe },
                { id: "snowBoot", name: "Snow Boots", weight: 1.2, category: "shoes", image: fallbackImages.SnowBoot },
                { id: "platformShoes", name: "Platform Shoes", weight: 0.9, category: "shoes", image: fallbackImages.PlatformShoes },
                { id: "climbingShoes", name: "Climbing Shoes", weight: 0.6, category: "shoes", image: fallbackImages.ClimbingShoes },
                { id: "jordans", name: "Jordan Shoes", weight: 1.0, category: "shoes", image: fallbackImages.Jordans },
                { id: "crocs", name: "Crocs", weight: 0.4, category: "shoes", image: fallbackImages.Crocs },
                
                // Accessories
                { id: "watch", name: "Watch", weight: 0.1, category: "accessories", image: fallbackImages.Watch },
                { id: "umbrella", name: "Umbrella", weight: 0.3, category: "accessories", image: fallbackImages.Umbrella },
                { id: "hairbrush", name: "Hairbrush", weight: 0.1, category: "accessories", image: fallbackImages.Hairbrush },
                { id: "waterBottle", name: "Water Bottle", weight: 0.5, category: "accessories", image: fallbackImages.WaterBottle },
                
                // Food and Liquid
                { id: "turkishAirlines", name: "Turkish Airlines", weight: 0.1, category: "food-liquid", image: fallbackImages.TurkishAirlines },
                
                // Baby Items
                { id: "babyClothes", name: "Baby Clothes", weight: 0.2, category: "baby-items", image: fallbackImages.TShirt },
                { id: "babyToys", name: "Baby Toys", weight: 0.3, category: "baby-items", image: fallbackImages.WaterBottle },
                
                // Camping and Travel
                { id: "tent", name: "Tent", weight: 2.0, category: "camping-travel", image: fallbackImages.Umbrella },
                { id: "sleepingBag", name: "Sleeping Bag", weight: 1.5, category: "camping-travel", image: fallbackImages.PajamaSet }
            ];

            fallbackData.forEach(data => {
                const category = data.category.toLowerCase();
                if (!groupedObjects[category]) {
                    groupedObjects[category] = [];
                }
                groupedObjects[category].push(data);
            });
        } else {
            objectSnapshot.forEach(doc => {
                const data = doc.data();
                const category = data.category.toLowerCase();
                if (!groupedObjects[category]) {
                    groupedObjects[category] = [];
                }
                groupedObjects[category].push({
                    id: doc.id,
                    ...data
                });
            });
        }

        console.log("Grouped objects for modify tabs:", groupedObjects);

        // Populate each category tab
        Object.keys(groupedObjects).forEach(category => {
            const tabContent = document.getElementById(`modify-${category}`);
            if (tabContent) {
                const objects = groupedObjects[category];
                console.log(`Populating modify-${category} with ${objects.length} objects`);
                
                const objectsHTML = objects.map(obj => {
                    return `
                        <div class="modify-object-item" data-object-id="${obj.id}">
                            <div class="modify-object-name">${obj.name}</div>
                            <div class="modify-object-image">
                                <img src="${obj.image}" alt="${obj.name}" class="transparent-object">
                            </div>
                            <div class="modify-object-details">
                                <label class="modify-custom-field">
                                    <input type="number" class="modify-weight-input" value="${obj.weight}" data-object-id="${obj.id}" step="0.1" placeholder=" " />
                                    <span class="modify-placeholder">Weight</span>
                                    <div class="custom-spinner">
                                        <div class="spinner-btn up" data-action="increment">▲</div>
                                        <div class="spinner-btn down" data-action="decrement">▼</div>
                                    </div>
                                </label>
                                <select class="modify-category-select" data-object-id="${obj.id}">
                                    <option value="electronics" ${obj.category === 'electronics' ? 'selected' : ''}>Electronics</option>
                                    <option value="clothes" ${obj.category === 'clothes' ? 'selected' : ''}>Clothes</option>
                                    <option value="shoes" ${obj.category === 'shoes' ? 'selected' : ''}>Shoes</option>
                                    <option value="accessories" ${obj.category === 'accessories' ? 'selected' : ''}>Accessories</option>
                                    <option value="food-liquid" ${obj.category === 'food-liquid' ? 'selected' : ''}>Food and Liquid</option>
                                    <option value="baby-items" ${obj.category === 'baby-items' ? 'selected' : ''}>Baby Items</option>
                                    <option value="camping-travel" ${obj.category === 'camping-travel' ? 'selected' : ''}>Camping and Travel</option>
                                </select>
                            </div>
                        </div>
                    `;
                }).join('');
                
                // Create upload box for this category
                const uploadBoxHTML = `
                    <div class="modify-object-item modify-upload-box" data-category="${category}">
                        <div class="modify-object-name">Add New Object</div>
                        <div class="modify-object-image">
                            <div class="upload-area" onclick="triggerFileUpload('${category}')">
                                <ion-icon name="cloud-upload-outline"></ion-icon>
                                <span class="upload-text">Upload Image</span>
                                <span class="upload-subtext">Select a .jpg image</span>
                            </div>
                            <input type="file" id="file-input-${category}" class="hidden-file-input" accept=".jpg,.jpeg" onchange="handleFileUpload(event, '${category}')">
                        </div>
                        <div class="modify-object-details">
                            <div class="upload-inputs-container-centered">
                                <label class="upload-custom-field">
                                    <input type="text" class="upload-name-input" placeholder=" " data-category="${category}" />
                                    <span class="upload-placeholder">Name</span>
                                </label>
                                <label class="upload-custom-field">
                                    <input type="number" class="upload-weight-input" step="0.1" placeholder=" " data-category="${category}" />
                                    <span class="upload-placeholder">Weight</span>
                                    <div class="custom-spinner">
                                        <div class="spinner-btn up" data-action="increment">▲</div>
                                        <div class="spinner-btn down" data-action="decrement">▼</div>
                                    </div>
                                </label>
                                <button class="upload-submit-btn" onclick="submitNewObject('${category}')">
                                    <ion-icon name="add-outline"></ion-icon>
                                </button>
                            </div>
                            <div class="upload-error-message" style="display: none;">
                                Complete missing object information.
                            </div>
                            <div class="folder-access-container">
                                <button class="folder-access-btn" onclick="requestFolderAccess()" title="Grant access to Images folder for automatic file saving">
                                    <ion-icon name="folder-outline"></ion-icon>
                                    <span>Setup Images Folder</span>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                
                tabContent.innerHTML = `<div class="modify-object-row">${objectsHTML}${uploadBoxHTML}</div>`;
            }
        });

        console.log("Modify segment tabs populated successfully");
        
        // Initialize modify tab functionality
        initModifyTabFunctionality();
    } catch (error) {
        console.error("Error populating modify segment tabs:", error);
    }
}

// Initialize modify tab functionality
function initModifyTabFunctionality() {
    console.log('Initializing modify tab functionality...');
    
    // Weight input functionality
    const weightInputs = document.querySelectorAll('.modify-weight-input');
    console.log('Found weight inputs:', weightInputs.length);
    
    weightInputs.forEach(input => {
        let originalValue = input.value;
        
        input.addEventListener('focus', () => {
            originalValue = input.value;
        });
        
        input.addEventListener('keypress', async (event) => {
            if (event.key === 'Enter') {
                const objectId = event.target.dataset.objectId;
                const newWeight = parseFloat(event.target.value);
                if (objectId && !isNaN(newWeight)) {
                    try {
                        const objectRef = doc(db, 'objects', objectId);
                        await updateDoc(objectRef, { weight: newWeight });
                        console.log(`Weight updated: ${newWeight}`);
                        originalValue = input.value;
                    } catch (error) {
                        console.error('Error updating weight:', error);
                    }
                }
            }
        });
        
        input.addEventListener('blur', () => {
            input.value = originalValue;
        });
    });

    // Category select functionality (using native HTML select)
    const categorySelects = document.querySelectorAll('.modify-category-select');
    console.log('Found category selects:', categorySelects.length);
    
    categorySelects.forEach(select => {
        const objectId = select.dataset.objectId;
        console.log('Setting up select for object:', objectId);
        
        select.addEventListener('change', async (event) => {
            const newCategory = event.target.value;
            console.log(`Category changed to: ${newCategory} for object: ${objectId}`);
            
            try {
                // Update Firestore
                const objectRef = doc(db, 'objects', objectId);
                await updateDoc(objectRef, { category: newCategory });
                console.log(`Successfully updated category in Firestore`);
                
                // Refresh both menus to show object in new category
                console.log('Refreshing menus...');
                await populateModifySegmentTabs();
                await populateSegmentTabs();
                console.log('Menus refreshed successfully');
            } catch (error) {
                console.error('Error updating category:', error);
                // Revert the select to original value on error
                event.target.value = event.target.dataset.originalValue || event.target.value;
            }
        });
        
        // Add blur event listener to remove glow effect when dropdown closes
        select.addEventListener('blur', (event) => {
            // Remove focus styles by triggering a style recalculation
            event.target.style.borderColor = '';
            event.target.style.boxShadow = '';
            // Force a repaint to ensure the styles are updated
            setTimeout(() => {
                event.target.style.borderColor = '';
                event.target.style.boxShadow = '';
            }, 10);
        });
        
        // Store original value
        select.dataset.originalValue = select.value;
    });

    // Add custom spinner button functionality
    setupCustomSpinners();
    
    // Add input validation for upload forms
    setupUploadValidation();
}

// Setup custom spinner button functionality
function setupCustomSpinners() {
    console.log('Setting up custom spinner buttons...');
    
    // Handle all spinner buttons (both upload and modify)
    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('spinner-btn')) {
            const action = event.target.dataset.action;
            const customField = event.target.closest('.upload-custom-field, .modify-custom-field');
            const input = customField.querySelector('input[type="number"]');
            
            if (!input) return;
            
            const step = parseFloat(input.step) || 0.1;
            const currentValue = parseFloat(input.value) || 0;
            
            if (action === 'increment') {
                input.value = (currentValue + step).toFixed(1);
            } else if (action === 'decrement') {
                const newValue = Math.max(0, currentValue - step); // Don't allow negative weights
                input.value = newValue.toFixed(1);
            }
            
            // Trigger input event to update any listeners
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
}

// Setup upload form validation
function setupUploadValidation() {
    console.log('Setting up upload form validation...');
    
    // Add event listeners to all upload forms to hide error messages when users start typing
    document.addEventListener('input', function(event) {
        if (event.target.classList.contains('upload-name-input') || 
            event.target.classList.contains('upload-weight-input')) {
            
            const uploadBox = event.target.closest('.modify-upload-box');
            if (uploadBox) {
                const errorMessage = uploadBox.querySelector('.upload-error-message');
                const nameInput = uploadBox.querySelector('.upload-name-input');
                const weightInput = uploadBox.querySelector('.upload-weight-input');
                const hasFile = uploadBox.selectedFile;
                
                // Check if all fields are now filled
                const name = nameInput.value.trim();
                const weight = parseFloat(weightInput.value);
                
                if (name && weight && weight > 0 && hasFile && imagesFolderHandle) {
                    // All fields are filled and folder access granted, hide error message
                    errorMessage.classList.remove('show');
                    setTimeout(() => {
                        errorMessage.style.display = 'none';
                    }, 300);
                } else if (errorMessage.style.display !== 'none') {
                    // Update error message based on priority
                    if (!name || !weight || weight <= 0 || !hasFile) {
                        errorMessage.textContent = 'Complete missing object information.';
                    } else if (!imagesFolderHandle) {
                        errorMessage.textContent = 'Please setup Images folder access first.';
                    }
                }
            }
        }
    });
}

// File upload functions
/*
================================================================================
                            FILE UPLOAD SYSTEM
================================================================================
This section handles all file upload functionality including:
- Triggering file selection dialogs
- Handling file upload events
- Submitting new objects to the database
- Image processing and storage
- Local folder access for image storage
- File validation and error handling
*/

// Trigger file upload dialog for a specific category
// This function is called when user clicks the upload button
window.triggerFileUpload = function(category) {
    const fileInput = document.getElementById(`file-input-${category}`);
    if (fileInput) {
        fileInput.click();
    }
};

window.handleFileUpload = function(event, category) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.match(/^image\/jpe?g$/)) {
        alert('Please select a JPG or JPEG image file.');
        event.target.value = ''; // Clear the input
        return;
    }
    
    console.log(`File selected for ${category}:`, file.name, file.type, file.size);
    
    // Store the selected file for later use when submitting
    const uploadBox = document.querySelector(`[data-category="${category}"].modify-upload-box`);
    if (uploadBox) {
        uploadBox.selectedFile = file;
        
        // Create a FileReader to read the image
        const reader = new FileReader();
        reader.onload = function(e) {
            const uploadArea = uploadBox.querySelector('.upload-area');
            
            // Replace the upload area content with the image
            uploadArea.innerHTML = `
                <img src="${e.target.result}" alt="Uploaded image" class="uploaded-image-preview" onclick="triggerFileUpload('${category}')">
                <span class="upload-text-overlay" onclick="triggerFileUpload('${category}')">Click to change image</span>
            `;
            
            // Check if all fields are now complete and hide error message if so
            const errorMessage = uploadBox.querySelector('.upload-error-message');
            const nameInput = uploadBox.querySelector('.upload-name-input');
            const weightInput = uploadBox.querySelector('.upload-weight-input');
            
            const name = nameInput.value.trim();
            const weight = parseFloat(weightInput.value);
            
            if (name && weight && weight > 0 && imagesFolderHandle) {
                // All fields are filled and folder access granted, hide error message
                errorMessage.classList.remove('show');
                setTimeout(() => {
                    errorMessage.style.display = 'none';
                }, 300);
            } else if (errorMessage.style.display !== 'none') {
                // Update error message based on priority
                if (!name || !weight || weight <= 0) {
                    errorMessage.textContent = 'Complete missing object information.';
                } else if (!imagesFolderHandle) {
                    errorMessage.textContent = 'Please setup Images folder access first.';
                }
            }
        };
        reader.readAsDataURL(file);
    }
    
    // Reset the file input for next upload
    event.target.value = '';
};

window.submitNewObject = async function(category) {
    console.log('=== SUBMIT NEW OBJECT CALLED ===');
    console.log('Category:', category);
    
    const uploadBox = document.querySelector(`[data-category="${category}"].modify-upload-box`);
    if (!uploadBox) {
        console.error('Upload box not found for category:', category);
        return;
    }
    console.log('✓ Upload box found');
    
    // Get input values and error message element
    const nameInput = uploadBox.querySelector('.upload-name-input');
    const weightInput = uploadBox.querySelector('.upload-weight-input');
    const errorMessage = uploadBox.querySelector('.upload-error-message');
    
    const name = nameInput.value.trim();
    const weight = parseFloat(weightInput.value);
    const file = uploadBox.selectedFile;
    
    // Debug input validation
    console.log('=== INPUT VALIDATION DEBUG ===');
    console.log('Name:', name);
    console.log('Weight:', weight);
    console.log('File:', file);
    console.log('imagesFolderHandle:', imagesFolderHandle);
    
    // Validate inputs - only require essential fields
    if (!name || !weight || weight <= 0 || !file) {
        console.log('Validation failed - missing required fields');
        errorMessage.style.display = 'block';
        errorMessage.classList.add('show');
        errorMessage.textContent = 'Complete missing object information.';
        console.log('Missing: name, weight, or file');
        return;
    }
    
    // Warn about folder access but don't block creation
    if (!imagesFolderHandle) {
        console.warn('⚠ No folder access - image will not be saved locally');
    }
    
    console.log('✓ All validation checks passed');
    
    // Hide error message if all inputs are valid
    errorMessage.classList.remove('show');
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 300);
    
    try {
        console.log('=== STARTING OBJECT CREATION ===');
        console.log('Input values:', { name, weight, category, hasFile: !!file, hasFolderAccess: !!imagesFolderHandle });
        
        // Check if user is authenticated
        if (!auth.currentUser) {
            console.error('Authentication check failed');
            throw new Error('User not authenticated. Please log in first.');
        }
        console.log('✓ User authenticated:', auth.currentUser.email);
        
        // Show waiting animation
        const submitBtn = uploadBox.querySelector('.upload-submit-btn');
        const originalBtnContent = submitBtn.innerHTML;
        submitBtn.innerHTML = '<ion-icon name="hourglass-outline"></ion-icon>';
        submitBtn.disabled = true;
        console.log('✓ Button state updated to loading');
        
        // Verify Firebase services are available
        if (!storage) {
            console.error('Firebase Storage not available');
            throw new Error('Firebase Storage not initialized');
        }
        if (!db) {
            console.error('Firestore not available');
            throw new Error('Firestore not initialized');
        }
        console.log('✓ Firebase services verified');
        
        // Check folder access (but don't block)
        if (!imagesFolderHandle) {
            console.warn('⚠ No folder access - will skip local image saving');
        } else {
            console.log('✓ Folder access available');
        }
        
        // Prepare data - use original filename for local storage
        const originalFileName = file.name; // Keep original filename like "banana.jpg"
        const documentName = name.toLowerCase();
        const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
        
        console.log('Prepared data:', { originalFileName, documentName, capitalizedName });
        
        console.log('=== STARTING OBJECT CREATION OPERATIONS ===');
        
        // 1. Create the document in Firestore first (most important step)
        console.log('Step 1: Creating Firestore document...');
        const documentData = {
            category: category,
            image: `images/${originalFileName}`,
            name: capitalizedName,
            weight: weight
        };
        console.log('Document data:', documentData);
        console.log('Document name (ID):', documentName);
        console.log('Firestore db reference:', db);
        
        try {
            console.log('Attempting to write to Firestore...');
            const docRef = doc(db, 'objects', documentName);
            console.log('Document reference created:', docRef);
            
            await setDoc(docRef, documentData);
            console.log('✓ Firestore document created successfully');
            
            // Verify the document was actually created
            const verifyDoc = await getDoc(docRef);
            if (verifyDoc.exists()) {
                console.log('✓ Document verified in Firestore:', verifyDoc.data());
            } else {
                console.error('✗ Document not found after creation');
            }
        } catch (firestoreError) {
            console.error('✗ Firestore document creation failed:', firestoreError);
            console.error('Firestore error code:', firestoreError.code);
            console.error('Firestore error message:', firestoreError.message);
            throw new Error(`Failed to create document: ${firestoreError.message}`);
        }
        
        console.log('✓ Firestore document created successfully');
        
        // 2. Try to save image to local folder (only if folder access is available)
        if (imagesFolderHandle) {
            console.log('Step 2: Attempting to save image to local folder...');
            try {
                await saveImageToLocalFolder(file, originalFileName);
                console.log('✓ Image saved to local folder successfully');
            } catch (saveError) {
                console.warn('⚠ Image save to local folder failed (continuing anyway):', saveError);
                // Don't throw error - continue with object creation
            }
        } else {
            console.log('Step 2: Skipping local image save (no folder access)');
        }
        
        console.log('Object creation process completed');
        
        // Show refresh progress
        submitBtn.innerHTML = '<ion-icon name="refresh-outline"></ion-icon>';
        
        // 2. Immediately add object to local arrays for instant UI feedback
        const newObject = {
            id: documentName,
            category: category,
            image: `images/${originalFileName}`, // Use correct path format
            name: capitalizedName,
            weight: weight
        };
        
        // Add to modify tab immediately without full refresh
        addObjectToModifyTabLocally(newObject);
        
        // 3. Reset form immediately for better UX
        nameInput.value = '';
        weightInput.value = '';
        delete uploadBox.selectedFile;
        
        // Reset upload area to original state
        const uploadArea = uploadBox.querySelector('.upload-area');
        uploadArea.innerHTML = `
            <ion-icon name="cloud-upload-outline"></ion-icon>
            <span class="upload-text">Upload Image</span>
            <span class="upload-subtext">Select a .jpg image</span>
        `;
        uploadArea.style.backgroundColor = '';
        uploadArea.style.borderColor = '';
        
        // Reset button state immediately
        submitBtn.innerHTML = originalBtnContent;
        submitBtn.disabled = false;
        
        // 4. Refresh main add menu in background (non-blocking)
        populateSegmentTabs().then(() => {
            console.log('Main add menu refreshed successfully');
        }).catch(error => {
            console.error('Error refreshing main add menu:', error);
        });
        
        // Show success immediately
        console.log('=== OBJECT CREATION COMPLETED SUCCESSFULLY ===');
        console.log(`✓ New object "${capitalizedName}" created successfully in ${category} category!`);
        
    } catch (error) {
        console.error('=== OBJECT CREATION FAILED ===');
        console.error('Error details:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        // Log error details (but don't show alert if object was created)
        console.error('Error occurred during object creation process, but object may have been created successfully');
        
        // Reset button state on error
        const submitBtn = uploadBox.querySelector('.upload-submit-btn');
        if (submitBtn) {
            submitBtn.innerHTML = '<ion-icon name="add-outline"></ion-icon>';
            submitBtn.disabled = false;
            console.log('✓ Button state reset after error');
        }
        
        // Prevent any potential redirects
        console.log('Preventing any redirects due to error');
        event?.preventDefault?.();
        event?.stopPropagation?.();
        
        // Don't let the error propagate further to prevent page redirects
        return false;
    }
};

// Function to manually request folder access
window.requestFolderAccess = async function() {
    try {
        console.log('Manually requesting folder access...');
        await getImagesFolderAccess();
        
        // Update all folder access buttons to show success
        const buttons = document.querySelectorAll('.folder-access-btn');
        buttons.forEach(btn => {
            btn.innerHTML = '<ion-icon name="checkmark-circle-outline"></ion-icon><span>Folder Access Granted</span>';
            btn.style.backgroundColor = 'white';
            btn.style.color = 'black';
            btn.style.borderColor = '#ccc';
            btn.disabled = true;
        });
        
        // Check all upload forms and hide error messages if all fields are now complete
        const uploadBoxes = document.querySelectorAll('.modify-upload-box');
        uploadBoxes.forEach(uploadBox => {
            const errorMessage = uploadBox.querySelector('.upload-error-message');
            const nameInput = uploadBox.querySelector('.upload-name-input');
            const weightInput = uploadBox.querySelector('.upload-weight-input');
            const hasFile = uploadBox.selectedFile;
            
            if (errorMessage && nameInput && weightInput) {
                const name = nameInput.value.trim();
                const weight = parseFloat(weightInput.value);
                
                if (name && weight && weight > 0 && hasFile && imagesFolderHandle) {
                    // All fields are filled and folder access granted, hide error message
                    errorMessage.classList.remove('show');
                    setTimeout(() => {
                        errorMessage.style.display = 'none';
                    }, 300);
                } else if (errorMessage.style.display !== 'none') {
                    // Update error message based on priority
                    if (!name || !weight || weight <= 0 || !hasFile) {
                        errorMessage.textContent = 'Complete missing object information.';
                    } else if (!imagesFolderHandle) {
                        errorMessage.textContent = 'Please setup Images folder access first.';
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('Failed to get folder access:', error);
        alert('Failed to get folder access. Images will be downloaded instead.');
    }
};

// Global variable to store the Images folder handle
let imagesFolderHandle = null;

// Helper function to get or request access to the Images folder
async function getImagesFolderAccess() {
    // Check if File System Access API is supported
    if (!('showDirectoryPicker' in window)) {
        throw new Error('File System Access API not supported in this browser');
    }
    
    // If we don't have folder access yet, request it
    if (!imagesFolderHandle) {
        try {
            console.log('Requesting access to Images folder...');
            imagesFolderHandle = await window.showDirectoryPicker({
                mode: 'readwrite',
                startIn: 'documents',
                id: 'images-folder'
            });
            console.log('Images folder access granted');
        } catch (error) {
            console.error('User cancelled folder selection or access denied:', error);
            throw error;
        }
    }
    
    return imagesFolderHandle;
}

// Helper function to save image to local Images folder
async function saveImageToLocalFolder(file, fileName) {
    console.log(`Attempting to save file: ${fileName}, size: ${file.size} bytes`);
    
    try {
        // Try the modern File System Access API first
        if ('showDirectoryPicker' in window && imagesFolderHandle) {
            console.log('Using File System Access API with existing folder handle...');
            
            // Verify the folder handle is still valid
            try {
                await imagesFolderHandle.queryPermission({ mode: 'readwrite' });
                console.log('✓ Folder permissions verified');
            } catch (permError) {
                console.error('Folder permission check failed:', permError);
                throw new Error('Folder access permission lost. Please setup folder access again.');
            }
            
            // Create or get the file handle
            console.log(`Creating file handle for: ${fileName}`);
            const fileHandle = await imagesFolderHandle.getFileHandle(fileName, { create: true });
            console.log('✓ File handle created');
            
            // Create a writable stream
            console.log('Creating writable stream...');
            const writable = await fileHandle.createWritable();
            console.log('✓ Writable stream created');
            
            // Write the file
            console.log('Writing file data...');
            await writable.write(file);
            await writable.close();
            console.log('✓ File write completed');
            
            console.log(`✓ Image ${fileName} saved successfully to Images folder`);
            return;
        } else {
            throw new Error('File System Access API not available or no folder handle');
        }
    } catch (error) {
        console.error('File System Access API failed:', error);
        throw error; // Don't fall back - we require folder access now
    }
    
    // Fallback: Use download method
    console.log('Falling back to download method...');
    return new Promise((resolve) => {
        try {
            const blob = new Blob([file], { type: file.type });
            const url = URL.createObjectURL(blob);
            
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = fileName;
            downloadLink.style.display = 'none';
            
            document.body.appendChild(downloadLink);
            
            setTimeout(() => {
                try {
                    downloadLink.click();
                    document.body.removeChild(downloadLink);
                    
                    setTimeout(() => {
                        URL.revokeObjectURL(url);
                    }, 1000);
                    
                    console.log(`Image ${fileName} download initiated - please save to Images folder`);
                    resolve();
                } catch (clickError) {
                    console.warn('Download click failed:', clickError);
                    document.body.removeChild(downloadLink);
                    URL.revokeObjectURL(url);
                    resolve();
                }
            }, 100);
            
        } catch (error) {
            console.error('Error initiating image download:', error);
            resolve();
        }
    });
}

// Helper function to add object to modify tab locally for instant feedback
function addObjectToModifyTabLocally(newObject) {
    console.log('Adding object to modify tab locally:', newObject.name);
    
    // Find the correct category tab content
    const tabContent = document.getElementById(`modify-${newObject.category}`);
    if (!tabContent) {
        console.error(`Tab content for category ${newObject.category} not found`);
        return;
    }
    
    // Find the modify-object-row container
    const objectRow = tabContent.querySelector('.modify-object-row');
    if (!objectRow) {
        console.error('Object row container not found');
        return;
    }
    
    // Find the upload box (it should be the last child)
    const uploadBox = objectRow.querySelector('.modify-upload-box');
    
    // Create the new object HTML
    const newObjectHTML = `
        <div class="modify-object-item" data-object-id="${newObject.id}">
            <div class="modify-object-name">${newObject.name}</div>
            <div class="modify-object-image">
                <img src="${newObject.image}" alt="${newObject.name}" class="transparent-object">
            </div>
            <div class="modify-object-details">
                <label class="modify-custom-field">
                    <input type="number" class="modify-weight-input" value="${newObject.weight}" data-object-id="${newObject.id}" step="0.1" placeholder=" " />
                    <span class="modify-placeholder">Weight</span>
                    <div class="custom-spinner">
                        <div class="spinner-btn up" data-action="increment">▲</div>
                        <div class="spinner-btn down" data-action="decrement">▼</div>
                    </div>
                </label>
                <select class="modify-category-select" data-object-id="${newObject.id}">
                    <option value="electronics" ${newObject.category === 'electronics' ? 'selected' : ''}>Electronics</option>
                    <option value="clothes" ${newObject.category === 'clothes' ? 'selected' : ''}>Clothes</option>
                    <option value="shoes" ${newObject.category === 'shoes' ? 'selected' : ''}>Shoes</option>
                    <option value="accessories" ${newObject.category === 'accessories' ? 'selected' : ''}>Accessories</option>
                    <option value="food-liquid" ${newObject.category === 'food-liquid' ? 'selected' : ''}>Food and Liquid</option>
                    <option value="baby-items" ${newObject.category === 'baby-items' ? 'selected' : ''}>Baby Items</option>
                    <option value="camping-travel" ${newObject.category === 'camping-travel' ? 'selected' : ''}>Camping and Travel</option>
                </select>
            </div>
        </div>
    `;
    
    // Insert the new object before the upload box
    if (uploadBox) {
        uploadBox.insertAdjacentHTML('beforebegin', newObjectHTML);
    } else {
        // If no upload box found, append to the end
        objectRow.insertAdjacentHTML('beforeend', newObjectHTML);
    }
    
    // Re-initialize the modify tab functionality for the new object
    initializeModifyTabFunctionality();
    
    console.log('Object added to modify tab locally');
}

// Helper function to update object category
async function updateObjectCategory(objectId, newCategory) {
    try {
        const objectRef = doc(db, 'objects', objectId);
        await updateDoc(objectRef, {
            category: newCategory
        });
        console.log(`Object ${objectId} category updated to ${newCategory}`);
        
        // Refresh both modify and add menus to reflect the change
        await populateModifySegmentTabs();
        await populateSegmentTabs();
    } catch (error) {
        console.error('Error updating object category:', error);
    }
}

// Initialize modify segment tabs
function initModifySegmentTabs() {
    const modifySegmentTabs = document.querySelectorAll('#modifyAddSegment .segment-tab');
    
    // Ensure modify-clothes tab is active on initialization
    const modifyClothesTab = document.querySelector('[data-tab-target="#modify-clothes"]');
    const modifyClothesContent = document.querySelector('#modify-clothes[data-tab-content]');
    
    if (modifyClothesTab && modifyClothesContent) {
        modifySegmentTabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll('#modifyAddSegment [data-tab-content]').forEach(c => c.classList.remove('active'));
        modifyClothesTab.classList.add('active');
        modifyClothesContent.classList.add('active');
    }
    
    modifySegmentTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetId = this.getAttribute('data-tab-target');
            const target = document.querySelector(targetId);
            
            if (target) {
                // Remove active class from all tabs and content
                modifySegmentTabs.forEach(t => t.classList.remove('active'));
                document.querySelectorAll('#modifyAddSegment [data-tab-content]').forEach(c => c.classList.remove('active'));
                
                // Add active class to clicked tab and corresponding content
                this.classList.add('active');
                target.classList.add('active');
            }
        });
    });
}

// Add event listeners to counter arrows
function addCounterEventListeners() {
    const counterArrows = document.querySelectorAll('.counter-arrow');
    
    counterArrows.forEach(arrow => {
        arrow.addEventListener('click', function() {
            const counterGroup = this.closest('.counter-group');
            const counterValue = counterGroup.querySelector('.counter-value');
            const currentValue = parseInt(counterValue.textContent);
            
            if (this.classList.contains('up')) {
                counterValue.textContent = currentValue + 1;
            } else if (this.classList.contains('down') && currentValue > 0) {
                counterValue.textContent = currentValue - 1;
            }
            
            // Update the added objects array and display
            updateAddedObjects();
        });
    });
}

// Update addedObjects array based on counter values
function updateAddedObjects() {
    addedObjects = [];
    const counterGroups = document.querySelectorAll('.counter-group');
    
    counterGroups.forEach(group => {
        const count = parseInt(group.querySelector('.counter-value').textContent);
        if (count > 0) {
            const objectId = group.dataset.objectId;
            const name = group.dataset.name;
            const weight = parseFloat(group.dataset.weight);
            
            addedObjects.push({
                id: objectId,
                name: name,
                weight: weight,
                count: count
            });
        }
    });
    
    console.log("Updated addedObjects:", addedObjects);
    
    // Display the added objects in the UI
    displayAddedObjects();
}

// Display added objects in the calculation menu
function displayAddedObjects() {
    const container = document.getElementById('added-objects-container');
    if (!container) {
        console.error("Added objects container not found");
        return;
    }
    
    if (addedObjects.length === 0) {
        container.innerHTML = '<div class="no-items-message">No items added yet</div>';
        container.style.display = 'none';
        return;
    }
    
    // Calculate total weight of all objects
    const totalWeight = addedObjects.reduce((sum, obj) => sum + (obj.weight * obj.count), 0);
    
    // Create total weight row
    const totalWeightRow = `
        <div class="added-item total-weight-row">
            <div class="item-count"></div>
            <div class="item-name">Total Weight:</div>
            <div class="item-weight">${totalWeight.toFixed(2)} kg</div>
        </div>
    `;
    
    // Create individual item rows
    const itemsHTML = addedObjects.map(obj => {
        const itemWeight = (obj.weight * obj.count).toFixed(2);
        return `
            <div class="added-item" data-object-id="${obj.id}">
                <div class="item-count">${obj.count}x</div>
                <div class="item-name">${obj.name}</div>
                <div class="item-weight">${itemWeight} kg</div>
            </div>
        `;
    }).join('');
    
    // Combine total weight row with individual items
    container.innerHTML = totalWeightRow + itemsHTML;
    container.style.display = 'flex';
}

// Show add segment
function showAddSegment() {
    console.log("Show add segment called");
    const addSegment = document.getElementById('addSegment');
    if (addSegment) {
        console.log("Add segment found, adding active class");
        addSegment.classList.add('active');
    } else {
        console.error("Add segment element not found");
    }
}

// Hide add segment
function hideAddSegment() {
    console.log("Hide add segment called");
    const addSegment = document.getElementById('addSegment');
    if (addSegment) {
        console.log("Add segment found, removing active class");
        addSegment.classList.remove('active');
    } else {
        console.error("Add segment element not found");
    }
}

// Initialize airline dropdown
/*
================================================================================
                            DROPDOWN MANAGEMENT SYSTEM
================================================================================
This section handles all dropdown functionality including:
- Airline selection dropdown
- Class selection dropdown (Economy, Business, First)
- Origin country dropdown with search functionality
- Destination country dropdown with search functionality
- Flight type radio buttons (Domestic/International)
- Trip type radio buttons (Outbound/Inbound)
- Dynamic updates based on user selections
*/

// Initialize the airline selection dropdown
// Loads all available airlines from the database and populates the dropdown
async function initAirlineDropdown() {
    try {
        const airlinesCol = collection(db, "airlines");
        const airlineSnapshot = await getDocs(airlinesCol);
        
        const airlineDropdown = document.querySelector('.airline-dropdown');
        if (!airlineDropdown) {
            console.error("Airline dropdown not found");
            return;
        }

        const menu = airlineDropdown.querySelector('.menu');
        if (!menu) {
            console.error("Airline dropdown menu not found");
            return;
        }

        // Clear existing options
        menu.innerHTML = '';
        
        // Don't add default option - only show actual airlines
        airlineSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.name) {
                const option = document.createElement('li');
                option.className = 'option';
                option.setAttribute('data-value', doc.id);
                option.textContent = data.name;
                menu.appendChild(option);
            }
        });
        
    } catch (error) {
        console.error("Error initializing airline dropdown:", error);
    }
}

// Initialize class dropdown
async function initClassDropdown() {
    try {
        // Use the reset function to initialize with all options
        resetClassDropdown();
    } catch (error) {
        console.error("Error initializing class dropdown:", error);
    }
}

// Initialize origin dropdown
async function initOriginDropdown() {
    console.log("Starting origin dropdown initialization...");
    
    try {
        // Get the dropdown elements
        const originDropdown = document.querySelector('.origin-dropdown');
        if (!originDropdown) {
            console.error("Origin dropdown not found");
            return;
        }

        const menu = originDropdown.querySelector('.menu');
        if (!menu) {
            console.error("Origin dropdown menu not found");
            return;
        }

        // Fetch countries from Firestore
        console.log("Fetching countries from Firestore...");
        const countriesCol = collection(db, "countries");
        const countrySnapshot = await getDocs(countriesCol);
        console.log("Found", countrySnapshot.size, "countries in Firestore");

        // Clear menu but keep search container
        const searchContainer = menu.querySelector('.search-container');
        menu.innerHTML = '';
        if (searchContainer) {
            menu.appendChild(searchContainer);
        }

        // Process countries
        const countries = [];
        countrySnapshot.forEach(doc => {
            const data = doc.data();
            console.log("Country document:", doc.id, "Data:", data);
            console.log("All available fields:", Object.keys(data));
            
            // Try different possible field names for country name
            let countryName = data.name || data.countryName || data.CountryName || data.country || data.Country || doc.id;
            const weightSystem = data.WeightSystem || data.weightSystem || data.weight_system || false;
            
            // Capitalize first letter of country name
            if (countryName && typeof countryName === 'string') {
                countryName = countryName.charAt(0).toUpperCase() + countryName.slice(1).toLowerCase();
            }
            
            console.log("Using country name:", countryName);
            console.log("Using weight system:", weightSystem);
            
            if (countryName) {
                countries.push({
                    id: doc.id,
                    name: countryName,
                    weightSystem: weightSystem
                });
                console.log("Added country:", countryName);
            } else {
                console.log("Skipped country (no name):", doc.id);
            }
        });

        // Sort alphabetically
        countries.sort((a, b) => a.name.localeCompare(b.name));
        console.log("Processed", countries.length, "countries");

        // Add countries to menu
        countries.forEach(country => {
            const option = document.createElement('li');
            option.className = 'option';
            option.setAttribute('data-value', country.id);
            option.textContent = country.name;
            menu.appendChild(option);
        });

        console.log("Successfully added", countries.length, "countries to origin dropdown");

        // Add search functionality
        setupCountrySearch(originDropdown);

    } catch (error) {
        console.error("Error initializing origin dropdown:", error);
    }
}

// Initialize destination dropdown
async function initDestinationDropdown() {
    console.log("Starting destination dropdown initialization...");
    
    try {
        // Get the dropdown elements
        const destinationDropdown = document.querySelector('.destination-dropdown');
        if (!destinationDropdown) {
            console.error("Destination dropdown not found");
            return;
        }

        const menu = destinationDropdown.querySelector('.menu');
        if (!menu) {
            console.error("Destination dropdown menu not found");
            return;
        }

        // Fetch countries from Firestore
        console.log("Fetching countries from Firestore...");
        const countriesCol = collection(db, "countries");
        const countrySnapshot = await getDocs(countriesCol);
        console.log("Found", countrySnapshot.size, "countries in Firestore");

        // Clear menu but keep search container
        const searchContainer = menu.querySelector('.search-container');
        menu.innerHTML = '';
        if (searchContainer) {
            menu.appendChild(searchContainer);
        }

        // Process countries
        const countries = [];
        countrySnapshot.forEach(doc => {
            const data = doc.data();
            console.log("Country document:", doc.id, "Data:", data);
            console.log("All available fields:", Object.keys(data));
            
            // Try different possible field names for country name
            let countryName = data.name || data.countryName || data.CountryName || data.country || data.Country || doc.id;
            const weightSystem = data.WeightSystem || data.weightSystem || data.weight_system || false;
            
            // Capitalize first letter of country name
            if (countryName && typeof countryName === 'string') {
                countryName = countryName.charAt(0).toUpperCase() + countryName.slice(1).toLowerCase();
            }
            
            console.log("Using country name:", countryName);
            console.log("Using weight system:", weightSystem);
            
            if (countryName) {
                countries.push({
                    id: doc.id,
                    name: countryName,
                    weightSystem: weightSystem
                });
                console.log("Added country:", countryName);
            } else {
                console.log("Skipped country (no name):", doc.id);
            }
        });

        // Sort alphabetically
        countries.sort((a, b) => a.name.localeCompare(b.name));
        console.log("Processed", countries.length, "countries");

        // Add countries to menu
        countries.forEach(country => {
            const option = document.createElement('li');
            option.className = 'option';
            option.setAttribute('data-value', country.id);
            option.textContent = country.name;
            menu.appendChild(option);
        });

        console.log("Successfully added", countries.length, "countries to destination dropdown");

        // Add search functionality
        setupCountrySearch(destinationDropdown);

    } catch (error) {
        console.error("Error initializing destination dropdown:", error);
    }
}

// Setup search functionality for country dropdowns
function setupCountrySearch(dropdown) {
    console.log("Setting up search for:", dropdown.className);
    
    const searchInput = dropdown.querySelector('.search-input');
    const menu = dropdown.querySelector('.menu');
    const options = menu.querySelectorAll('.option');
    
    if (!searchInput || !menu) {
        console.error("Search elements not found");
        return;
    }
    
    console.log("Found", options.length, "options for search");
    
    // Store all options for filtering
    const allOptions = Array.from(options).map(option => ({
        element: option,
        text: option.textContent.toLowerCase()
    }));
    
    // Add search event listener
    searchInput.addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase().trim();
        
        // Hide all options first
        options.forEach(option => {
            option.style.display = 'none';
        });
        
        if (searchTerm === '') {
            // Show all options if search is empty
            options.forEach(option => {
                option.style.display = 'block';
            });
        } else {
            // Show only matching options
            allOptions.forEach(option => {
                if (option.text.includes(searchTerm)) {
                    option.element.style.display = 'block';
                }
            });
        }
    });
    
    // Clear search when dropdown closes
    const select = dropdown.querySelector('.select');
    select.addEventListener('click', function() {
        if (!select.classList.contains('select-clicked')) {
            searchInput.value = '';
            options.forEach(option => {
                option.style.display = 'block';
            });
        }
    });
    
    console.log("Search functionality added successfully");
}

// Initialize flight type radio buttons
function initFlightTypeRadio() {
    const flightTypeRadios = document.querySelectorAll('input[name="flight-type"]');
    
    flightTypeRadios.forEach(radio => {
        radio.addEventListener('click', function(e) {
            // Check if this radio is currently checked (after browser processed the click)
            if (this.checked) {
                // If it's checked, check if it was the same one that was previously selected
                if (selectedFlightType === this.id) {
                    // Same radio was clicked again - deselect it
                    this.checked = false;
                    selectedFlightType = null;
                    console.log("Deselected flight type:", this.id);
                } else {
                    // Different radio was selected - normal behavior
                    selectedFlightType = this.id;
                    console.log("Selected flight type:", selectedFlightType);
                }
            } else {
                // Radio is not checked - this shouldn't happen with normal radio behavior
                selectedFlightType = null;
                console.log("No flight type selected");
            }
            
            // Handle domestic flight selection with automatic country assignment
            handleDomesticFlightSelection();
        });
    });
}

// Initialize trip type radio buttons
function initTripTypeRadio() {
    const tripTypeRadios = document.querySelectorAll('input[name="trip-type"]');
    
    tripTypeRadios.forEach(radio => {
        radio.addEventListener('click', function(e) {
            // Check if this radio is currently checked (after browser processed the click)
            if (this.checked) {
                // If it's checked, check if it was the same one that was previously selected
                if (selectedTripType === this.id) {
                    // Same radio was clicked again - deselect it
                    this.checked = false;
                    selectedTripType = null;
                    console.log("Deselected trip type:", this.id);
                } else {
                    // Different radio was selected - normal behavior
                    selectedTripType = this.id;
                    console.log("Selected trip type:", selectedTripType);
                }
            } else {
                // Radio is not checked - this shouldn't happen with normal radio behavior
                selectedTripType = null;
                console.log("No trip type selected");
            }
        });
    });
}

// Show error box with custom message
function showErrorBox(message) {
    const errorBox = document.getElementById('error-box');
    const calculateResults = document.getElementById('calculate-results');
    const errorText = errorBox.querySelector('.error-text');
    
    if (errorBox && calculateResults && errorText) {
        errorText.textContent = message;
        calculateResults.style.display = 'none';
        errorBox.style.display = 'block';
    }
}

// Hide error box and show calculate results
function hideErrorBox() {
    const errorBox = document.getElementById('error-box');
    const calculateResults = document.getElementById('calculate-results');
    
    if (errorBox && calculateResults) {
        errorBox.style.display = 'none';
        calculateResults.style.display = 'block';
    }
}

// Calculate total weight
/*
================================================================================
                            WEIGHT CALCULATION SYSTEM
================================================================================
This section handles all weight-related calculations including:
- Calculating total weight of selected objects
- Determining weight limits based on airline and class
- Displaying calculation results and warnings
- Tracking item usage for analytics
- Logging calculation results to database
*/

// Calculate the total weight of all selected objects
// This is the core calculation function that sums up all object weights
function calculateTotalWeight() {
    console.log("=== CALCULATE TOTAL WEIGHT DEBUG ===");
    console.log("Added objects:", addedObjects);
    
    if (addedObjects.length === 0) {
        showErrorBox("Please add at least one item before calculating.");
        return;
    }

    const totalWeight = addedObjects.reduce((sum, obj) => sum + (obj.weight * obj.count), 0);
    console.log("Total weight calculated:", totalWeight);
    
    // Get selected values
    const airlineDropdown = document.querySelector('.airline-dropdown');
    const classDropdown = document.querySelector('.class-dropdown');
    const originDropdown = document.querySelector('.origin-dropdown');
    const destinationDropdown = document.querySelector('.destination-dropdown');
    
    if (!airlineDropdown || !classDropdown || !originDropdown || !destinationDropdown) {
        console.error("Required dropdowns not found");
        return;
    }
    
    selectedAirline = airlineDropdown.querySelector('.selected').getAttribute('data-value');
    selectedClass = classDropdown.querySelector('.selected').getAttribute('data-value');
    const selectedOrigin = originDropdown.querySelector('.selected').getAttribute('data-value');
    const selectedDestination = destinationDropdown.querySelector('.selected').getAttribute('data-value');
    
    console.log("Selected values:", {
        airline: selectedAirline,
        class: selectedClass,
        origin: selectedOrigin,
        destination: selectedDestination,
        flightType: selectedFlightType,
        tripType: selectedTripType
    });
    
    if (!selectedAirline || !selectedClass || !selectedOrigin || !selectedDestination || !selectedFlightType || !selectedTripType) {
        showErrorBox("Please fill in information regarding flight and luggage before attempting to calculate.");
        return;
    }
    
    // Hide error box and show calculate results
    hideErrorBox();
    
    // Get weight limits from Firestore
    getWeightLimits(selectedAirline, selectedClass, selectedOrigin, selectedDestination, totalWeight);
}

// Get weight limits from Firestore
async function getWeightLimits(airline, classType, origin, destination, totalWeight) {
    try {
        console.log("=== GET WEIGHT LIMITS DEBUG ===");
        console.log("Parameters:", { airline, classType, origin, destination, totalWeight });
        
        // Get airline data
        const airlineDoc = await getDoc(doc(db, "airlines", airline));
        if (!airlineDoc.exists()) {
            console.error("Airline document not found");
            return;
        }
        
        const airlineData = airlineDoc.data();
        console.log("Airline data:", airlineData);
        
        // Get origin country data
        const originDoc = await getDoc(doc(db, "countries", origin));
        if (!originDoc.exists()) {
            console.error("Origin country document not found");
            return;
        }
        
        const originData = originDoc.data();
        console.log("Origin data:", originData);
        
        // Get destination country data
        const destinationDoc = await getDoc(doc(db, "countries", destination));
        if (!destinationDoc.exists()) {
            console.error("Destination country document not found");
            return;
        }
        
        const destinationData = destinationDoc.data();
        console.log("Destination data:", destinationData);
        
        // Determine flight type (domestic or international)
        const isDomestic = selectedFlightType === 'domestic';
        const flightTypePrefix = isDomestic ? 'Dom' : 'Int';
        
        // Determine if piece system is active
        const originWeightSystem = originData.WeightSystem;
        const destinationWeightSystem = destinationData.WeightSystem;
        const originUsesPiece = !originWeightSystem;
        const destinationUsesPiece = !destinationWeightSystem;
        const hasPieceSystem = originUsesPiece || destinationUsesPiece;
        
        // Calculate weight limits based on class and flight type
        let weightLimit = 0;
        let limitPassed = false;
        
        if (classType === 'economy') {
            weightLimit = airlineData[`${flightTypePrefix}EconomyLimit`] || 0;
        } else if (classType === 'business') {
            weightLimit = airlineData[`${flightTypePrefix}BusinessLimit`] || 0;
        } else if (classType === 'first') {
            weightLimit = airlineData[`${flightTypePrefix}FirstLimit`] || 0;
        }
        
        console.log("Weight limit for", classType, flightTypePrefix, ":", weightLimit);
        
        // Handle cases where airline doesn't offer this class/flight type combination
        if (weightLimit === 0 || weightLimit === undefined) {
            const flightTypeText = isDomestic ? 'domestic' : 'international';
            const airlineName = document.querySelector('.airline-dropdown .selected').textContent;
            showErrorBox(`${airlineName} does not offer ${classType} class for ${flightTypeText} flights. Please select a different class or flight type.`);
            return;
        }
        
        // Check if weight limit is passed
        limitPassed = totalWeight > weightLimit;
        
        console.log("Limit passed:", limitPassed);
        
        // Display results
        displayResults(totalWeight, weightLimit, limitPassed, airline, classType, origin, destination, isDomestic, hasPieceSystem, airlineData);
        
        // Log calculation result
        await logCalculationResult(totalWeight, limitPassed, selectedFlightType, selectedTripType, classType, airline);
        
    } catch (error) {
        console.error("Error getting weight limits:", error);
    }
}

// Display calculation results
function displayResults(totalWeight, weightLimit, limitPassed, airline, classType, origin, destination, isDomestic, hasPieceSystem, airlineData) {
    console.log("=== DISPLAY RESULTS DEBUG ===");
    
    const resultsContainer = document.getElementById('calculate-results');
    if (!resultsContainer) {
        console.error("Results container not found");
        return;
    }
    
    const airlineName = document.querySelector('.airline-dropdown .selected').textContent;
    const originName = document.querySelector('.origin-dropdown .selected').textContent;
    const destinationName = document.querySelector('.destination-dropdown .selected').textContent;
    
    // Update the calculation results display
    const calculationResultBox = document.getElementById('calculation-result-box');
    const limitResultBox = document.getElementById('limit-result-box');
    
    if (calculationResultBox) {
        // Create the weight comparison message
        const weightDifference = Math.abs(totalWeight - weightLimit).toFixed(1);
        let message = '';
        
        if (limitPassed) {
            message = `Your total weight is ${totalWeight.toFixed(1)} kilograms. You exceed the airline policy by ${weightDifference} kilograms.`;
        } else {
            message = `Your total weight is ${totalWeight.toFixed(1)} kilograms. You are ${weightDifference} kilograms away from passing the airline policy.`;
        }
        
        calculationResultBox.textContent = message;
    }
    
    if (limitResultBox) {
        // Create the fee message for the second box
        let feeMessage = '';
        
        if (!limitPassed) {
            // No policy exceeded
            feeMessage = "You do not pay a fine since you did not exceed any policies. Good job!";
        } else {
            // Policy exceeded - determine fee based on system type
            if (hasPieceSystem) {
                // Piece system fee calculation
                const flightTypePrefix = 'Int'; // Piece system always uses international
                let pieceSystemFee = 0;
                
                if (classType === 'economy') {
                    pieceSystemFee = airlineData[`PieceSystem${flightTypePrefix}EconomyFee`] || 0;
                } else if (classType === 'business') {
                    pieceSystemFee = airlineData[`PieceSystem${flightTypePrefix}BusinessFee`] || 0;
                } else if (classType === 'first') {
                    pieceSystemFee = airlineData[`PieceSystem${flightTypePrefix}FirstFee`] || 0;
                }
                
                const currency = airlineData.InternationalCurrency || '$';
                feeMessage = `According to the airline policy, you have to pay ${pieceSystemFee}${currency} for a piece of extra luggage for your excess weight.`;
            } else {
                // Weight system fee calculation
                const flightTypePrefix = isDomestic ? 'Dom' : 'Int';
                let weightSystemFee = 0;
                
                if (classType === 'economy') {
                    weightSystemFee = airlineData[`WeightSystem${flightTypePrefix}EconomyFee`] || 0;
                } else if (classType === 'business') {
                    weightSystemFee = airlineData[`WeightSystem${flightTypePrefix}BusinessFee`] || 0;
                } else if (classType === 'first') {
                    weightSystemFee = airlineData[`WeightSystem${flightTypePrefix}FirstFee`] || 0;
                }
                
                const currency = isDomestic ? (airlineData.currency || '$') : (airlineData.InternationalCurrency || '$');
                
                // Calculate exceeded weight and round up to nearest whole number
                const exceededWeight = totalWeight - weightLimit;
                const roundedExceededWeight = Math.ceil(exceededWeight);
                
                // Calculate total fee
                const totalFee = roundedExceededWeight * weightSystemFee;
                
                feeMessage = `According to the airline policy, you have to pay ${weightSystemFee}${currency} per kilogram. Which amounts to a total of ${totalFee}${currency}.`;
            }
        }
        
        limitResultBox.textContent = feeMessage;
    }
    
    resultsContainer.style.display = 'flex';
    
    console.log("Results displayed successfully");
}

// Function to track item usage
async function trackItemUsage(itemName, count) {
    console.log(`=== TRACK ITEM USAGE DEBUG: ${itemName} ===`);
    console.log(`Tracking item: ${itemName} with count: ${count}`);
    
    try {
        const user = auth.currentUser;
        console.log("Current user for item tracking:", user);
        if (!user) {
            console.error("No user logged in");
            return;
        }

        const userRef = doc(db, "users", user.uid);
        const itemRef = doc(collection(userRef, "ItemsUsed"), itemName);
        
        // Check if item already exists
        const itemDoc = await getDoc(itemRef);
        const now = new Date().toISOString();
        
        if (itemDoc.exists()) {
            // Update existing item count and last used time
            const currentData = itemDoc.data();
            const currentCount = currentData["Times Used"] || 0;
            await updateDoc(itemRef, {
                "Times Used": currentCount + count,
                "Last Time Used": now
            });
        } else {
            // Create new item entry with first and last time used
            await setDoc(itemRef, {
                "Times Used": count,
                "First Time Used": now,
                "Last Time Used": now
            });
        }
        console.log(`Successfully tracked item usage: ${itemName} (count: ${count})`);
    } catch (error) {
        console.error("Error tracking item usage:", error);
        console.error("Error details:", error.message);
        console.error("Error stack:", error.stack);
    }
    console.log(`=== END TRACK ITEM USAGE DEBUG: ${itemName} ===`);
}

// Function to log calculation results
async function logCalculationResult(totalWeight, limitPassed, flightType, tripType, classType, airline) {
    console.log("=== LOG CALCULATION RESULT DEBUG ===");
    console.log("Parameters received:", { totalWeight, limitPassed, flightType, tripType, classType, airline });
    
    try {
        const user = auth.currentUser;
        console.log("Current user:", user);
        if (!user) {
            console.error("No user logged in");
            return;
        }

        // Create timestamp for document ID
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-');
        
        console.log("Creating document with timestamp:", timestamp);
        const userRef = doc(db, "users", user.uid);
        const calculationRef = doc(collection(userRef, "calculationLogs"), timestamp);
        console.log("Document reference created:", calculationRef.path);
        
        // Determine system type based on origin and destination
        const selectedOrigin = document.querySelector('.origin-dropdown .selected').dataset.value;
        const selectedDestination = document.querySelector('.destination-dropdown .selected').dataset.value;
        
        let originWeightSystem = true;
        let destinationWeightSystem = true;
        
        try {
            const originDoc = await getDoc(doc(db, "countries", selectedOrigin));
            if (originDoc.exists()) {
                originWeightSystem = originDoc.data().WeightSystem;
            }
            const destinationDoc = await getDoc(doc(db, "countries", selectedDestination));
            if (destinationDoc.exists()) {
                destinationWeightSystem = destinationDoc.data().WeightSystem;
            }
        } catch (error) {
            console.error("Error fetching country WeightSystem for logging:", error);
        }
        
        const systemType = (!originWeightSystem || !destinationWeightSystem) ? "piece" : "weight";
        const originCountryName = selectedOrigin.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const destinationCountryName = selectedDestination.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        await setDoc(calculationRef, {
            totalWeight: totalWeight,
            limitPassed: limitPassed,
            flightType: flightType, // domestic/international
            tripType: tripType, // inbound/outbound
            classType: classType, // economy/business
            airline: airline,
            origin: originCountryName,
            destination: destinationCountryName,
            system: systemType,
            calculatedAt: now.toISOString(),
            itemsUsed: addedObjects.map(obj => ({
                name: obj.name,
                count: obj.count,
                weight: obj.weight
            }))
        });
        
        console.log(`Successfully logged calculation result: ${timestamp}`);
        
        // Track item usage for each object
        for (const obj of addedObjects) {
            if (obj.count > 0) {
                console.log(`Tracking item usage from calculation: ${obj.name} (count: ${obj.count})`);
                await trackItemUsage(obj.name, obj.count);
            }
        }
        
        console.log(`Successfully logged calculation result: ${timestamp}`);
        
        // Update analytics after logging calculation
        console.log("Updating analytics...");
        await updateAnalytics();
        console.log("Analytics updated successfully");
        
        // Update admin analytics display after logging calculation (only if analytics tab is visible)
        const analyticsTab = document.getElementById('analytics');
        if (analyticsTab && analyticsTab.classList.contains('active')) {
            console.log("Updating admin analytics display...");
            await updateAnalyticsDisplay();
            console.log("Admin analytics display updated successfully");
        } else {
            console.log("Analytics tab not visible - skipping admin analytics update");
        }
        
        // Update history display after logging calculation
        console.log("Updating history display...");
        await updateHistoryDisplay();
        console.log("History display updated successfully");
    } catch (error) {
        console.error("Error logging calculation result:", error);
        console.error("Error details:", error.message);
        console.error("Error stack:", error.stack);
    }
    console.log("=== END LOG CALCULATION RESULT DEBUG ===");
}

// Function to calculate and display analytics
async function updateAnalytics() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.error("No user logged in");
            return;
        }

        const userRef = doc(db, "users", user.uid);
        const calculationLogsRef = collection(userRef, "calculationLogs");
        const calculationSnapshot = await getDocs(calculationLogsRef);
        
        if (calculationSnapshot.empty) {
            console.log("No calculation logs found");
            return;
        }

        // Convert to array and sort by timestamp
        const calculations = [];
        calculationSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.calculatedAt) {
                calculations.push({
                    ...data,
                    timestamp: doc.id
                });
            }
        });
        
        // Sort by calculatedAt timestamp (newest first)
        calculations.sort((a, b) => new Date(b.calculatedAt) - new Date(a.calculatedAt));
        
        // Separate outbound and inbound flights
        const outboundFlights = calculations.filter(calc => calc.tripType === 'outbound');
        const inboundFlights = calculations.filter(calc => calc.tripType === 'inbound');
        
        const analyticsResults = document.getElementById('analytics-results');
        const averageWeightBox = document.getElementById('average-weight-box');
        const returnWeightBox = document.getElementById('return-weight-box');
        
        if (!analyticsResults || !averageWeightBox || !returnWeightBox) {
            console.error("Analytics elements not found");
            return;
        }
        
        let showFirstRow = false;
        let showSecondRow = false;
        
        // Check if we have enough flights for first row
        const currentTripType = selectedTripType;
        const relevantFlights = currentTripType === 'outbound' ? outboundFlights : inboundFlights;
        
        if (relevantFlights.length >= 3) {
            showFirstRow = true;
        }
        
        // Check if we have both inbound and outbound flights for second row
        if (outboundFlights.length >= 1 && inboundFlights.length >= 1) {
            showSecondRow = true;
        }
        
        // Show/hide analytics box based on conditions
        if (showFirstRow || showSecondRow) {
            analyticsResults.style.display = 'flex';
            
            if (showFirstRow && showSecondRow) {
                analyticsResults.className = 'double-row';
                averageWeightBox.style.display = 'flex';
                returnWeightBox.style.display = 'flex';
            } else if (showFirstRow) {
                analyticsResults.className = 'single-row';
                averageWeightBox.style.display = 'flex';
                returnWeightBox.style.display = 'none';
            } else {
                analyticsResults.className = 'single-row';
                averageWeightBox.style.display = 'none';
                returnWeightBox.style.display = 'flex';
            }
            
            // Update first row content
            if (showFirstRow) {
                const flightCount = Math.min(relevantFlights.length, 10);
                const recentFlights = relevantFlights.slice(0, flightCount);
                const totalWeight = recentFlights.reduce((sum, flight) => sum + flight.totalWeight, 0);
                const averageWeight = (totalWeight / flightCount).toFixed(1);
                
                averageWeightBox.textContent = `According to your last ${flightCount} ${currentTripType} flights, your average luggage weight is ${averageWeight} kilograms.`;
            }
            
            // Update second row content
            if (showSecondRow) {
                const outboundCount = Math.min(outboundFlights.length, 10);
                const inboundCount = Math.min(inboundFlights.length, 10);
                const recentOutbound = outboundFlights.slice(0, outboundCount);
                const recentInbound = inboundFlights.slice(0, inboundCount);
                
                const outboundTotal = recentOutbound.reduce((sum, flight) => sum + flight.totalWeight, 0);
                const inboundTotal = recentInbound.reduce((sum, flight) => sum + flight.totalWeight, 0);
                
                const outboundAverage = (outboundTotal / outboundCount).toFixed(1);
                const inboundAverage = (inboundTotal / inboundCount).toFixed(1);
                
                // Calculate the difference and create dynamic message
                const outboundAvg = parseFloat(outboundAverage);
                const inboundAvg = parseFloat(inboundAverage);
                const difference = Math.abs(inboundAvg - outboundAvg).toFixed(1);
                
                let message;
                if (inboundAvg > outboundAvg) {
                    message = `On average, you return with ${difference} kilograms of extra weight from trips.`;
                } else if (outboundAvg > inboundAvg) {
                    message = `On average, you return with ${difference} less kilograms from trips.`;
                } else {
                    message = `On average, your outbound and inbound luggage weights are equal.`;
                }
                
                returnWeightBox.textContent = message;
            }
        } else {
            analyticsResults.style.display = 'none';
        }
        
    } catch (error) {
        console.error("Error updating analytics:", error);
    }
}

// Function to check piece system notification
async function checkPieceSystemNotification() {
    try {
        const selectedOrigin = document.querySelector('.origin-dropdown .selected')?.dataset.value;
        const selectedDestination = document.querySelector('.destination-dropdown .selected')?.dataset.value;
        
        if (!selectedOrigin || !selectedDestination) {
            return;
        }
        
        let originWeightSystem = true;
        let destinationWeightSystem = true;
        let originCountryName = selectedOrigin.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        let destinationCountryName = selectedDestination.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        try {
            if (selectedOrigin) {
                const originDoc = await getDoc(doc(db, "countries", selectedOrigin));
                if (originDoc.exists()) {
                    originWeightSystem = originDoc.data().WeightSystem;
                    originCountryName = selectedOrigin.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                }
            }
            if (selectedDestination) {
                const destinationDoc = await getDoc(doc(db, "countries", selectedDestination));
                if (destinationDoc.exists()) {
                    destinationWeightSystem = destinationDoc.data().WeightSystem;
                    destinationCountryName = selectedDestination.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                }
            }
        } catch (error) {
            console.error("Error fetching country WeightSystem:", error);
            return;
        }

        // Determine which countries use piece system
        const originUsesPiece = selectedOrigin && !originWeightSystem;
        const destinationUsesPiece = selectedDestination && !destinationWeightSystem;
        const hasPieceSystem = originUsesPiece || destinationUsesPiece;

        // Show/hide piece system notification with animations
        const pieceSystemNotification = document.getElementById('piece-system-notification');
        const wasShowing = pieceSystemNotification.classList.contains('slide-in') || pieceSystemNotification.classList.contains('show');
        
        if (hasPieceSystem) {
            // Only animate if it wasn't already showing
            if (!wasShowing) {
                const notificationContent = document.querySelector('.notification-content');
                
                let message = "";
                if (originUsesPiece && destinationUsesPiece) {
                    message = `${originCountryName} and ${destinationCountryName} use the piece system instead of the weight system, which charges for each piece of overweight luggage instead of per kilogram.`;
                } else if (originUsesPiece) {
                    message = `${originCountryName} uses the piece system instead of the weight system, which charges for each piece of overweight luggage instead of per kilogram.`;
                } else if (destinationUsesPiece) {
                    message = `${destinationCountryName} uses the piece system instead of the weight system, which charges for each piece of overweight luggage instead of per kilogram.`;
                }
                
                notificationContent.textContent = message;
                
                // Remove any existing animation classes
                pieceSystemNotification.classList.remove('slide-out', 'show');
                // Add slide-in animation
                pieceSystemNotification.classList.add('slide-in');
            }
        } else {
            // Only animate out if it was showing
            if (wasShowing) {
                // Remove slide-in class and add slide-out animation
                pieceSystemNotification.classList.remove('slide-in', 'show');
                pieceSystemNotification.classList.add('slide-out');
                
                // After animation completes, hide the element
                setTimeout(() => {
                    pieceSystemNotification.classList.remove('slide-out');
                }, 400); // 0.4s animation duration
            }
        }
    } catch (error) {
        console.error("Error checking piece system notification:", error);
    }
}

// Initialize on DOM load
/*
================================================================================
                            MAIN APPLICATION INITIALIZATION
================================================================================
This section contains the main initialization code that runs when the page loads.
It sets up all the core functionality and event listeners for the application.
*/

// MAIN INITIALIZATION: Set up the application when the DOM is fully loaded
// This is the entry point that initializes all major components
document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM loaded, initializing at", new Date().toISOString());

    // Initialize the main tab system (Calculator, History, Admin)
    const tabLayout = document.querySelector(".tab-layout");
    initTopLevelTabs(tabLayout);

    // Initialize all dropdown systems
    initAirlineDropdown();        // Load airlines from database
    initClassDropdown();          // Set up class selection (Economy, Business, First)
    console.log("About to initialize origin and destination dropdowns...");
    initOriginDropdown();         // Load countries for origin selection
    initDestinationDropdown();    // Load countries for destination selection
    initFlightTypeRadio();
    initTripTypeRadio();
    initSegmentTabs();
    
    // Initialize all dropdowns with unified functionality
    initAllDropdowns();

    const addButton = document.getElementById('addBtn');
    if (addButton) {
        console.log("Add button found, attaching event listener");
        addButton.addEventListener('click', showAddSegment);
    } else {
        console.error("Add button not found");
    }

    const calculateButton = document.getElementById('calculateBtn');
    if (calculateButton) {
        console.log("Calculate button found, attaching event listener");
        calculateButton.addEventListener('click', () => {
            console.log("Calculate button clicked at", new Date().toISOString());
            calculateTotalWeight();
        });
    } else {
        console.error("Calculate button not found in the DOM. Ensure the element with id='calculateBtn' exists.");
    }

    const segmentGoBackButton = document.getElementById('segmentGoBack');
    if (segmentGoBackButton) {
        console.log("Go back button found, attaching event listener");
        segmentGoBackButton.addEventListener('click', hideAddSegment);
    } else {
        console.error("Go back button not found");
    }

    const addSegment = document.getElementById('addSegment');
    if (addSegment) {
        console.log("Removing active class from segment on page load");
        addSegment.classList.remove('active');
    } else {
        console.error("Add segment element not found on page load");
    }

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "index.html";
            return;
        }
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const isAdmin = userDoc.exists() && userDoc.data().admin === true;
        
        // Display username in the rectangle
        const usernameDisplay = document.getElementById('username-display');
        const usernameText = usernameDisplay?.querySelector('.username-text');
        
        if (usernameText && userDoc.exists()) {
            const userData = userDoc.data();
            const username = userData.username || 'User';
            usernameText.textContent = username;
        } else if (usernameText) {
            usernameText.textContent = 'User';
        }
        
        // Control admin tab visibility based on user role
        const adminTab = document.querySelector('.admin-tab');
        console.log('Admin tab found:', adminTab);
        console.log('User is admin:', isAdmin);
        
        if (adminTab) {
            if (isAdmin) {
                console.log('Showing admin tab for admin user');
                adminTab.classList.add('show-admin');
                initNestedTabs(document.querySelector("#admin .nested-tab-bar"));
            } else {
                console.log('Hiding admin tab for regular user');
                adminTab.classList.remove('show-admin');
                // If user is currently on admin tab, switch to calculator tab
                if (adminTab.classList.contains('active')) {
                    console.log('User was on admin tab, switching to calculator');
                    const calculatorTab = document.querySelector('[data-tab-target="#calculator"]');
                    const calculatorContent = document.querySelector('#calculator');
                    const adminContent = document.querySelector('#admin');
                    
                    if (calculatorTab && calculatorContent && adminContent) {
                        adminTab.classList.remove('active');
                        adminContent.classList.remove('active');
                        calculatorTab.classList.add('active');
                        calculatorContent.classList.add('active');
                    }
                }
            }
        } else {
            console.error('Admin tab not found in DOM');
        }
        
        // Don't initialize history display on page load - wait for tab click
    });
});

// Function to update history display
/*
================================================================================
                            HISTORY & ANALYTICS SYSTEM
================================================================================
This section handles all history and analytics functionality including:
- Displaying user's calculation history
- Showing most frequently added items
- Tracking recent flights (inbound/outbound)
- Analyzing countries used most
- Policy violation tracking
- Analytics across all users
- Weight range analysis
*/

// Update the history display with user's calculation data
// This function fetches and displays the user's personal calculation history
async function updateHistoryDisplay() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.error("No user logged in");
            return;
        }

        await updateItemsAddedMost();
        await updateRecentFlights();
        await updateRecentFlightsByType();
        await updateCountriesUsedMost();
        await updatePolicyViolations();
        await updatePreviousWeights();
    } catch (error) {
        console.error("Error updating history display:", error);
    }
}

// Function to update "Items Added Most" section
async function updateItemsAddedMost() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.error("No user logged in");
            return;
        }

        const userRef = doc(db, "users", user.uid);
        const itemsUsedRef = collection(userRef, "ItemsUsed");
        const itemsUsedSnapshot = await getDocs(itemsUsedRef);
        
        const contentElement = document.getElementById('items-added-most-content');
        if (!contentElement) {
            console.error("Items added most content element not found");
            return;
        }

        if (itemsUsedSnapshot.empty) {
            // No items used yet - show placeholder message
            contentElement.innerHTML = `
                <div class="history-placeholder">
                    Make calculations to have a history.
                </div>
            `;
            return;
        }

        // Collect all items from ItemsUsed collection
        const items = [];
        
        itemsUsedSnapshot.forEach(doc => {
            const data = doc.data();
            // The document ID is the item name, and "Times Used" is the count
            const itemName = doc.id;
            const itemCount = data["Times Used"] || 0;
            
            if (itemName && itemCount > 0) {
                items.push({
                    name: itemName,
                    count: itemCount
                });
            }
        });

        // Sort by count (descending) and take top 10
        const sortedItems = items
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        if (sortedItems.length === 0) {
            // No items found - show placeholder message
            contentElement.innerHTML = `
                <div class="history-placeholder">
                    Make calculations to have a history.
                </div>
            `;
            return;
        }

        // Create the item rows using the same styling as calculation menu
        const itemsHTML = sortedItems.map((item, index) => `
            <div class="added-item history-item">
                <div class="item-count">${index + 1}.</div>
                <div class="item-name">${item.name}</div>
                <div class="item-weight">${item.count}</div>
            </div>
        `).join('');

        contentElement.innerHTML = itemsHTML;

    } catch (error) {
        console.error("Error updating items added most:", error);
        const contentElement = document.getElementById('items-added-most-content');
        if (contentElement) {
            contentElement.innerHTML = `
                <div class="history-placeholder">
                    Error loading history.
                </div>
            `;
        }
    }
}

// Function to update Recent Flights section
async function updateRecentFlights() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.error("No user logged in");
            return;
        }

        const userRef = doc(db, "users", user.uid);
        const calculationLogsRef = collection(userRef, "calculationLogs");
        const calculationLogsSnapshot = await getDocs(calculationLogsRef);
        
        const inboundElement = document.getElementById('recent-inbound-flights');
        const outboundElement = document.getElementById('recent-outbound-flights');
        
        if (!inboundElement || !outboundElement) {
            console.error("Recent flights elements not found");
            return;
        }

        if (calculationLogsSnapshot.empty) {
            // No calculations yet - show placeholder for both
            inboundElement.innerHTML = `
                <div class="history-placeholder">
                    Make calculations to have a history.
                </div>
            `;
            outboundElement.innerHTML = `
                <div class="history-placeholder">
                    Make calculations to have a history.
                </div>
            `;
            return;
        }

        // Collect all calculations from calculationLogs
        const allCalculations = [];
        calculationLogsSnapshot.forEach(docSnapshot => {
            const data = docSnapshot.data();
            console.log("Processing calculation log:", docSnapshot.id, data);
            
            if (data.tripType && data.totalWeight !== undefined) {
                // Parse timestamp - could be ISO string or Firestore timestamp
                let calculatedAt;
                if (data.calculatedAt) {
                    if (typeof data.calculatedAt === 'string') {
                        calculatedAt = new Date(data.calculatedAt);
                    } else if (data.calculatedAt.toDate) {
                        calculatedAt = data.calculatedAt.toDate();
                    } else {
                        calculatedAt = new Date();
                    }
                } else {
                    // Fallback: use document ID if it contains timestamp
                    calculatedAt = new Date();
                }
                
                allCalculations.push({
                    tripType: data.tripType,
                    airline: data.airline || 'Unknown Airline',
                    totalWeight: data.totalWeight || 0,
                    calculatedAt: calculatedAt,
                    origin: data.origin || 'Unknown',
                    destination: data.destination || 'Unknown',
                    limitPassed: data.limitPassed || false
                });
            }
        });

        // Separate inbound and outbound flights
        const inboundFlights = allCalculations
            .filter(calc => calc.tripType === 'inbound')
            .sort((a, b) => b.calculatedAt - a.calculatedAt)
            .slice(0, 10);

        const outboundFlights = allCalculations
            .filter(calc => calc.tripType === 'outbound')
            .sort((a, b) => b.calculatedAt - a.calculatedAt)
            .slice(0, 10);

        // Update inbound flights
        if (inboundFlights.length === 0) {
            inboundElement.innerHTML = `
                <div class="history-placeholder">
                    Make calculations to have a history.
                </div>
            `;
        } else {
            const inboundHTML = inboundFlights.map((flight, index) => {
                const airlineName = flight.airline.charAt(0).toUpperCase() + flight.airline.slice(1).toLowerCase();
                return `
                    <div class="added-item flight-item">
                        <div class="item-count">${index + 1}.</div>
                        <div class="item-name">${airlineName} Airlines: ${flight.origin} <ion-icon name="arrow-forward-outline"></ion-icon> ${flight.destination}</div>
                        <div class="item-weight">${flight.totalWeight.toFixed(1)} kg</div>
                    </div>
                `;
            }).join('');
            inboundElement.innerHTML = inboundHTML;
        }

        // Update outbound flights
        if (outboundFlights.length === 0) {
            outboundElement.innerHTML = `
                <div class="history-placeholder">
                    Make calculations to have a history.
                </div>
            `;
        } else {
            const outboundHTML = outboundFlights.map((flight, index) => {
                const airlineName = flight.airline.charAt(0).toUpperCase() + flight.airline.slice(1).toLowerCase();
                return `
                    <div class="added-item flight-item">
                        <div class="item-count">${index + 1}.</div>
                        <div class="item-name">${airlineName} Airlines: ${flight.origin} <ion-icon name="arrow-forward-outline"></ion-icon> ${flight.destination}</div>
                        <div class="item-weight">${flight.totalWeight.toFixed(1)} kg</div>
                    </div>
                `;
            }).join('');
            outboundElement.innerHTML = outboundHTML;
        }

    } catch (error) {
        console.error("Error updating recent flights:", error);
        const inboundElement = document.getElementById('recent-inbound-flights');
        const outboundElement = document.getElementById('recent-outbound-flights');
        
        if (inboundElement) {
            inboundElement.innerHTML = `
                <div class="history-placeholder">
                    Error loading history.
                </div>
            `;
        }
        
        if (outboundElement) {
            outboundElement.innerHTML = `
                <div class="history-placeholder">
                    Error loading history.
                </div>
            `;
        }
    }
}

// Function to update Recent Flights by Type section (International vs Domestic)
async function updateRecentFlightsByType() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.error("No user logged in");
            return;
        }

        const userRef = doc(db, "users", user.uid);
        const calculationLogsRef = collection(userRef, "calculationLogs");
        const calculationLogsSnapshot = await getDocs(calculationLogsRef);
        
        const internationalElement = document.getElementById('recent-international-flights');
        const domesticElement = document.getElementById('recent-domestic-flights');
        
        if (!internationalElement || !domesticElement) {
            console.error("Recent flights by type elements not found");
            return;
        }

        if (calculationLogsSnapshot.empty) {
            // No calculations yet - show placeholder for both
            internationalElement.innerHTML = `
                <div class="history-placeholder">
                    Make calculations to have a history.
                </div>
            `;
            domesticElement.innerHTML = `
                <div class="history-placeholder">
                    Make calculations to have a history.
                </div>
            `;
            return;
        }

        // Collect all calculations from calculationLogs
        const allCalculations = [];
        calculationLogsSnapshot.forEach(docSnapshot => {
            const data = docSnapshot.data();
            
            if (data.flightType && data.totalWeight !== undefined) {
                // Parse timestamp - could be ISO string or Firestore timestamp
                let calculatedAt;
                if (data.calculatedAt) {
                    if (typeof data.calculatedAt === 'string') {
                        calculatedAt = new Date(data.calculatedAt);
                    } else if (data.calculatedAt.toDate) {
                        calculatedAt = data.calculatedAt.toDate();
                    } else {
                        calculatedAt = new Date();
                    }
                } else {
                    calculatedAt = new Date();
                }
                
                allCalculations.push({
                    flightType: data.flightType,
                    airline: data.airline || 'Unknown Airline',
                    totalWeight: data.totalWeight || 0,
                    calculatedAt: calculatedAt,
                    origin: data.origin || 'Unknown',
                    destination: data.destination || 'Unknown',
                    limitPassed: data.limitPassed || false
                });
            }
        });

        // Separate international and domestic flights
        const internationalFlights = allCalculations
            .filter(calc => calc.flightType === 'international')
            .sort((a, b) => b.calculatedAt - a.calculatedAt)
            .slice(0, 10);

        const domesticFlights = allCalculations
            .filter(calc => calc.flightType === 'domestic')
            .sort((a, b) => b.calculatedAt - a.calculatedAt)
            .slice(0, 10);

        // Update international flights
        if (internationalFlights.length === 0) {
            internationalElement.innerHTML = `
                <div class="history-placeholder">
                    Make calculations to have a history.
                </div>
            `;
        } else {
            const internationalHTML = internationalFlights.map((flight, index) => {
                const airlineName = flight.airline.charAt(0).toUpperCase() + flight.airline.slice(1).toLowerCase();
                return `
                    <div class="added-item flight-item">
                        <div class="item-count">${index + 1}.</div>
                        <div class="item-name">${airlineName} Airlines: ${flight.origin} <ion-icon name="arrow-forward-outline"></ion-icon> ${flight.destination}</div>
                        <div class="item-weight">${flight.totalWeight.toFixed(1)} kg</div>
                    </div>
                `;
            }).join('');
            internationalElement.innerHTML = internationalHTML;
        }

        // Update domestic flights
        if (domesticFlights.length === 0) {
            domesticElement.innerHTML = `
                <div class="history-placeholder">
                    Make calculations to have a history.
                </div>
            `;
        } else {
            const domesticHTML = domesticFlights.map((flight, index) => {
                const airlineName = flight.airline.charAt(0).toUpperCase() + flight.airline.slice(1).toLowerCase();
                return `
                    <div class="added-item flight-item">
                        <div class="item-count">${index + 1}.</div>
                        <div class="item-name">${airlineName} Airlines: ${flight.origin} <ion-icon name="arrow-forward-outline"></ion-icon> ${flight.destination}</div>
                        <div class="item-weight">${flight.totalWeight.toFixed(1)} kg</div>
                    </div>
                `;
            }).join('');
            domesticElement.innerHTML = domesticHTML;
        }

    } catch (error) {
        console.error("Error updating recent flights by type:", error);
        const internationalElement = document.getElementById('recent-international-flights');
        const domesticElement = document.getElementById('recent-domestic-flights');
        
        if (internationalElement) {
            internationalElement.innerHTML = `
                <div class="history-placeholder">
                    Error loading history.
                </div>
            `;
        }
        
        if (domesticElement) {
            domesticElement.innerHTML = `
                <div class="history-placeholder">
                    Error loading history.
                </div>
            `;
        }
    }
}

// Function to update Countries Used Most section
async function updateCountriesUsedMost() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.error("No user logged in");
            return;
        }

        const userRef = doc(db, "users", user.uid);
        const calculationLogsRef = collection(userRef, "calculationLogs");
        const calculationLogsSnapshot = await getDocs(calculationLogsRef);
        
        const departedElement = document.getElementById('countries-departed-most');
        const traveledElement = document.getElementById('countries-traveled-most');
        
        if (!departedElement || !traveledElement) {
            console.error("Countries used most elements not found");
            return;
        }

        if (calculationLogsSnapshot.empty) {
            // No calculations yet - show placeholder for both
            departedElement.innerHTML = `
                <div class="history-placeholder">
                    Make calculations to have a history.
                </div>
            `;
            traveledElement.innerHTML = `
                <div class="history-placeholder">
                    Make calculations to have a history.
                </div>
            `;
            return;
        }

        // Collect country usage data
        const originCountries = {};
        const destinationCountries = {};
        
        calculationLogsSnapshot.forEach(docSnapshot => {
            const data = docSnapshot.data();
            
            if (data.origin && data.destination) {
                // Count origin countries
                const origin = data.origin;
                originCountries[origin] = (originCountries[origin] || 0) + 1;
                
                // Count destination countries
                const destination = data.destination;
                destinationCountries[destination] = (destinationCountries[destination] || 0) + 1;
            }
        });

        // Convert to arrays and sort by usage count
        const sortedOriginCountries = Object.entries(originCountries)
            .map(([country, count]) => ({ name: country, count: count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        const sortedDestinationCountries = Object.entries(destinationCountries)
            .map(([country, count]) => ({ name: country, count: count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // Update departed from countries
        if (sortedOriginCountries.length === 0) {
            departedElement.innerHTML = `
                <div class="history-placeholder">
                    Make calculations to have a history.
                </div>
            `;
        } else {
            const departedHTML = sortedOriginCountries.map((country, index) => `
                <div class="added-item flight-item">
                    <div class="item-count">${index + 1}.</div>
                    <div class="item-name">${country.name}</div>
                    <div class="item-weight">${country.count}</div>
                </div>
            `).join('');
            departedElement.innerHTML = departedHTML;
        }

        // Update traveled to countries
        if (sortedDestinationCountries.length === 0) {
            traveledElement.innerHTML = `
                <div class="history-placeholder">
                    Make calculations to have a history.
                </div>
            `;
        } else {
            const traveledHTML = sortedDestinationCountries.map((country, index) => `
                <div class="added-item flight-item">
                    <div class="item-count">${index + 1}.</div>
                    <div class="item-name">${country.name}</div>
                    <div class="item-weight">${country.count}</div>
                </div>
            `).join('');
            traveledElement.innerHTML = traveledHTML;
        }

    } catch (error) {
        console.error("Error updating countries used most:", error);
        const departedElement = document.getElementById('countries-departed-most');
        const traveledElement = document.getElementById('countries-traveled-most');
        
        if (departedElement) {
            departedElement.innerHTML = `
                <div class="history-placeholder">
                    Error loading history.
                </div>
            `;
        }
        
        if (traveledElement) {
            traveledElement.innerHTML = `
                <div class="history-placeholder">
                    Error loading history.
                </div>
            `;
        }
    }
}

// Function to update Policy Violations section
async function updatePolicyViolations() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.error("No user logged in");
            return;
        }

        const userRef = doc(db, "users", user.uid);
        const calculationLogsRef = collection(userRef, "calculationLogs");
        const calculationLogsSnapshot = await getDocs(calculationLogsRef);
        
        const violationsElement = document.getElementById('policy-violations-content');
        
        if (!violationsElement) {
            console.error("Policy violations element not found");
            return;
        }

        if (calculationLogsSnapshot.empty) {
            violationsElement.innerHTML = `
                <div class="history-placeholder">
                    Make calculations to have a history.
                </div>
            `;
            return;
        }

        // Collect violations and recalculate limits/fees from airline data
        const violations = [];
        
        for (const docSnapshot of calculationLogsSnapshot.docs) {
            const data = docSnapshot.data();
            
            // Only include calculations where policy was exceeded
            if (data.limitPassed === true && data.totalWeight && data.airline) {
                try {
                    // Fetch airline data to get proper limits and fees
                    const airlineDoc = await getDoc(doc(db, "airlines", data.airline));
                    if (!airlineDoc.exists()) continue;
                    
                    const airlineData = airlineDoc.data();
                    
                    // Use the stored system type from calculation logs
                    const hasPieceSystem = data.system === 'piece';
                    
                    // Determine flight type prefix and calculate proper limits/fees
                    const isDomestic = data.flightType === 'domestic';
                    const flightTypePrefix = isDomestic ? 'Dom' : 'Int';
                    
                    let weightLimit = 0;
                    let fee = 0;
                    let currency = '';
                    
                    // Get weight limit
                    if (data.classType === 'economy') {
                        weightLimit = airlineData[`${flightTypePrefix}EconomyLimit`] || 0;
                    } else if (data.classType === 'business') {
                        weightLimit = airlineData[`${flightTypePrefix}BusinessLimit`] || 0;
                    } else if (data.classType === 'first') {
                        weightLimit = airlineData[`${flightTypePrefix}FirstLimit`] || 0;
                    }
                    
                    // Get fee and currency
                    if (hasPieceSystem) {
                        // Piece system always uses international fees
                        if (data.classType === 'economy') {
                            fee = airlineData[`PieceSystemIntEconomyFee`] || 0;
                        } else if (data.classType === 'business') {
                            fee = airlineData[`PieceSystemIntBusinessFee`] || 0;
                        } else if (data.classType === 'first') {
                            fee = airlineData[`PieceSystemIntFirstFee`] || 0;
                        }
                        currency = airlineData.InternationalCurrency || '$';
                    } else {
                        // Weight system fees
                        if (data.classType === 'economy') {
                            fee = airlineData[`WeightSystem${flightTypePrefix}EconomyFee`] || 0;
                        } else if (data.classType === 'business') {
                            fee = airlineData[`WeightSystem${flightTypePrefix}BusinessFee`] || 0;
                        } else if (data.classType === 'first') {
                            fee = airlineData[`WeightSystem${flightTypePrefix}FirstFee`] || 0;
                        }
                        currency = isDomestic ? (airlineData.currency || '$') : (airlineData.InternationalCurrency || '$');
                    }
                    
                    // Parse timestamp
                    let calculatedAt;
                    if (data.calculatedAt) {
                        if (typeof data.calculatedAt === 'string') {
                            calculatedAt = new Date(data.calculatedAt);
                        } else if (data.calculatedAt.toDate) {
                            calculatedAt = data.calculatedAt.toDate();
                        } else {
                            calculatedAt = new Date();
                        }
                    } else {
                        calculatedAt = new Date();
                    }
                    
                    violations.push({
                        airline: data.airline,
                        classType: data.classType || 'Unknown',
                        flightType: data.flightType || 'Unknown',
                        system: data.system || 'weight', // Use stored system value
                        totalWeight: data.totalWeight,
                        weightLimit: weightLimit,
                        fee: fee,
                        currency: currency,
                        calculatedAt: calculatedAt,
                        origin: data.origin || 'Unknown',
                        destination: data.destination || 'Unknown',
                        hasPieceSystem: hasPieceSystem
                    });
                    
                } catch (error) {
                    console.error("Error processing violation:", error);
                }
            }
        }

        if (violations.length === 0) {
            violationsElement.innerHTML = `
                <div class="history-placeholder">
                    No policy violations found. You're doing great!
                </div>
            `;
            return;
        }

        // Sort by most recent violations first and limit to 15
        violations.sort((a, b) => b.calculatedAt - a.calculatedAt);
        const recentViolations = violations.slice(0, 15);

        // Create violation boxes
        const violationsHTML = recentViolations.map((violation, index) => {
            const airlineName = violation.airline.charAt(0).toUpperCase() + violation.airline.slice(1).toLowerCase();
            const excessWeight = (violation.totalWeight - violation.weightLimit).toFixed(1);
            const flightTypeText = violation.flightType === 'domestic' ? 'Domestic' : 'International';
            const systemText = violation.system === 'piece' ? 'Piece System' : 'Weight System';
            
            // Format fee display based on system type
            let feeDisplay = '';
            let totalFeeHTML = '';
            
            if (violation.system === 'piece') {
                feeDisplay = `Fee: ${violation.fee}${violation.currency} per piece`;
            } else {
                // Weight system - calculate total fee with ceiling rounding
                const exceededWeight = violation.totalWeight - violation.weightLimit;
                const roundedExceededWeight = Math.ceil(exceededWeight);
                const totalFee = roundedExceededWeight * violation.fee;
                
                feeDisplay = `Fee: ${violation.fee}${violation.currency} per kilogram`;
                totalFeeHTML = `<div class="violation-total-fee">Total Fee: ${totalFee}${violation.currency}</div>`;
            }
            
            return `
                <div class="violation-box">
                    <div class="violation-header">
                        <span class="violation-number">${index + 1}.</span>
                        <span class="violation-airline">${airlineName} Airlines</span>
                        <span class="violation-class">${violation.classType.charAt(0).toUpperCase() + violation.classType.slice(1)} Class</span>
                        <span class="violation-type">${flightTypeText}</span>
                    </div>
                    <div class="violation-details">
                        <div class="violation-route">${violation.origin} <ion-icon name="arrow-forward-outline"></ion-icon> ${violation.destination}</div>
                        <div class="violation-system">System: ${systemText}</div>
                        <div class="violation-weight">Total Weight: ${violation.totalWeight.toFixed(1)} kg</div>
                        <div class="violation-limit">Weight Limit: ${violation.weightLimit.toFixed(1)} kg</div>
                        <div class="violation-excess">Exceeded by: ${excessWeight} kg</div>
                        <div class="violation-fee">${feeDisplay}</div>
                        ${totalFeeHTML}
                    </div>
                </div>
            `;
        }).join('');

        violationsElement.innerHTML = violationsHTML;

    } catch (error) {
        console.error("Error updating policy violations:", error);
        const violationsElement = document.getElementById('policy-violations-content');
        
        if (violationsElement) {
            violationsElement.innerHTML = `
                <div class="history-placeholder">
                    Error loading violations.
                </div>
            `;
        }
    }
}

// Function to update Analytics Display (all users data)
async function updateAnalyticsDisplay() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.error("No user logged in");
            return;
        }

        await updateWeightRangesAnalytics();
        await updatePolicyViolationsAnalytics();
    } catch (error) {
        console.error("Error updating analytics display:", error);
    }
}


// Function to update Weight Ranges Analytics (across all users) - REWRITTEN FROM SCRATCH
async function updateWeightRangesAnalytics() {
    console.log('=== ANALYTICS REWRITE - FETCHING ALL USERS DATA ===');
        
    try {
        // Get the target element
        const weightRangesElement = document.getElementById('weight-ranges-content');
        if (!weightRangesElement) {
            console.error("❌ Weight ranges element not found");
            return;
        }
        console.log('✅ Weight ranges element found');

        // Step 1: Fetch ALL users from the users collection
        console.log('📊 Fetching all users from Firestore...');
        const usersCollection = collection(db, "users");
        const allUsersSnapshot = await getDocs(usersCollection);
        
        console.log(`📊 Found ${allUsersSnapshot.size} users in the system`);
        console.log('📊 User IDs:', allUsersSnapshot.docs.map(doc => doc.id));
        
        if (allUsersSnapshot.empty) {
            console.log('❌ No users found in the system');
            weightRangesElement.innerHTML = `
                <div class="analytics-placeholder">
                    No users found in the system.
                </div>
            `;
            return;
        }

        // Step 2: Initialize weight ranges (0-1kg, 1-2kg, ..., 49-50kg, 50+kg)
        const weightRanges = {};
        for (let i = 0; i < 50; i++) {
            weightRanges[`${i}-${i+1}`] = 0;
        }
        weightRanges['50+'] = 0;
        console.log('✅ Weight ranges initialized');

        // Step 3: Process each user's calculation logs
        let totalCalculationsProcessed = 0;
        let totalUsersWithCalculations = 0;
        
        console.log(`🔄 Processing ${allUsersSnapshot.docs.length} users...`);
        
        for (const userDoc of allUsersSnapshot.docs) {
            const userData = userDoc.data();
            const userId = userDoc.id;
            const username = userData.username || 'Unknown';
            const isAdmin = userData.admin || false;
            
            console.log(`👤 Processing user: ${username} (${userId}) - Admin: ${isAdmin}`);
            
            try {
                // Get this user's calculation logs
                const calculationLogsRef = collection(userDoc.ref, "calculationLogs");
                const calculationLogsSnapshot = await getDocs(calculationLogsRef);
                
                console.log(`📝 User ${username} has ${calculationLogsSnapshot.size} calculation logs`);
                
                if (calculationLogsSnapshot.size > 0) {
                    totalUsersWithCalculations++;
                    
                    // Process each calculation log
                calculationLogsSnapshot.forEach(logDoc => {
                        const logData = logDoc.data();
                        const totalWeight = logData.totalWeight;
                        
                        console.log(`📊 Processing calculation: ${totalWeight}kg from ${username}`);
                        
                        if (typeof totalWeight === 'number' && totalWeight >= 0) {
                            totalCalculationsProcessed++;
                            
                            // Determine which weight range this belongs to
                            if (totalWeight >= 50) {
                            weightRanges['50+']++;
                                console.log(`✅ Added ${totalWeight}kg to 50+ range (new count: ${weightRanges['50+']})`);
                        } else {
                                const rangeIndex = Math.floor(totalWeight);
                            const rangeKey = `${rangeIndex}-${rangeIndex + 1}`;
                            if (weightRanges.hasOwnProperty(rangeKey)) {
                                weightRanges[rangeKey]++;
                                    console.log(`✅ Added ${totalWeight}kg to ${rangeKey} range (new count: ${weightRanges[rangeKey]})`);
                                }
                            }
                        } else {
                            console.log(`❌ Invalid weight data from ${username}:`, totalWeight);
                        }
                    });
                } else {
                    console.log(`📝 User ${username} has no calculation logs`);
                }
                
            } catch (userError) {
                console.error(`❌ Error processing user ${username}:`, userError);
            }
        }
        
        // Step 4: Summary
        console.log('📊 ANALYTICS SUMMARY:');
        console.log(`📊 Total users in system: ${allUsersSnapshot.docs.length}`);
        console.log(`📊 Users with calculations: ${totalUsersWithCalculations}`);
        console.log(`📊 Total calculations processed: ${totalCalculationsProcessed}`);
        console.log('📊 Weight ranges with data:', Object.entries(weightRanges).filter(([key, value]) => value > 0));
        
        // Step 5: Generate HTML for weight ranges
        console.log('🎨 Generating weight range display...');
        const weightRangeRows = [];
        
        // Add 0-49kg ranges
        for (let i = 0; i < 50; i++) {
            const rangeKey = `${i}-${i+1}`;
            const count = weightRanges[rangeKey];
            const rowHTML = `
                <div class="added-item weight-range-item">
                    <div class="item-count">${i}-${i+1} kg</div>
                    <div class="item-name"></div>
                    <div class="item-weight">${count}</div>
                </div>
            `;
            weightRangeRows.push(rowHTML);
        }
        
        // Add 50+ kg range
        const count50Plus = weightRanges['50+'];
        weightRangeRows.push(`
            <div class="added-item weight-range-item">
                <div class="item-count">50+ kg</div>
                <div class="item-name"></div>
                <div class="item-weight">${count50Plus}</div>
            </div>
        `);

        // Step 6: Update the DOM
        console.log('🎨 Updating DOM with weight ranges...');
        weightRangesElement.innerHTML = weightRangeRows.join('');
        
        console.log('✅ Analytics update completed successfully!');
        console.log(`✅ Displayed ${weightRangeRows.length} weight ranges`);

    } catch (error) {
        console.error('❌ CRITICAL ERROR in analytics:', error);
        console.error('❌ Error details:', error.message);
        console.error('❌ Error stack:', error.stack);
        
        const weightRangesElement = document.getElementById('weight-ranges-content');
        if (weightRangesElement) {
            weightRangesElement.innerHTML = `
                <div class="analytics-placeholder">
                    Error loading analytics data: ${error.message}
                </div>
            `;
        }
    }
}

// Function to update Policy Violations Analytics (across all users)
async function updatePolicyViolationsAnalytics() {
    console.log('=== POLICY VIOLATIONS ANALYTICS - FETCHING ALL USERS DATA ===');
    console.log('🔍 DEBUG: updatePolicyViolationsAnalytics function called');
    
    try {
        // Get the target element
        const policyViolationsElement = document.getElementById('policy-violations-analytics-content');
        if (!policyViolationsElement) {
            console.error("❌ Policy violations analytics element not found");
            return;
        }
        console.log('✅ Policy violations analytics element found');

        // Step 1: Fetch ALL users from the users collection
        console.log('📊 Fetching all users for policy violations analysis...');
        const usersCollection = collection(db, "users");
        const allUsersSnapshot = await getDocs(usersCollection);
        
        console.log(`📊 Found ${allUsersSnapshot.size} users in the system`);
        
        if (allUsersSnapshot.empty) {
            console.log('❌ No users found in the system');
            policyViolationsElement.innerHTML = `
                <div class="analytics-placeholder">
                    No users found in the system.
                </div>
            `;
            return;
        }

        // Step 2: Collect all policy violations from all users
        const policyViolations = new Map(); // Key: "airline-class-flightType", Value: { count, details }
        let totalViolationsProcessed = 0;
        
        console.log(`🔄 Processing policy violations from ${allUsersSnapshot.docs.length} users...`);
        
        for (const userDoc of allUsersSnapshot.docs) {
            const userData = userDoc.data();
            const userId = userDoc.id;
            const username = userData.username || 'Unknown';
            
            console.log(`👤 Processing policy violations from user: ${username} (${userId})`);
            
            try {
                // Get this user's calculation logs
                const calculationLogsRef = collection(userDoc.ref, "calculationLogs");
                const calculationLogsSnapshot = await getDocs(calculationLogsRef);
                
                console.log(`📝 User ${username} has ${calculationLogsSnapshot.size} calculation logs`);
                
                // Process each calculation log
                for (const logDoc of calculationLogsSnapshot.docs) {
                    const logData = logDoc.data();
                    
                    // Only process calculations where policy was exceeded
                    if (logData.limitPassed === true && logData.airline && logData.classType && logData.flightType) {
                        totalViolationsProcessed++;
                        
                        // Create unique key for this policy combination
                        const policyKey = `${logData.airline}-${logData.classType}-${logData.flightType}`;
                        
                        console.log(`🚨 Policy violation found: ${policyKey} from ${username}`);
                        
                        // Get or create violation entry
                        if (!policyViolations.has(policyKey)) {
                            policyViolations.set(policyKey, {
                                count: 0,
                                airline: logData.airline,
                                classType: logData.classType,
                                flightType: logData.flightType,
                                totalWeight: logData.totalWeight || 0,
                                weightLimit: 0,
                                system: logData.system || 'weight'
                            });
                        }
                        
                        // Increment count
                        const violation = policyViolations.get(policyKey);
                        violation.count++;
                        
                        // Update other details (use latest values)
                        violation.totalWeight = logData.totalWeight || 0;
                        violation.system = logData.system || 'weight';
                        
                        // Fetch airline data for weight limits only
                        try {
                            const airlineDoc = await getDoc(doc(db, "airlines", logData.airline));
                            if (airlineDoc.exists()) {
                                const airlineData = airlineDoc.data();
                                const flightTypePrefix = logData.flightType === 'domestic' ? 'Dom' : 'Int';
                                
                                // Get weight limit
                                if (logData.classType === 'economy') {
                                    violation.weightLimit = airlineData[`${flightTypePrefix}EconomyLimit`] || 0;
                                } else if (logData.classType === 'business') {
                                    violation.weightLimit = airlineData[`${flightTypePrefix}BusinessLimit`] || 0;
                                } else if (logData.classType === 'first') {
                                    violation.weightLimit = airlineData[`${flightTypePrefix}FirstLimit`] || 0;
                                }
                                
                                console.log(`📊 Airline data for ${logData.airline}:`, {
                                    system: violation.system,
                                    flightType: logData.flightType,
                                    classType: logData.classType,
                                    weightLimit: violation.weightLimit,
                                    availableFields: Object.keys(airlineData)
                                });
                            }
                        } catch (airlineError) {
                            console.error(`❌ Error fetching airline data for ${logData.airline}:`, airlineError);
                        }
                    }
                }
                
            } catch (userError) {
                console.error(`❌ Error processing user ${username}:`, userError);
            }
        }
        
        // Step 3: Sort violations by count (most violated first)
        const sortedViolations = Array.from(policyViolations.values())
            .sort((a, b) => b.count - a.count);
        
        console.log('📊 POLICY VIOLATIONS SUMMARY:');
        console.log(`📊 Total violations processed: ${totalViolationsProcessed}`);
        console.log(`📊 Unique policy combinations violated: ${sortedViolations.length}`);
        console.log('📊 Top violations:', sortedViolations.slice(0, 5).map(v => `${v.airline}-${v.classType}-${v.flightType}: ${v.count} times`));
        
        // Debug: Show all violations found
        console.log('🔍 DEBUG: All violations found:', Array.from(policyViolations.entries()));
        
        // Step 4: Generate HTML for policy violations
        console.log('🎨 Generating policy violations display...');
        
        if (sortedViolations.length === 0) {
            console.log('🔍 DEBUG: No violations found, showing placeholder');
            policyViolationsElement.innerHTML = `
                <div class="analytics-placeholder">
                    No policy violations found across all users.
                </div>
            `;
            return;
        }
        
        console.log('🔍 DEBUG: About to process', sortedViolations.length, 'violations');
        
        console.log('🔍 DEBUG: Found violations, generating HTML for', sortedViolations.length, 'violations');
        
        const violationRows = [];
        
        // Process each violation to ensure we have all the data we need
        for (let i = 0; i < sortedViolations.length; i++) {
            const violation = sortedViolations[i];
            
            // Make sure we have weight limit data for this violation
            if (violation.weightLimit === 0) {
                try {
                    const airlineDoc = await getDoc(doc(db, "airlines", violation.airline));
                    if (airlineDoc.exists()) {
                        const airlineData = airlineDoc.data();
                        const flightTypePrefix = violation.flightType === 'domestic' ? 'Dom' : 'Int';
                        
                        // Get weight limit
                        if (violation.classType === 'economy') {
                            violation.weightLimit = airlineData[`${flightTypePrefix}EconomyLimit`] || 0;
                        } else if (violation.classType === 'business') {
                            violation.weightLimit = airlineData[`${flightTypePrefix}BusinessLimit`] || 0;
                        } else if (violation.classType === 'first') {
                            violation.weightLimit = airlineData[`${flightTypePrefix}FirstLimit`] || 0;
                        }
                    }
                } catch (error) {
                    console.error('Error fetching weight limit for violation:', error);
                }
            }
        }
        
        sortedViolations.forEach((violation, index) => {
            const rank = index + 1;
            
            // Capitalize airline name
            const capitalizedAirline = violation.airline.charAt(0).toUpperCase() + violation.airline.slice(1);
            
            console.log(`🔍 DEBUG: Processing violation ${rank}:`, {
                airline: violation.airline,
                classType: violation.classType,
                flightType: violation.flightType,
                count: violation.count,
                weightLimit: violation.weightLimit,
                system: violation.system
            });
            
            const violationHTML = `
                <div class="analytics-violation-item">
                    <div class="violation-header">
                        <span class="violation-rank">${rank}.</span>
                        <span class="violation-airline">${capitalizedAirline}</span>
                        <span class="violation-class">${violation.classType.charAt(0).toUpperCase() + violation.classType.slice(1)} Class</span>
                        <span class="violation-flight-type">${violation.flightType.charAt(0).toUpperCase() + violation.flightType.slice(1)}</span>
                        <span class="violation-system">${violation.system === 'piece' ? 'Piece System' : 'Weight System'}</span>
                        <span class="violation-limit">Weight Limit: ${violation.weightLimit} kg</span>
                    </div>
                    <div class="violation-count">
                        Violated ${violation.count} time${violation.count !== 1 ? 's' : ''} across all users
                    </div>
                </div>
            `;
            
            violationRows.push(violationHTML);
        });
        
        // Step 5: Update the DOM
        console.log('🎨 Updating DOM with policy violations...');
        policyViolationsElement.innerHTML = violationRows.join('');
        
        console.log('✅ Policy violations analytics update completed successfully!');
        console.log(`✅ Displayed ${violationRows.length} policy violations`);
        
    } catch (error) {
        console.error('❌ CRITICAL ERROR in policy violations analytics:', error);
        console.error('❌ Error details:', error.message);
        console.error('❌ Error stack:', error.stack);
        
        const policyViolationsElement = document.getElementById('policy-violations-analytics-content');
        if (policyViolationsElement) {
            policyViolationsElement.innerHTML = `
                <div class="analytics-placeholder">
                    Error loading policy violations data: ${error.message}
                </div>
            `;
        }
    }
}

// Function to update Previous Total Weights section
async function updatePreviousWeights() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.error("No user logged in");
            return;
        }

        // Populate airline dropdown
        await populateHistoryAirlineDropdown();
        
        // Set up event listeners
        setupPreviousWeightsEventListeners();
        
    } catch (error) {
        console.error("Error updating previous weights:", error);
    }
}

// Function to populate airline dropdown for history
async function populateHistoryAirlineDropdown() {
    try {
        const airlinesCol = collection(db, "airlines");
        const airlineSnapshot = await getDocs(airlinesCol);
        
        const airlineDropdown = document.getElementById('history-airline-dropdown');
        if (!airlineDropdown) {
            console.error("History airline dropdown not found");
            return;
        }

        const menu = airlineDropdown.querySelector('.menu');
        if (!menu) {
            console.error("History airline dropdown menu not found");
            return;
        }

        // Clear existing options
        menu.innerHTML = '';
        
        // Add default option
        const defaultOption = document.createElement('li');
        defaultOption.className = 'option';
        defaultOption.setAttribute('data-value', '');
        defaultOption.textContent = 'Select an Airline';
        menu.appendChild(defaultOption);
        
        if (!airlineSnapshot.empty) {
            airlineSnapshot.forEach(doc => {
                const data = doc.data();
                if (data && data.name) {
                    const option = document.createElement('li');
                    option.className = 'option';
                    option.setAttribute('data-value', doc.id);
                    option.textContent = data.name;
                    menu.appendChild(option);
                }
            });
        }
        
    } catch (error) {
        console.error("Error populating history airline dropdown:", error);
    }
}

// Function to setup event listeners for previous weights
function setupPreviousWeightsEventListeners() {
    // This is now handled by the unified dropdown system
    // No need to set up individual listeners
}

// Function to handle airline selection in history
async function handleHistoryAirlineSelection(airlineId) {
    try {
        // Get airline data to populate class dropdown
        const airlineDoc = await getDoc(doc(db, "airlines", airlineId));
        if (airlineDoc.exists()) {
            const airlineData = airlineDoc.data();
            await populateHistoryClassDropdown(airlineData);
        }
        
        // Show weights display
        showWeightsDisplay();
        
    } catch (error) {
        console.error("Error handling airline selection:", error);
    }
}

// Function to populate class dropdown based on selected airline
async function populateHistoryClassDropdown(airlineData) {
    const classDropdown = document.getElementById('history-class-dropdown');
    if (!classDropdown) return;
    
    const menu = classDropdown.querySelector('.menu');
    if (!menu) return;
    
    // Clear existing options
    menu.innerHTML = '';
    
    // Add default option
    const defaultOption = document.createElement('li');
    defaultOption.className = 'option';
    defaultOption.setAttribute('data-value', '');
    defaultOption.textContent = 'Select a class';
    menu.appendChild(defaultOption);
    
    // Add available classes for this airline
    if (airlineData.economy) {
        const option = document.createElement('li');
        option.className = 'option';
        option.setAttribute('data-value', 'economy');
        option.textContent = 'Economy';
        menu.appendChild(option);
    }
    
    if (airlineData.business) {
        const option = document.createElement('li');
        option.className = 'option';
        option.setAttribute('data-value', 'business');
        option.textContent = 'Business';
        menu.appendChild(option);
    }
    
    if (airlineData.first) {
        const option = document.createElement('li');
        option.className = 'option';
        option.setAttribute('data-value', 'first');
        option.textContent = 'First';
        menu.appendChild(option);
    }
}

// Function to show weights display
function showWeightsDisplay() {
    const weightsDisplay = document.getElementById('weights-display-container');
    if (weightsDisplay) {
        weightsDisplay.style.display = 'flex';
    }
}

// Function to hide weights display
function hideWeightsDisplay() {
    const weightsDisplay = document.getElementById('weights-display-container');
    if (weightsDisplay) {
        weightsDisplay.style.display = 'none';
    }
}

// Function to update direction weights
async function updateDirectionWeights() {
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        const airlineDropdown = document.getElementById('history-airline-dropdown');
        const directionDropdown = document.getElementById('history-direction-dropdown');
        
        if (!airlineDropdown || !directionDropdown) return;
        
        const selectedAirline = airlineDropdown.querySelector('.selected').getAttribute('data-value');
        const selectedDirection = directionDropdown.querySelector('.selected').getAttribute('data-value');
        
        if (!selectedAirline || !selectedDirection) return;
        
        // Get calculation logs for this airline and direction
        const userRef = doc(db, "users", user.uid);
        const calculationLogsRef = collection(userRef, "calculationLogs");
        const calculationSnapshot = await getDocs(calculationLogsRef);
        
        const weights = [];
        calculationSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.airline === selectedAirline && data.tripType === selectedDirection) {
                weights.push({
                    weight: data.totalWeight,
                    timestamp: data.calculatedAt
                });
            }
        });
        
        // Sort by timestamp (newest first) and take top 10
        weights.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const topWeights = weights.slice(0, 10);
        
        // Display weights
        displayWeights(topWeights, 'direction-weights-list');
        
    } catch (error) {
        console.error("Error updating direction weights:", error);
    }
}

// Function to update class weights
async function updateClassWeights() {
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        const airlineDropdown = document.getElementById('history-airline-dropdown');
        const classDropdown = document.getElementById('history-class-dropdown');
        
        if (!airlineDropdown || !classDropdown) return;
        
        const selectedAirline = airlineDropdown.querySelector('.selected').getAttribute('data-value');
        const selectedClass = classDropdown.querySelector('.selected').getAttribute('data-value');
        
        if (!selectedAirline || !selectedClass) return;
        
        // Get calculation logs for this airline and class
        const userRef = doc(db, "users", user.uid);
        const calculationLogsRef = collection(userRef, "calculationLogs");
        const calculationSnapshot = await getDocs(calculationLogsRef);
        
        const weights = [];
        calculationSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.airline === selectedAirline && data.classType === selectedClass) {
                weights.push({
                    weight: data.totalWeight,
                    timestamp: data.calculatedAt
                });
            }
        });
        
        // Sort by timestamp (newest first) and take top 10
        weights.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const topWeights = weights.slice(0, 10);
        
        // Display weights
        displayWeights(topWeights, 'class-weights-list');
        
    } catch (error) {
        console.error("Error updating class weights:", error);
    }
}

// Function to display weights in a list
function displayWeights(weights, listId) {
    const listElement = document.getElementById(listId);
    if (!listElement) return;
    
    if (weights.length === 0) {
        listElement.innerHTML = `
            <div class="history-placeholder">
                Make calculations to have a history.
            </div>
        `;
        return;
    }
    
    const weightsHTML = weights.map((weight, index) => `
        <div class="weight-item-bar">
            <span class="weight-item-number">${index + 1}.</span>
            <span class="weight-item-value">${weight.weight} kg</span>
        </div>
    `).join('');
    
    listElement.innerHTML = weightsHTML;
}

// Unified dropdown initialization function
function initAllDropdowns() {
    // Get all dropdowns (both calculation and history)
    const allDropdowns = document.querySelectorAll('.dropdown');
    
    allDropdowns.forEach(dropdown => {
        const select = dropdown.querySelector('.select');
        const menu = dropdown.querySelector('.menu');
        const caret = dropdown.querySelector('.caret');
        const selected = dropdown.querySelector('.selected');
        
        if (!select || !menu || !caret || !selected) return;
        
        // Toggle dropdown
        select.addEventListener('click', (e) => {
            e.stopPropagation();
            select.classList.toggle('select-clicked');
            caret.classList.toggle('caret-rotate');
            menu.classList.toggle('menu-open');
        });
        
        // Handle option selection
        menu.addEventListener('click', (e) => {
            if (e.target.classList.contains('option')) {
                const value = e.target.getAttribute('data-value');
                const text = e.target.textContent;
                
                selected.textContent = text;
                selected.setAttribute('data-value', value);
                
                // Remove active class from all options
                menu.querySelectorAll('.option').forEach(opt => opt.classList.remove('active'));
                // Add active class to selected option
                e.target.classList.add('active');
                
                // Close dropdown
                select.classList.remove('select-clicked');
                caret.classList.remove('caret-rotate');
                menu.classList.remove('menu-open');
                
                // Handle specific dropdown actions
                handleDropdownSelection(dropdown, value);
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                select.classList.remove('select-clicked');
                caret.classList.remove('caret-rotate');
                menu.classList.remove('menu-open');
            }
        });
    });
}

// Handle airline selection and adjust flight type and class options
async function handleAirlineSelection(airlineId) {
    try {
        // Get airline data from Firestore
        const airlineDoc = await getDoc(doc(db, "airlines", airlineId));
        if (!airlineDoc.exists()) {
            console.error("Airline document not found");
            return;
        }
        
        const airlineData = airlineDoc.data();
        console.log("Selected airline data:", airlineData);
        
        // Check airline capabilities
        const supportsDomestic = airlineData.DomesticFlights === true;
        const supportsFirstClass = airlineData.FirstClass === true;
        
        // Store domestic country for later use
        currentAirlineDomCountry = airlineData.DomCountry || null;
        console.log('Stored currentAirlineDomCountry:', currentAirlineDomCountry);
        
        // Handle flight type options
        const domesticRadio = document.getElementById('domestic');
        const internationalRadio = document.getElementById('international');
        
        if (domesticRadio && internationalRadio) {
            if (supportsDomestic) {
                // Turkish Airlines - enable both flight type options
                domesticRadio.disabled = false;
                internationalRadio.disabled = false;
                
                // Remove any existing styling
                domesticRadio.parentElement.classList.remove('disabled');
                internationalRadio.parentElement.classList.remove('disabled');
            } else {
                // Qatar Airways - disable domestic, don't auto-select international
                domesticRadio.disabled = true;
                internationalRadio.disabled = false;
                
                // Add disabled styling
                domesticRadio.parentElement.classList.add('disabled');
                internationalRadio.parentElement.classList.remove('disabled');
                
                // Don't auto-select international - let user choose
                // Uncheck both options
                domesticRadio.checked = false;
                internationalRadio.checked = false;
                
                // Reset selected flight type
                selectedFlightType = null;
            }
        }
        
        // Handle class dropdown options
        await updateClassDropdown(airlineData);
        
    } catch (error) {
        console.error("Error handling airline selection:", error);
    }
}

// Update class dropdown based on airline capabilities
async function updateClassDropdown(airlineData) {
    const classDropdown = document.querySelector('.class-dropdown');
    if (!classDropdown) {
        console.error("Class dropdown not found");
        return;
    }

    const menu = classDropdown.querySelector('.menu');
    if (!menu) {
        console.error("Class dropdown menu not found");
        return;
    }

    // Clear existing options
    menu.innerHTML = '';
    
    // Always add Economy
    const economyOption = document.createElement('li');
    economyOption.className = 'option';
    economyOption.setAttribute('data-value', 'economy');
    economyOption.textContent = 'Economy';
    menu.appendChild(economyOption);
    
    // Always add Business
    const businessOption = document.createElement('li');
    businessOption.className = 'option';
    businessOption.setAttribute('data-value', 'business');
    businessOption.textContent = 'Business';
    menu.appendChild(businessOption);
    
    // Add First Class only if airline supports it
    if (airlineData.FirstClass === true) {
        const firstOption = document.createElement('li');
        firstOption.className = 'option';
        firstOption.setAttribute('data-value', 'first');
        firstOption.textContent = 'First';
        menu.appendChild(firstOption);
    }
    
    // Reset selected class
    const selected = classDropdown.querySelector('.selected');
    if (selected) {
        selected.textContent = 'Select a Class';
        selected.setAttribute('data-value', '');
    }
}

// Reset flight type and class options when no airline is selected
function resetFlightTypeOptions() {
    const domesticRadio = document.getElementById('domestic');
    const internationalRadio = document.getElementById('international');
    
    if (domesticRadio && internationalRadio) {
        // Enable both options
        domesticRadio.disabled = false;
        internationalRadio.disabled = false;
        
        // Remove disabled styling
        domesticRadio.parentElement.classList.remove('disabled');
        internationalRadio.parentElement.classList.remove('disabled');
        
        // Uncheck both
        domesticRadio.checked = false;
        internationalRadio.checked = false;
        
        // Reset selected flight type
        selectedFlightType = null;
    }
    
    // Clear airline domestic country and unlock dropdowns
    currentAirlineDomCountry = null;
    unlockCountryDropdown('.origin-dropdown');
    unlockCountryDropdown('.destination-dropdown');
    
    // Reset class dropdown to show all options
    resetClassDropdown();
}

// Update flight type options based on airline capabilities and piece system status
async function updateFlightTypeOptions() {
    try {
        const selectedAirlineValue = document.querySelector('.airline-dropdown .selected')?.dataset.value;
        
        // If no airline selected, reset options
        if (!selectedAirlineValue) {
            resetFlightTypeOptions();
            return;
        }
        
        // Get airline data
        const airlineDoc = await getDoc(doc(db, "airlines", selectedAirlineValue));
        if (!airlineDoc.exists()) {
            console.error("Airline document not found");
            return;
        }
        
        const airlineData = airlineDoc.data();
        const supportsDomestic = airlineData.DomesticFlights === true;
        
        // Check if piece system is active
        const selectedOrigin = document.querySelector('.origin-dropdown .selected')?.dataset.value;
        const selectedDestination = document.querySelector('.destination-dropdown .selected')?.dataset.value;
        
        let hasPieceSystem = false;
        
        if (selectedOrigin && selectedDestination) {
            try {
                const originDoc = await getDoc(doc(db, "countries", selectedOrigin));
                const destinationDoc = await getDoc(doc(db, "countries", selectedDestination));
                
                if (originDoc.exists() && destinationDoc.exists()) {
                    const originWeightSystem = originDoc.data().WeightSystem;
                    const destinationWeightSystem = destinationDoc.data().WeightSystem;
                    const originUsesPiece = !originWeightSystem;
                    const destinationUsesPiece = !destinationWeightSystem;
                    hasPieceSystem = originUsesPiece || destinationUsesPiece;
                }
            } catch (error) {
                console.error("Error checking piece system:", error);
            }
        }
        
        // Update flight type options
        const domesticRadio = document.getElementById('domestic');
        const internationalRadio = document.getElementById('international');
        
        if (domesticRadio && internationalRadio) {
            // Disable domestic if airline doesn't support it OR piece system is active
            const shouldDisableDomestic = !supportsDomestic || hasPieceSystem;
            
            if (shouldDisableDomestic) {
                // Disable domestic flight option
                domesticRadio.disabled = true;
                internationalRadio.disabled = false;
                
                // Add disabled styling
                domesticRadio.parentElement.classList.add('disabled');
                internationalRadio.parentElement.classList.remove('disabled');
                
                // Uncheck both options
                domesticRadio.checked = false;
                internationalRadio.checked = false;
                
                // Reset selected flight type
                selectedFlightType = null;
            } else {
                // Enable both options
                domesticRadio.disabled = false;
                internationalRadio.disabled = false;
                
                // Remove disabled styling
                domesticRadio.parentElement.classList.remove('disabled');
                internationalRadio.parentElement.classList.remove('disabled');
            }
        }
        
    } catch (error) {
        console.error("Error updating flight type options:", error);
    }
}

// Handle domestic flight selection with automatic country assignment
async function handleDomesticFlightSelection() {
    console.log('=== DOMESTIC FLIGHT SELECTION DEBUG ===');
    console.log('currentAirlineDomCountry:', currentAirlineDomCountry);
    console.log('selectedFlightType:', selectedFlightType);
    
    if (currentAirlineDomCountry && currentAirlineDomCountry !== 'none' && selectedFlightType === 'domestic') {
        console.log('Conditions met - setting domestic country to both dropdowns');
        
        // Wait a moment to ensure dropdowns are populated
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Set both origin and destination to the airline's domestic country
        setCountryDropdown('.origin-dropdown', currentAirlineDomCountry);
        setCountryDropdown('.destination-dropdown', currentAirlineDomCountry);
        
        // Lock both dropdowns (functionally but not visually)
        lockCountryDropdown('.origin-dropdown');
        lockCountryDropdown('.destination-dropdown');
        
        // Trigger piece system check since countries changed
        checkPieceSystemNotification();
    } else {
        console.log('Conditions not met - unlocking dropdowns');
        console.log('Reason: currentAirlineDomCountry =', currentAirlineDomCountry, 'selectedFlightType =', selectedFlightType);
        
        // Unlock dropdowns when domestic is deselected or no domestic country available
        unlockCountryDropdown('.origin-dropdown');
        unlockCountryDropdown('.destination-dropdown');
    }
}

// Set a country dropdown to a specific value
function setCountryDropdown(dropdownSelector, countryId) {
    console.log(`Setting ${dropdownSelector} to country: ${countryId}`);
    
    const dropdown = document.querySelector(dropdownSelector);
    if (!dropdown) {
        console.error(`Dropdown not found: ${dropdownSelector}`);
        return;
    }
    
    const selected = dropdown.querySelector('.selected');
    const menuItems = dropdown.querySelectorAll('.menu li:not(.search-container)');
    
    console.log(`Found ${menuItems.length} menu items`);
    
    if (menuItems.length === 0) {
        console.error('No menu items found - dropdown may not be populated yet');
        return;
    }
    
    // Try different possible formats for the country ID
    const possibleIds = [
        countryId,
        countryId.toLowerCase(),
        countryId.toUpperCase(),
        countryId.charAt(0).toUpperCase() + countryId.slice(1).toLowerCase()
    ];
    
    console.log('Trying possible country IDs:', possibleIds);
    
    // Find the menu item with the matching country
    let found = false;
    for (const item of menuItems) {
        for (const possibleId of possibleIds) {
            if (item.dataset.value === possibleId) {
                // Update the selected display
                selected.textContent = item.textContent;
                selected.dataset.value = possibleId;
                
                // Update active state
                menuItems.forEach(menuItem => menuItem.classList.remove('active'));
                item.classList.add('active');
                
                console.log(`Successfully set ${dropdownSelector} to: ${item.textContent} (using ID: ${possibleId})`);
                found = true;
                break;
            }
        }
        if (found) break;
    }
    
    if (!found) {
        console.error(`Country not found in dropdown: ${countryId}`);
        // List all available countries for debugging
        console.log('Available countries:');
        menuItems.forEach(item => {
            console.log(`  - ${item.dataset.value}: ${item.textContent}`);
        });
    }
}

// Lock a country dropdown (make it non-interactive but keep normal appearance)
function lockCountryDropdown(dropdownSelector) {
    const dropdown = document.querySelector(dropdownSelector);
    if (!dropdown) return;
    
    const select = dropdown.querySelector('.select');
    if (select) {
        select.style.pointerEvents = 'none';
        dropdown.classList.add('locked');
        // Keep normal visual appearance - no opacity or cursor changes
    }
}

// Unlock a country dropdown (make it interactive again)
function unlockCountryDropdown(dropdownSelector) {
    const dropdown = document.querySelector(dropdownSelector);
    if (!dropdown) return;
    
    const select = dropdown.querySelector('.select');
    if (select) {
        select.style.pointerEvents = '';
        dropdown.classList.remove('locked');
    }
}

// Reset class dropdown to show all options
function resetClassDropdown() {
    const classDropdown = document.querySelector('.class-dropdown');
    if (!classDropdown) return;

    const menu = classDropdown.querySelector('.menu');
    if (!menu) return;

    // Clear existing options
    menu.innerHTML = '';
    
    // Add all class options
    const classes = [
        { value: 'economy', text: 'Economy' },
        { value: 'business', text: 'Business' },
        { value: 'first', text: 'First' }
    ];
    
    classes.forEach(cls => {
        const option = document.createElement('li');
        option.className = 'option';
        option.setAttribute('data-value', cls.value);
        option.textContent = cls.text;
        menu.appendChild(option);
    });
    
    // Reset selected class
    const selected = classDropdown.querySelector('.selected');
    if (selected) {
        selected.textContent = 'Select a Class';
        selected.setAttribute('data-value', '');
    }
}

// Handle specific dropdown selections
function handleDropdownSelection(dropdown, value) {
    const dropdownId = dropdown.id;
    const dropdownClass = dropdown.className;
    
    // Handle history dropdowns
    if (dropdownId === 'history-airline-dropdown') {
        if (value) {
            handleHistoryAirlineSelection(value);
        } else {
            hideWeightsDisplay();
        }
    } else if (dropdownId === 'history-direction-dropdown') {
        if (value) {
            updateDirectionWeights();
        }
    } else if (dropdownId === 'history-class-dropdown') {
        if (value) {
            updateClassWeights();
        }
    }
    
    // Handle airline selection for calculation dropdowns
    if (dropdownClass.includes('airline-dropdown')) {
        if (value) {
            handleAirlineSelection(value);
            // Also update flight type options considering piece system
            updateFlightTypeOptions();
        } else {
            resetFlightTypeOptions();
        }
    }
    
    // Handle calculation dropdowns - trigger piece system check and update flight options
    if (dropdownClass.includes('origin-dropdown') || dropdownClass.includes('destination-dropdown')) {
        checkPieceSystemNotification();
        // Update flight type options when countries change
        updateFlightTypeOptions();
    }
}