const usersContainer = document.getElementById("users-container");

function getDisplayName(username) {
    const cleanUsername = String(username || "").trim();

    if (!cleanUsername) {
        return "Instagram User";
    }

    return cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1);
}

function resolveProfileImage(profileImage) {
    const trimmed = String(profileImage || "").trim();
    return trimmed;
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
        image.loading = "eager";
        image.alt = `${displayName} profile`;
        image.addEventListener("error", () => {
            image.remove();
            addFallback();
        }, { once: true });
        image.setAttribute("src", profileImage);
        avatar.appendChild(image);
    } else {
        addFallback();
    }

    return avatar;
}

async function getAuthUserId() {
    const session = await window.authAPI?.getSession();
    return session?.user?.id || null;
}

async function getSessionUserId() {
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const session = await window.authAPI?.getSession();
        if (session?.user?.id) {
            return session.user.id;
        }
        await new Promise(resolve => setTimeout(resolve, 150));
    }
    return null;
}

async function getMyUserInfo() {
    const authId = await getSessionUserId();
    if (!authId) return null;

    const user = await window.authAPI?.getCurrentUser();
    if (!user?.id) return null;

    return {
        usersId: user.id,
        authId
    };
}

async function getSupabaseClient() {
    return window.supabaseClient;
}

async function getFollowState(followerId, followingId) {
    const client = await getSupabaseClient();
    if (!client || !followerId || !followingId) return null;

    const { data, error } = await client
        .from("followers")
        .select("id")
        .eq("follower_id", followerId)
        .eq("following_id", followingId)
        .maybeSingle();

    if (error) {
        console.error("Follow state error:", error);
        return null;
    }

    return !!data;
}

function createFollowButton(targetUserId, currentUserId) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "follow-button";
    button.dataset.targetUserId = targetUserId;
    button.textContent = "Follow";

    let isFollowing = false;
    let pending = false;

    const applyState = (following) => {
        isFollowing = following === true;
        button.textContent = isFollowing ? "Unfollow" : "Follow";
        button.classList.toggle("following", isFollowing);
    };

    // The initial read must not disable the button: a click landing while it was
    // still in flight was dropped by the click guard, so the click did nothing and
    // the label never changed. The click handler re-reads the authoritative state
    // instead, so a click always toggles the correct way.
    const syncFromDatabase = async () => {
        const followed = await getFollowState(currentUserId, targetUserId);

        if (followed !== null) {
            applyState(followed);
        }
    };

    syncFromDatabase();

    button.addEventListener("click", async (event) => {
        event.stopPropagation();
        if (pending) return;
        if (!currentUserId || !targetUserId || currentUserId === targetUserId) return;

        const client = await getSupabaseClient();
        if (!client) return;

        pending = true;
        button.disabled = true;

        try {
            const followed = await getFollowState(currentUserId, targetUserId);
            if (followed === null) return;
            if (followed !== isFollowing) applyState(followed);

            if (followed) {
                const { error } = await client
                    .from("followers")
                    .delete()
                    .eq("follower_id", currentUserId)
                    .eq("following_id", targetUserId);

                if (error) {
                    console.error("Unfollow error:", error);
                    await syncFromDatabase();
                    return;
                }

                applyState(false);
            } else {
                const { error } = await client
                    .from("followers")
                    .insert({
                        follower_id: currentUserId,
                        following_id: targetUserId
                    });

                if (error) {
                    console.error("Follow error:", error);
                    await syncFromDatabase();
                    return;
                }

                applyState(true);
            }
        } finally {
            pending = false;
            button.disabled = false;
        }
    });

    return button;
}

function createUserElement(user, myInfo) {
    const displayName = getDisplayName(user.username);
    const userElement = document.createElement("article");
    userElement.className = "user";
    userElement.style.cursor = "pointer";

    const avatar = createAvatar(user, displayName);
    userElement.appendChild(avatar);

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

    if (myInfo?.usersId && myInfo.usersId !== user.id) {
        userElement.appendChild(createFollowButton(user.id, myInfo.usersId));
    }

    userElement.addEventListener("click", () => {
        window.location.href = `pages/profile.html?user=${encodeURIComponent(user.username)}`;
    });

    return userElement;
}

function renderUsersMessage(message) {
    if (!usersContainer) return;

    usersContainer.replaceChildren();
    const messageElement = document.createElement("p");
    messageElement.className = "users-message";
    messageElement.textContent = message;
    usersContainer.appendChild(messageElement);
}

async function loadUsers() {
    if (!usersContainer) return;

    const client = await getSupabaseClient();
    if (!client) {
        renderUsersMessage("Supabase client not found.");
        return;
    }

    const { data, error } = await client
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

    const myInfo = await getMyUserInfo();

    usersContainer.replaceChildren();
    data.forEach((user) => {
        usersContainer.appendChild(createUserElement(user, myInfo));
    });
}

window.loadUsers = loadUsers;