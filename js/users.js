const usersContainer = document.getElementById("users-container");
const profileSection = document.getElementById("profile");
const currentUsername = profileSection?.dataset.currentUsername?.trim().toLowerCase();

function getDisplayName(username) {
    const cleanUsername = String(username || "").trim();

    if (!cleanUsername) {
        return "Instagram User";
    }

    return cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1);
}


const PROFILE_IMAGE_MAP = {
    "REAL_SEHRISH_URL": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces",
    "REAL_SARA_URL": "https://images.pexels.com/photos/14999218/pexels-photo-14999218.jpeg",
    "REAL_AYSHA_URL": "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=100&h=100&fit=crop&crop=faces",
    "REAL_HASSAN_URL": "https://images.pexels.com/photos/27368188/pexels-photo-27368188.jpeg",
    "REAL_MAHRUKH_URL": "https://images.pexels.com/photos/8467411/pexels-photo-8467411.jpeg"
};



function resolveProfileImage(profileImage) {
    const trimmed = String(profileImage || "").trim();
    return PROFILE_IMAGE_MAP[trimmed] || trimmed;
}

function createAvatar(user, displayName) {
    const avatar = document.createElement("div");
    avatar.className = "user-avatar";

    const addFallback = () => {
        const fallback = document.createElement("span");
        fallback.className = "user-avatar-fallback";
        fallback.textContent = displayName.charAt(0).toUpperCase();
        avatar.appendChild(fallback);
    };

    const profileImage = resolveProfileImage(user.profile_image);

    if (profileImage) {
        const image = document.createElement("img");
        image.className = "user-avatar-image";
        image.src = profileImage;
        image.alt = `${displayName} profile`;
        image.addEventListener("error", () => {
            image.remove();
            addFallback();
        }, { once: true });
        avatar.appendChild(image);
    } else {
        addFallback();
    }

    return avatar;
}

function createUserElement(user) {
    const displayName = getDisplayName(user.username);
    const userElement = document.createElement("article");
    userElement.className = "user";
    userElement.appendChild(createAvatar(user, displayName));

    const identity = document.createElement("div");
    identity.className = "user-identity";

    const name = document.createElement("h3");
    name.className = "user-display-name";
    name.textContent = displayName;

    const username = document.createElement("span");
    username.className = "user-username";
    username.textContent = `@${String(user.username || "").trim()}`;

    identity.append(name, username);
    userElement.appendChild(identity);

    return userElement;
}

function renderUsersMessage(message) {
    usersContainer.replaceChildren();

    const messageElement = document.createElement("p");
    messageElement.className = "users-message";
    messageElement.textContent = message;
    usersContainer.appendChild(messageElement);
}

async function loadUsers() {
    if (!window.supabaseClient) {
        renderUsersMessage("Supabase client not found.");
        return;
    }

    const { data, error } = await window.supabaseClient
        .from("users")
        .select("id, username, bio, profile_image, created_at");

    if (error) {
        console.error("Unable to load users:", error);
        renderUsersMessage("Unable to load users.");
        return;
    }

    if (!data || data.length === 0) {
        renderUsersMessage("No users found.");
        return;
    }

    usersContainer.replaceChildren();
    data
        .filter((user) => {
            const username = String(user.username || "").trim().toLowerCase();
            return !currentUsername || username !== currentUsername;
        })
        .forEach((user) => {
            usersContainer.appendChild(createUserElement(user));
        });
}

loadUsers();
