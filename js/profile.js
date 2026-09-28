// Profile page functionality
const profilePostsContainer = document.getElementById("profile-posts-container");
const profileHeaderImage = document.querySelector(".profile-header-image");
const profilePlaceholder = document.querySelector(".profile-header-placeholder");
const profileUsername = document.getElementById("profile-username");
const profileDisplayName = document.getElementById("profile-display-name");
const profileBio = document.getElementById("profile-bio");
const postsCountEl = document.getElementById("posts-count");
const followersCountEl = document.getElementById("followers-count");
const followingCountEl = document.getElementById("following-count");
const profileActions = document.getElementById("profile-actions");

let currentProfileUserId = null;
let currentProfileUsername = null;
let isOwnProfile = false;
let myInfo = null;

function getDisplayName(username) {
    const cleanUsername = String(username || "").trim();
    if (!cleanUsername) return "Instagram User";
    return cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1);
}

function setProfileImage(element, profileImageUrl, displayName) {
    if (profileImageUrl && profileImageUrl.trim()) {
        const img = document.createElement("img");
        img.className = "profile-header-image-actual";
        img.src = profileImageUrl;
        img.alt = `${displayName} profile`;
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "cover";
        img.style.borderRadius = "50%";
        element.replaceChildren(img);
    } else {
        element.replaceChildren(profilePlaceholder);
    }
}

async function getSupabaseClient() {
    return window.supabaseClient;
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

async function loadFollowCounts(userId) {
    const client = await getSupabaseClient();
    if (!client || !userId) return;

    const [followersRes, followingRes] = await Promise.all([
        client
            .from("followers")
            .select("id", { count: "exact", head: true })
            .eq("following_id", userId),
        client
            .from("followers")
            .select("id", { count: "exact", head: true })
            .eq("follower_id", userId)
    ]);

    if (followersCountEl) followersCountEl.textContent = followersRes.count || 0;
    if (followingCountEl) followingCountEl.textContent = followingRes.count || 0;
}

async function loadPostCount(userId) {
    const client = await getSupabaseClient();
    if (!client || !userId) return;

    const { count, error } = await client
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

    if (!error && postsCountEl) {
        postsCountEl.textContent = count || 0;
    }
}

function createFollowButton(targetUserId, currentUserId) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "follow-button profile-follow-button";
    button.dataset.targetUserId = targetUserId;
    button.textContent = "Follow";

    let isFollowing = false;
    let pending = false;

    const applyState = (following) => {
        isFollowing = following === true;
        button.textContent = isFollowing ? "Unfollow" : "Follow";
        button.classList.toggle("following", isFollowing);
    };

    // Do not disable the button while the initial state is still loading: a click
    // landing in that window was dropped by the click guard, so it did nothing and
    // the label stayed wrong. The click handler re-reads the authoritative state
    // instead, so a click always toggles the correct way.
    const syncFromDatabase = async () => {
        const followed = await getFollowState(currentUserId, targetUserId);

        if (followed !== null) {
            applyState(followed);
        }
    };

    syncFromDatabase();

    button.addEventListener("click", async () => {
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

        await loadFollowCounts(targetUserId);
    });

    return button;
}

function renderProfileActions() {
    if (!profileActions) return;

    profileActions.replaceChildren();

    if (!currentProfileUserId || isOwnProfile || !myInfo?.usersId) return;

    profileActions.appendChild(createFollowButton(currentProfileUserId, myInfo.usersId));
}

let profileAuthListenerInitialized = false;

function initProfileAuthListener() {
    if (profileAuthListenerInitialized) return;
    profileAuthListenerInitialized = true;

    window.authAPI?.initAuthStateChange();
    window.addEventListener("authStateReady", async () => {
        myInfo = await getMyUserInfo();
        isOwnProfile = !!myInfo && myInfo.usersId === currentProfileUserId;
        renderProfileActions();
    });
}

async function loadProfile() {
    const urlParams = new URLSearchParams(window.location.search);
    const usernameParam = urlParams.get("user");

    if (!usernameParam) {
        profileUsername.textContent = "User not found";
        return;
    }

    currentProfileUsername = usernameParam;
    isOwnProfile = false;
    myInfo = null;

    initProfileAuthListener();

    const client = await getSupabaseClient();
    if (!client) {
        profileUsername.textContent = "Supabase not available";
        return;
    }

    const { data: user, error } = await client
        .from("users")
        .select("id, username, full_name, bio, profile_image")
        .eq("username", usernameParam)
        .maybeSingle();

    if (error) {
        console.error("Profile load error:", error);
        profileUsername.textContent = "Error loading profile";
        return;
    }

    if (!user) {
        profileUsername.textContent = "User not found";
        return;
    }

    currentProfileUserId = user.id;
    const displayName = getDisplayName(user.username);

    profileUsername.textContent = `@${user.username}`;
    profileDisplayName.textContent = user.full_name || displayName;
    profileBio.textContent = user.bio || "";

    setProfileImage(profileHeaderImage, user.profile_image, displayName);

    await Promise.all([
        loadPostCount(user.id),
        loadFollowCounts(user.id)
    ]);

    myInfo = await getMyUserInfo();
    isOwnProfile = myInfo?.usersId === user.id;

    renderProfileActions();

    await loadProfilePosts(user.id);
}

async function loadProfilePosts(userId) {
    if (!profilePostsContainer) return;

    const client = await getSupabaseClient();
    if (!client) return;

    const { data: posts, error } = await client
        .from("posts")
        .select("id, user_id, caption, image_url, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Profile posts error:", error);
        profilePostsContainer.innerHTML = "<p class='loading-message'>Unable to load posts.</p>";
        return;
    }

    if (!posts || posts.length === 0) {
        profilePostsContainer.innerHTML = "<p class='loading-message'>No posts yet.</p>";
        return;
    }

    profilePostsContainer.innerHTML = "";

    const postIds = posts.map(p => p.id);

    const { data: likeCounts, error: likeError } = await client
        .from("likes")
        .select("post_id")
        .in("post_id", postIds);

    const likeCountMap = {};
    if (!likeError && likeCounts) {
        likeCounts.forEach(like => {
            likeCountMap[like.post_id] = (likeCountMap[like.post_id] || 0) + 1;
        });
    }

    const myInfo = await getMyUserInfo();
    const currentUserId = myInfo?.usersId;

    const likedPostIds = new Set();
    if (currentUserId && postIds.length > 0) {
        const { data: userLikes } = await client
            .from("likes")
            .select("post_id")
            .eq("user_id", currentUserId)
            .in("post_id", postIds);
        if (userLikes) {
            userLikes.forEach(like => likedPostIds.add(like.post_id));
        }
    }

    for (const post of posts) {
        const postElement = document.createElement("article");
        postElement.className = "post";

        const likeCount = likeCountMap[post.id] || 0;
        const isLiked = likedPostIds.has(post.id);

        postElement.innerHTML = `
            <div class="post-header">
                <strong>${currentProfileUsername}</strong>
            </div>
            <div class="post-content">
                <p>${post.caption || ""}</p>
                ${post.image_url ? `<img src="${post.image_url}" alt="Post image">` : ""}
                <small>${post.created_at || ""}</small>
            </div>
            <div class="post-actions">
                <button type="button" class="like-button ${isLiked ? 'liked' : ''}" data-post-id="${post.id}">
                    ${isLiked ? "💔 Unlike" : "❤️ Like"}
                </button>
                <span class="like-count" data-post-id="${post.id}">${likeCount} likes</span>
            </div>
        `;

        profilePostsContainer.appendChild(postElement);
    }

    attachLikeListeners(client);
}

function attachLikeListeners(client) {
    if (!profilePostsContainer) return;

    profilePostsContainer.querySelectorAll(".like-button").forEach(button => {
        button.addEventListener("click", async (e) => {
            const btn = e.currentTarget;
            const postId = btn.dataset.postId;
            if (!postId) return;

            const myInfo = await getMyUserInfo();
            if (!myInfo?.usersId) {
                alert("Please log in to like posts.");
                return;
            }

            btn.disabled = true;
            const isLiked = btn.classList.contains("liked");
            let error;

            if (isLiked) {
                const result = await client
                    .from("likes")
                    .delete()
                    .eq("post_id", postId)
                    .eq("user_id", myInfo.usersId);
                error = result.error;
            } else {
                const result = await client
                    .from("likes")
                    .insert({
                        post_id: postId,
                        user_id: myInfo.usersId
                    });
                error = result.error;
            }

            if (error) {
                console.error(isLiked ? "Unlike error:" : "Like error:", error);
                alert(error.message);
                btn.disabled = false;
                return;
            }

            btn.classList.toggle("liked");
            btn.textContent = isLiked ? "❤️ Like" : "💔 Unlike";

            const countEl = profilePostsContainer.querySelector(`.like-count[data-post-id="${postId}"]`);
            if (countEl) {
                const currentCount = parseInt(countEl.textContent) || 0;
                countEl.textContent = `${isLiked ? currentCount - 1 : currentCount + 1} likes`;
            }

            btn.disabled = false;
        });
    });
}

document.addEventListener("DOMContentLoaded", loadProfile);