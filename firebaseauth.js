
     document.addEventListener("DOMContentLoaded", async () => {
        // Initialize radio button deselection
        initRadioDeselection();
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js");
        const { getAnalytics } = await import("https://www.gstatic.com/firebasejs/11.6.0/firebase-analytics.js");
        const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js");
        const { getFirestore, setDoc, doc, getDoc, collection } = await import("https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js");

      
        const firebaseConfig = {
          apiKey: "AIzaSyB1UukH_IAKPtZEMz7EVAb-JlRCKrmpQ8c",
          authDomain: "cs-ia-ct.firebaseapp.com",
          projectId: "cs-ia-ct",
          storageBucket: "cs-ia-ct.appspot.com",
          messagingSenderId: "691153045688",
          appId: "1:691153045688:web:b6512a0d1a7f93fb9bcc4d",
          measurementId: "G-F61EZJCHZV"
        };
      
        const app = initializeApp(firebaseConfig);
        getAnalytics(app);
        const auth = getAuth();
        const db = getFirestore();
        
        // Function to initialize radio button deselection with CSS classes
        function initRadioDeselection() {
            const radioInputs = document.querySelectorAll('input[type="radio"]');
            radioInputs.forEach(radio => {
                radio.addEventListener('click', (e) => {
                    if (radio.checked && radio.classList.contains('deselectable')) {
                        // Deselect the radio button
                        radio.checked = false;
                        radio.classList.add('deselected');
                        radio.classList.remove('deselectable');
                    } else if (radio.checked) {
                        // Mark as deselectable for next click
                        radio.classList.add('deselectable');
                    }
                });
            });
        }
      


        const showMessage = (msgText) => {
          let popup = document.getElementById("messagePopup");
          let messageText = document.getElementById("messageText");

          // Fallback: create the popup structure if it's missing on the page
          if (!popup) {
            popup = document.createElement("div");
            popup.id = "messagePopup";
            popup.className = "message-popup"; // relies on index.css styles

            const content = document.createElement("div");
            content.className = "message-content";

            messageText = document.createElement("span");
            messageText.id = "messageText";

            content.appendChild(messageText);
            popup.appendChild(content);
            document.body.appendChild(popup);
          }

          if (!messageText) {
            messageText = document.createElement("span");
            messageText.id = "messageText";
            const content = popup.querySelector(".message-content") || popup;
            content.appendChild(messageText);
          }

          // Set the message text
          messageText.textContent = msgText;

          // Show the popup
          popup.classList.remove("hide");
          popup.classList.add("show");
        };
      
        const signUp = document.getElementById("signupBtn");
        if (signUp) {
          signUp.addEventListener("click", async (event) => {
            event.preventDefault();

            // Read inputs
            const usernameInput = document.getElementById("userName");
            const emailInput = document.getElementById("eMail");
            const passwordInput = document.getElementById("passWord");
            const password2Input = document.getElementById("passWord2");

            const username = (usernameInput?.value || "").trim();
            const email = (emailInput?.value || "").trim();
            const password = passwordInput?.value || "";
            const password2 = password2Input?.value || "";

            const isAdmin = !!document.getElementById("admin")?.checked;
            const isUser = !!document.getElementById("user")?.checked;

            // Determine first applicable error (shown only after clicking Sign Up)
            let errorMessage = null;
            if (!username || !email || !password || !password2) {
              errorMessage = "❌ Sign up information is missing.";
            } else if (!isAdmin && !isUser) {
              errorMessage = "！User type must be selected.";
            } else if (password !== password2) {
              errorMessage = "❌ Passwords do not match.";
            }

            if (errorMessage) {
              showMessage(errorMessage);
              return;
            }

            try {
              const userCredential = await createUserWithEmailAndPassword(auth, email, password);
              const user = userCredential.user;

              const userData = {
                email,
                username,
                admin: isAdmin,
                uid: user.uid,
                createdAt: new Date().toISOString(),
              };

              await setDoc(doc(db, "users", user.uid), userData);
              
              // Try to create subcollections
              try {
                console.log("Attempting to create subcollections...");
                
                // Create ItemsUsed subcollection with iphone document
                const userRef = doc(db, "users", user.uid);
                const itemsUsedRef = collection(userRef, "ItemsUsed");
                await setDoc(doc(itemsUsedRef, "iphone"), {
                  "Times Used": 0
                });
                console.log("ItemsUsed subcollection created successfully");
                
                // Create calculationLogs subcollection with placeholder
                const calculationLogsRef = collection(userRef, "calculationLogs");
                await setDoc(doc(calculationLogsRef, "placeholder"), {
                  created: new Date().toISOString(),
                  note: "Subcollection created"
                });
                console.log("calculationLogs subcollection created successfully");
                
              } catch (error) {
                console.error("Error creating subcollections:", error);
                console.error("Error message:", error.message);
              }
              
              showMessage("✅ Account created successfully!");

              setTimeout(() => {
                window.location.href = "index.html";
              }, 1500);
            } catch (error) {
              const code = error?.code || "";
              if (code === "auth/email-already-in-use") {
                showMessage("❌ E-mail is already in use.");
              } else if (code === "auth/account-exists-with-different-credential") {
                showMessage("！Account already exists.");
              } else {
                showMessage("❌ Failed to create account.");
              }
            }
          });
        }
      
        const loginBtn = document.getElementById("loginBtn");
        if (loginBtn) {
          loginBtn.addEventListener("click", async (event) => {
            event.preventDefault();
        
            const email = document.getElementById("eMail").value;
            const password = document.getElementById("passWord").value;
        
            const isAdmin = document.getElementById("admin")?.checked;
            const isUser = document.getElementById("user")?.checked;
        
            // Check if radio buttons are unchecked
            if (!isAdmin && !isUser) {
              showMessage("！User type must be selected.");
              return;
            }
        
            // Check if email or password are missing
            if (!email || !password) {
              showMessage("❌ Log-in information is missing.");
              return;
            }
        
            try {
              const userCredential = await signInWithEmailAndPassword(auth, email, password);
              const user = userCredential.user;
        
              const userDocRef = doc(db, "users", user.uid);
              const userSnapshot = await getDoc(userDocRef);
        
              if (!userSnapshot.exists()) {
                showMessage("❌ Account not found.");
                return;
              }
        
              const userData = userSnapshot.data();
              const storedIsAdmin = userData.admin === true;
        
              if ((isAdmin && !storedIsAdmin) || (isUser && storedIsAdmin)) {
                showMessage("❌ Account not found.");
                return;
              }
        
              showMessage(`✅ Login successful. Welcome, ${userData.username}! Redirecting...`);
              localStorage.setItem("loggedInUserId", user.uid);
        
              setTimeout(() => {
                window.location.href = "menu.html";
              }, 1500);
        
            } catch (error) {
              const errorCode = error.code;
              console.error("Auth Error:", error);
              console.log("Error code:", errorCode);
        
              // Check for authentication errors that indicate account not found
              if (
                errorCode === "auth/user-not-found" ||
                errorCode === "auth/wrong-password" ||
                errorCode === "auth/invalid-credential" ||
                errorCode === "auth/invalid-email"
              ) {
                showMessage("❌ Account not found.");
              } else {
                // If all validations pass but login still fails due to technical issues
                showMessage("❌ Log-in failed.");
              }
            }
          });
        }
        
      });
      