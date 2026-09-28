// Maps the signed-in Supabase Auth user to its row in the existing public "users"
// table. No RPC and no second profile table: the row is created directly, and only
// for the currently authenticated user (the users INSERT policy enforces
// auth_user_id = auth.uid()).
async function ensurePublicProfile(authUser, preferredUsername) {
    if (!window.supabaseClient || !authUser?.id) {
        return { error: "Supabase client not available." };
    }

    const username = String(
        preferredUsername || authUser.user_metadata?.username || ""
    ).trim();

    // Already mapped (e.g. the account was linked on an earlier login, or a
    // database trigger created the row): never insert a duplicate.
    const { data: existing, error: lookupError } = await window.supabaseClient
        .from("users")
        .select("id, username, full_name, bio, profile_image")
        .eq("auth_user_id", authUser.id)
        .maybeSingle();

    if (lookupError) {
        console.error("Profile lookup error:", lookupError);
        return { error: lookupError.message || "Unable to load the profile." };
    }

    if (existing) {
        return { data: existing };
    }

    if (!username) {
        return { error: "This account is not linked to a public profile." };
    }

    // public.users.full_name is NOT NULL, so it must be sent on insert.
    const { data: created, error: insertError } = await window.supabaseClient
        .from("users")
        .insert({
            username,
            full_name: username,
            auth_user_id: authUser.id
        })
        .select("id, username, full_name, bio, profile_image")
        .single();

    if (insertError) {
        if (insertError.code === "23505") {
            return { error: "That username is already taken." };
        }
        console.error("Profile creation error:", insertError);
        return { error: insertError.message || "Failed to create profile." };
    }

    return { data: created };
}

async function signup(email, password, username) {
    if (!window.supabaseClient) {
        return { error: "Supabase client not available." };
    }

    const normalizedEmail = String(email || "").trim();
    const trimmedUsername = String(username || "").trim();
    if (!normalizedEmail || !password || !trimmedUsername) {
        return { error: "Email, password, and username are required." };
    }

    const { data, error } = await window.supabaseClient.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
            data: { username: trimmedUsername }
        }
    });

    if (error) {
        if (error.code === "user_already_registered" || error.message?.includes("already registered")) {
            return { error: "An account with that email already exists." };
        }
        return { error: error.message || "Signup failed." };
    }

    if (!data?.user) {
        return { error: "Signup failed: no user returned." };
    }

    const session = data.session || null;

    // Without a session there is no auth.uid(), so the RLS policy would reject the
    // insert. The public row is created on first login instead (see login()).
    if (session) {
        const { error: profileError } = await ensurePublicProfile(data.user, trimmedUsername);
        if (profileError) {
            return { error: profileError };
        }
    }

    return { data: { session, user: data.user } };
}

async function login(email, password) {
    if (!window.supabaseClient) {
        return { error: "Supabase client not available." };
    }

    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
        email: String(email || "").trim(),
        password
    });

    if (error) {
        if (error.code === "email_not_confirmed" || error.message === "Email not confirmed") {
            return { error: "Please confirm your email before logging in." };
        }

        return { error: error.message || "Login failed." };
    }

    if (!data?.session) {
        return { error: "Login succeeded, but no Supabase session was created." };
    }

    const { data: sessionData, error: sessionError } = await window.supabaseClient.auth.getSession();
    if (sessionError) {
        return { error: sessionError.message || "Unable to read the Supabase session." };
    }

    if (!sessionData?.session) {
        return { error: "Login succeeded, but no Supabase session was created." };
    }

    const { data: profile, error: userError } = await window.supabaseClient
        .from("users")
        .select("id, username, full_name, bio, profile_image")
        .eq("auth_user_id", sessionData.session.user.id)
        .maybeSingle();

    if (userError) {
        return { error: userError.message || "Unable to load the authenticated profile." };
    }

    // Account exists in Supabase Auth but has no public row yet (signup completed
    // while email confirmation was still pending). Create it now that we have a
    // session, so auth_user_id maps to a real users row.
    if (!profile) {
        const { error: profileError } = await ensurePublicProfile(sessionData.session.user);
        if (profileError) {
            return { error: profileError };
        }
    }

    return { data: sessionData };
}

async function logout() {
    if (!window.supabaseClient) return { error: "Supabase client not available." };
    const { error } = await window.supabaseClient.auth.signOut();
    return { error };
}

async function getSession() {
    if (!window.supabaseClient) return null;

    // Supabase restores the persisted session asynchronously after page load, so
    // retry briefly instead of reporting "logged out" on the first call.
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const { data, error } = await window.supabaseClient.auth.getSession();

        if (!error && data?.session) {
            return data.session;
        }

        if (error) {
            console.error("Supabase session error:", error);
            return null;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return null;
}

async function getCurrentUser() {
    const session = await getSession();
    if (!session?.user?.id || !window.supabaseClient) return null;

    const { data: user, error } = await window.supabaseClient
        .from("users")
        .select("id, username, full_name, bio, profile_image")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

    if (error) {
        console.error("Unable to resolve authenticated profile:", error);
        return null;
    }

    if (!user) {
        console.error("Authenticated account is not mapped to a public profile.");
    }

    return user || null;
}

async function getCurrentUsername() {
    const user = await getCurrentUser();
    return user?.username || null;
}

function setProfileIdentity(user) {
    const profileSection = document.getElementById("profile");
    if (!profileSection) return;

    const username = user?.username || "";
    profileSection.dataset.currentUsername = username;

    const heading = document.getElementById("profile-heading");
    if (heading) {
        heading.textContent = user?.full_name || username || "Instagram User";
    }

    const usernameElement = profileSection.querySelector(".profile-info p");
    if (usernameElement) {
        usernameElement.textContent = username ? `@${username}` : "Sign in to view your profile";
    }

    const profileLink = document.getElementById("profile-link");
    if (profileLink && username) {
        profileLink.href = `pages/profile.html?user=${encodeURIComponent(username)}`;
    }
}

async function updateAuthUI() {
    const authArea = document.getElementById("auth-area");
    if (!authArea) return;

    const session = await getSession();
    const profileLink = document.getElementById("profile-link");
    if (profileLink) {
        profileLink.href = "#profile";
    }

    if (!session) {
        authArea.replaceChildren();
        const loginLink = document.createElement("a");
        loginLink.href = "pages/login.html";
        loginLink.className = "auth-button";
        loginLink.textContent = "Login";
        authArea.appendChild(loginLink);

        const signupLink = document.createElement("a");
        signupLink.href = "pages/signup.html";
        signupLink.className = "auth-button";
        signupLink.textContent = "Sign Up";
        authArea.appendChild(signupLink);

        setProfileIdentity(null);
        return;
    }

    const user = await getCurrentUser();
    setProfileIdentity(user);

    authArea.replaceChildren();
    const username = document.createElement("span");
    username.className = "auth-username";
    username.textContent = user?.username || "User";

    const logoutButton = document.createElement("button");
    logoutButton.type = "button";
    logoutButton.id = "logout-btn";
    logoutButton.className = "auth-button";
    logoutButton.textContent = "Logout";
    logoutButton.addEventListener("click", handleLogout);

    authArea.append(username, logoutButton);
}

async function handleLogout() {
    const { error } = await logout();
    if (error) {
        console.error("Logout error:", error);
        alert("Could not log out.");
        return;
    }

    window.location.href = "index.html";
}

async function isLoggedIn() {
    const session = await getSession();
    return !!session;
}

async function handleLoginRedirect() {
    if (await isLoggedIn()) {
        window.location.href = "../index.html";
    }
}

let authStateListenerInitialized = false;

function initAuthStateChange() {
    if (!window.supabaseClient || authStateListenerInitialized) return;

    authStateListenerInitialized = true;
    window.supabaseClient.auth.onAuthStateChange(() => {
        updateAuthUI();
        window.dispatchEvent(new Event("authStateReady"));
    });
}

window.authAPI = {
    login,
    signup,
    logout,
    getSession,
    getCurrentUser,
    getCurrentUsername,
    isLoggedIn,
    updateAuthUI,
    handleLogout,
    handleLoginRedirect,
    initAuthStateChange
};
